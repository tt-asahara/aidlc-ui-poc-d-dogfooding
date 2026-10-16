// 調整役（BookkeepingService）: openBook と Book の実装（W1〜W3、BR1.1〜BR1.3、BR5.1、BR6.1〜BR6.4）。
// - 保存（U3）を使うのはこのファイルだけ。3つの持ち主（ledger・categoryCatalog・budgetPlanner）は純粋な関数で、
//   ここが書き込み処理の中で読み直した値を渡して判定させる（BR6.3、ADR-002）。
// - 書き込みはすべて runWrite を通し、U3 の write を1回だけ呼ぶ（すべて成功かすべて取り消し、NFR4.1）。
// - work の中では TxContext の操作だけを待つ。now()・newId() は同期で呼ぶ（BR6.4、NFR4.4）。
// - Book の操作は例外を投げない。想定外の例外は storage の失敗にする（BR6.2）。
import { isValidYearMonth, validateBudgetAmount, validateTransactionInput } from "../data-contract";
import type {
  Category,
  EntryType,
  Result,
  Transaction,
  TransactionInput,
  ValidationError,
  YearMonth,
} from "../data-contract";
import { openStorage } from "../storage";
import type { StorageHandle, StoreName, TxContext } from "../storage";
import {
  buildBudget,
  checkBudgetCategory,
  checkBudgetClear,
  resolveEffectiveBudgets,
} from "./budgetPlanner";
import {
  buildInitialCategories,
  checkCategoryDeletion,
  isEntryType,
  needsInitialCategories,
  prepareNewCategory,
  prepareRename,
  sortCategories,
} from "./categoryCatalog";
import {
  fail,
  fromOpenError,
  fromPrepareError,
  fromStorageError,
  fromUnexpected,
  fromWriteError,
  invalidMonthError,
  invalidTypeError,
  ok,
  ruleFailure,
  validationFailure,
  type OperationResult,
} from "./errors";
import { defaultNewId, defaultNow } from "./ids";
import {
  buildNewTransaction,
  buildUpdatedTransaction,
  checkCategoryForEntry,
  findImportCategoryProblems,
  sortNewestFirst,
  sortOldestFirst,
} from "./ledger";
import type {
  Book,
  BookOpenResult,
  CategoryUsage,
  EffectiveBudget,
  ImportRow,
  OpenBookOptions,
  OperationError,
  ValidTransaction,
} from "./types";

type Work<T> = (tx: TxContext) => Promise<OperationResult<T>>;

/**
 * 家計簿を開く（W1）。保存領域を開き、カテゴリが0件のときだけ同じ書き込み処理の中で初期カテゴリを作る。
 * 失敗しても例外を投げず、BookOpenResult の status で返す。
 */
export async function openBook(options: OpenBookOptions = {}): Promise<BookOpenResult> {
  const storage = options.storage ?? (() => openStorage());
  const now = options.now ?? defaultNow;
  const newId = options.newId ?? defaultNewId;
  let opened: Awaited<ReturnType<typeof storage>>;
  try {
    opened = await storage();
  } catch (error) {
    return { status: "load-failed", message: fromUnexpected(error, "read").message };
  }
  if (!opened.ok) return fromOpenError(opened.error);
  const book = new BookImpl(opened.value, now, newId);
  const prepared = await book.prepare();
  if (!prepared.ok) {
    closeQuietly(opened.value);
    return fromPrepareError(prepared.error);
  }
  return { status: "ready", book };
}

/** 開いた接続を閉じる（BR1.3）。閉じる処理の失敗は、すでに返す失敗より優先しない。 */
function closeQuietly(handle: StorageHandle): void {
  try {
    handle.close();
  } catch {
    // 閉じられなくても、呼び出し元へは準備の失敗（load-failed・newer-version）を返す。
  }
}

/** 非同期の処理を必ず Result にする（例外を投げない、BR6.2）。 */
async function safely<T>(
  operation: "read" | "write",
  run: () => Promise<OperationResult<T>>,
): Promise<OperationResult<T>> {
  try {
    return await run();
  } catch (error) {
    return fail(fromUnexpected(error, operation));
  }
}

function monthErrors(month: unknown): ValidationError[] {
  return typeof month === "string" && isValidYearMonth(month) ? [] : [invalidMonthError()];
}

class BookImpl implements Book {
  private readonly storage: StorageHandle;
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(storage: StorageHandle, now: () => Date, newId: () => string) {
    this.storage = storage;
    this.now = now;
    this.newId = newId;
  }

  /** 初期カテゴリの作成（BR1.2）。件数は getAll("categories") の全件の長さで数える。 */
  prepare(): Promise<OperationResult<void>> {
    return this.runWrite(["categories"], async (tx) => {
      if (!needsInitialCategories(await tx.getAll("categories"))) return ok(undefined);
      for (const category of buildInitialCategories(this.nowIso(), this.newId)) {
        await tx.put("categories", category);
      }
      return ok(undefined);
    });
  }

  // ---- 読み取り（W2） ----

  listTransactions(month: YearMonth): Promise<OperationResult<Transaction[]>> {
    return safely("read", async () => {
      const errors = monthErrors(month);
      if (errors.length > 0) return validationFailure(errors);
      const read = await this.runRead(["transactions"], (tx) =>
        tx.getAllByIndex("transactions", "byMonth", month),
      );
      return read.ok ? ok(sortNewestFirst(read.value)) : read;
    });
  }

  listAllTransactions(
    range: "all" | { month: YearMonth },
  ): Promise<OperationResult<Transaction[]>> {
    return safely("read", async () => {
      const month: unknown =
        range === "all" ? undefined : (range as { month?: unknown } | null)?.month;
      if (range !== "all") {
        const errors = monthErrors(month);
        if (errors.length > 0) return validationFailure(errors);
      }
      const read = await this.runRead(["transactions"], (tx) =>
        typeof month === "string"
          ? tx.getAllByIndex("transactions", "byMonth", month)
          : tx.getAll("transactions"),
      );
      return read.ok ? ok(sortOldestFirst(read.value)) : read;
    });
  }

  listCategories(): Promise<OperationResult<Category[]>> {
    return safely("read", async () => {
      const read = await this.runRead(["categories"], (tx) => tx.getAll("categories"));
      return read.ok ? ok(sortCategories(read.value)) : read;
    });
  }

  /** 全カテゴリの収支の件数と予算の行数（設定した月の数）を1回の読み取り処理で数える（BR2.6、security-design 第3章）。 */
  getCategoryUsage(): Promise<OperationResult<Record<string, CategoryUsage>>> {
    return safely("read", () =>
      this.runRead(["transactions", "categories", "budgets"], async (tx) => {
        const categories = await tx.getAll("categories");
        const entries = await Promise.all(
          categories.map(async (category): Promise<[string, CategoryUsage]> => {
            const [transactions, budgets] = await Promise.all([
              tx.count("transactions", "byCategory", category.id),
              tx.getAllByIndex("budgets", "byCategory", category.id),
            ]);
            return [category.id, { transactions, budgets: budgets.length }];
          }),
        );
        return Object.fromEntries(entries);
      }),
    );
  }

  getEffectiveBudgets(month: YearMonth): Promise<OperationResult<EffectiveBudget[]>> {
    return safely("read", async () => {
      const errors = monthErrors(month);
      if (errors.length > 0) return validationFailure(errors);
      return this.runRead(["categories", "budgets"], async (tx) => {
        const [categories, budgets] = await Promise.all([
          tx.getAll("categories"),
          tx.getAll("budgets"),
        ]);
        return resolveEffectiveBudgets(categories, budgets, month);
      });
    });
  }

  // ---- 書き込み（W3） ----

  addTransaction(input: TransactionInput): Promise<OperationResult<Transaction>> {
    return safely("write", async () => {
      const checked = validateTransactionInput(input);
      if (!checked.ok) return validationFailure(checked.error);
      const valid = checked.value;
      return this.runWrite(["transactions", "categories"], async (tx) => {
        const violation = checkCategoryForEntry(
          await tx.get("categories", valid.categoryId),
          valid.type,
        );
        if (violation !== undefined) return ruleFailure(violation);
        const transaction = buildNewTransaction(valid, this.newId(), this.nowIso());
        await tx.put("transactions", transaction);
        return ok(transaction);
      });
    });
  }

  updateTransaction(id: string, input: TransactionInput): Promise<OperationResult<Transaction>> {
    return safely("write", async () => {
      const checked = validateTransactionInput(input);
      if (!checked.ok) return validationFailure(checked.error);
      const valid = checked.value;
      return this.runWrite(["transactions", "categories"], async (tx) => {
        const existing = typeof id === "string" ? await tx.get("transactions", id) : undefined;
        if (existing === undefined) return ruleFailure({ code: "not-found" });
        const violation = checkCategoryForEntry(
          await tx.get("categories", valid.categoryId),
          valid.type,
        );
        if (violation !== undefined) return ruleFailure(violation);
        const transaction = buildUpdatedTransaction(existing, valid, this.nowIso());
        await tx.put("transactions", transaction);
        return ok(transaction);
      });
    });
  }

  deleteTransaction(id: string): Promise<OperationResult<void>> {
    return safely("write", () =>
      this.runWrite(["transactions"], async (tx) => {
        const existing = typeof id === "string" ? await tx.get("transactions", id) : undefined;
        if (existing === undefined) return ruleFailure({ code: "not-found" });
        await tx.delete("transactions", existing.id);
        return ok(undefined);
      }),
    );
  }

  addCategory(type: EntryType, name: string): Promise<OperationResult<Category>> {
    return safely("write", async () => {
      if (!isEntryType(type)) return validationFailure([invalidTypeError()]);
      return this.runWrite(["categories"], async (tx) => {
        const prepared = prepareNewCategory(type, name, await tx.getAll("categories"));
        if (!prepared.ok) return validationFailure(prepared.error);
        const category: Category = {
          id: this.newId(),
          ...prepared.value,
          createdAt: this.nowIso(),
        };
        await tx.put("categories", category);
        return ok(category);
      });
    });
  }

  renameCategory(id: string, name: string): Promise<OperationResult<Category>> {
    return safely("write", () =>
      this.runWrite(["categories"], async (tx) => {
        const categories = await tx.getAll("categories");
        const target = categories.find((category) => category.id === id);
        if (target === undefined) return ruleFailure({ code: "not-found" });
        const renamed = prepareRename(target, name, categories);
        if (!renamed.ok) return validationFailure(renamed.error);
        await tx.put("categories", renamed.value);
        return ok(renamed.value);
      }),
    );
  }

  /** 存在 → 使用件数 → 最後の1件の順に処理の中で確かめ、支出カテゴリならその予算もすべて消す（BR3.4）。 */
  deleteCategory(id: string): Promise<OperationResult<{ deletedBudgets: number }>> {
    return safely("write", () =>
      this.runWrite(["transactions", "categories", "budgets"], async (tx) => {
        const target = typeof id === "string" ? await tx.get("categories", id) : undefined;
        if (target === undefined) return ruleFailure({ code: "not-found" });
        const used = await tx.count("transactions", "byCategory", target.id);
        const violation = checkCategoryDeletion(target, used, await tx.getAll("categories"));
        if (violation !== undefined) return ruleFailure(violation);
        const budgets = await tx.getAllByIndex("budgets", "byCategory", target.id);
        for (const budget of budgets) await tx.delete("budgets", [budget.categoryId, budget.month]);
        await tx.delete("categories", target.id);
        return ok({ deletedBudgets: budgets.length });
      }),
    );
  }

  setBudget(
    categoryId: string,
    month: YearMonth,
    amount: string | number,
  ): Promise<OperationResult<void>> {
    return safely("write", async () => {
      const checkedAmount = validateBudgetAmount(amount);
      const errors = [...monthErrors(month), ...(checkedAmount.ok ? [] : checkedAmount.error)];
      if (!checkedAmount.ok || errors.length > 0) return validationFailure(errors);
      return this.runWrite(["budgets", "categories"], async (tx) => {
        const category =
          typeof categoryId === "string" ? await tx.get("categories", categoryId) : undefined;
        const violation = checkBudgetCategory(category);
        if (violation !== undefined) return ruleFailure(violation);
        await tx.put("budgets", buildBudget(categoryId, month, checkedAmount.value, this.nowIso()));
        return ok(undefined);
      });
    });
  }

  clearBudget(categoryId: string, month: YearMonth): Promise<OperationResult<void>> {
    return safely("write", async () => {
      const errors = monthErrors(month);
      if (errors.length > 0) return validationFailure(errors);
      return this.runWrite(["budgets"], async (tx) => {
        const existing =
          typeof categoryId === "string" ? await tx.get("budgets", [categoryId, month]) : undefined;
        const violation = checkBudgetClear(existing);
        if (violation !== undefined) return ruleFailure(violation);
        await tx.delete("budgets", [categoryId, month]);
        return ok(undefined);
      });
    });
  }

  /**
   * CSV の取り込みの確定（BR5.1）。全行を再検証し（最初に失敗した行を line で返す）、
   * 処理の中でカテゴリの存在・種別を確かめ（問題の行を昇順で返す）、問題がなければ全件を1回の処理で追加する。
   */
  importTransactions(rows: readonly ImportRow[]): Promise<OperationResult<{ added: number }>> {
    return safely("write", async () => {
      const validated = revalidateImportRows(rows);
      if (!validated.ok) return validated;
      const checkedRows = validated.value;
      if (checkedRows.length === 0) return ok({ added: 0 });
      return this.runWrite(["transactions", "categories"], async (tx) => {
        const lines = findImportCategoryProblems(checkedRows, await tx.getAll("categories"));
        if (lines.length > 0) return ruleFailure({ code: "import-category-missing", lines });
        const nowIso = this.nowIso();
        for (const row of checkedRows) {
          await tx.put("transactions", buildNewTransaction(row.value, this.newId(), nowIso));
        }
        return ok({ added: checkedRows.length });
      });
    });
  }

  // ---- 保存との境界 ----

  /** U3 の read を1回だけ呼び、失敗を OperationError に置き換える（BR6.1）。 */
  private async runRead<T>(
    stores: readonly StoreName[],
    work: (tx: TxContext) => Promise<T>,
  ): Promise<OperationResult<T>> {
    const result = await this.storage.read(stores, work);
    return result.ok ? result : fail(fromStorageError(result.error));
  }

  /** U3 の write を1回だけ呼ぶ。work の { ok: false } は aborted.reason としてそのまま返る（BR6.1）。 */
  private async runWrite<T>(
    stores: readonly StoreName[],
    work: Work<T>,
  ): Promise<OperationResult<T>> {
    const result = await this.storage.write<T, OperationError>(stores, work);
    return result.ok ? result : fail(fromWriteError(result.error));
  }

  /** 保存する日時（UTC、末尾 Z）。同期の関数（BR6.4）。 */
  private nowIso(): string {
    return this.now().toISOString();
  }
}

/** 取り込みの各行を U1 で再検証する。失敗した最初の行のエラーと行番号を返す（security-design 第5章）。 */
function revalidateImportRows(
  rows: readonly ImportRow[],
): Result<{ line: number; value: ValidTransaction }[], OperationError> {
  const checked: { line: number; value: ValidTransaction }[] = [];
  for (const row of rows) {
    const result = validateTransactionInput(row.input);
    if (!result.ok) return validationFailure(result.error, row.line);
    checked.push({ line: row.line, value: result.value });
  }
  return ok(checked);
}
