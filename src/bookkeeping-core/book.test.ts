// Book の結合テスト（U3 の差し替え createMemoryStorage を使う）。
// US3.1〜US4.3、BR1.1〜BR6.4、NFR4.1・NFR4.3、team.md の必須のテスト観点（入力エラー・空データ・読み込み中・保存失敗）。
import { describe, expect, it, vi } from "vitest";
import type { Result } from "../data-contract";
import { createMemoryStorage } from "../storage";
import type { StorageHandle } from "../storage";
import { openBook } from "./book";
import { CORE_MESSAGES } from "./messages";
import {
  dumpStores,
  fakeInput,
  FIXED_NOW_ISO,
  fixedNow,
  memoryBook,
  readyBook,
  sequentialIds,
  steppingNow,
  switchableStorage,
} from "./test-fixtures";
import type { Book, OperationError, RuleViolation } from "./types";

function expectRule(result: Result<unknown, OperationError>, violation: RuleViolation): void {
  expect(result).toEqual({ ok: false, error: { kind: "rule", violation } });
}

function expectValidationCodes(result: Result<unknown, OperationError>, codes: string[]): void {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("validation");
  if (result.error.kind !== "validation") return;
  expect(result.error.errors.map((e) => `${e.field}:${e.code}`)).toEqual(codes);
}

async function categoriesOf(book: Book) {
  const listed = await book.listCategories();
  if (!listed.ok) throw new Error("カテゴリを読めませんでした");
  return listed.value;
}

/** 種別と名前でカテゴリの id を引く。 */
async function categoryId(book: Book, name: string): Promise<string> {
  const found = (await categoriesOf(book)).find((c) => c.name === name);
  if (found === undefined) throw new Error(`カテゴリ ${name} がありません`);
  return found.id;
}

function staticHandle(
  overrides: Partial<StorageHandle>,
): () => Promise<Result<StorageHandle, never>> {
  const handle: StorageHandle = {
    read: () => Promise.resolve({ ok: false, error: { kind: "newer-version" } as const }),
    write: () => Promise.resolve({ ok: false, error: { kind: "newer-version" } as const }),
    close: vi.fn(),
    ...overrides,
  };
  return () => Promise.resolve({ ok: true, value: handle });
}

describe("openBook（W1、BR1.1〜BR1.3）", () => {
  it("初回は初期カテゴリ10件を作り、支出の後に収入の並びで返す（AC3.1.1、空データ）", async () => {
    const { book } = await memoryBook();
    const categories = await categoriesOf(book);
    expect(categories.map((c) => `${c.type}:${c.name}:${c.sortOrder}`)).toEqual([
      "expense:食費:0",
      "expense:日用品:1",
      "expense:住居費:2",
      "expense:水道光熱費:3",
      "expense:交通費:4",
      "expense:娯楽:5",
      "expense:その他支出:6",
      "income:給与:0",
      "income:副収入:1",
      "income:その他収入:2",
    ]);
    expect(categories[0]).toEqual({
      id: "id-0001",
      type: "expense",
      name: "食費",
      sortOrder: 0,
      createdAt: FIXED_NOW_ISO,
    });
  });

  it("2回目以降に同じ保存領域を開いても初期カテゴリを作らない（AC3.1.2）", async () => {
    const storage = await switchableStorage();
    await readyBook({ storage: storage.open, newId: sequentialIds("a-") });
    const second = await readyBook({ storage: storage.open, newId: sequentialIds("b-") });
    const categories = await categoriesOf(second);
    expect(categories).toHaveLength(10);
    expect(categories.every((c) => c.id.startsWith("a-"))).toBe(true);
  });

  it("開く失敗を status に置き換える（unavailable・newer-version・load-failed）", async () => {
    expect(
      await openBook({ storage: () => createMemoryStorage({ failOpen: { kind: "unavailable" } }) }),
    ).toEqual({
      status: "unavailable",
    });
    expect(
      await openBook({
        storage: () =>
          createMemoryStorage({ failOpen: { kind: "newer-version", found: 2, supported: 1 } }),
      }),
    ).toEqual({ status: "newer-version" });
    expect(
      await openBook({
        storage: () =>
          createMemoryStorage({ failOpen: { kind: "open-failed", message: "架空の失敗" } }),
      }),
    ).toEqual({ status: "load-failed", message: "架空の失敗" });
  });

  it("storage が例外を投げても例外にせず load-failed を返す", async () => {
    const opened = await openBook({ storage: () => Promise.reject(new Error("架空の例外")) });
    expect(opened).toEqual({
      status: "load-failed",
      message: `${CORE_MESSAGES.unexpectedRead}（架空の例外）`,
    });
  });

  it("初期カテゴリの作成に失敗したら接続を閉じて load-failed を返す（BR1.3、保存失敗）", async () => {
    const storage = await switchableStorage();
    storage.failWrites = true;
    const opened = await openBook({ storage: storage.open });
    expect(opened.status).toBe("load-failed");
    if (opened.status === "load-failed") expect(opened.message).toContain("failWrites");
    expect(storage.closeCount).toBe(1);
  });

  it("初期カテゴリの作成の途中で版が上がったら newer-version を返して接続を閉じる", async () => {
    const close = vi.fn();
    expect(await openBook({ storage: staticHandle({ close }) })).toEqual({
      status: "newer-version",
    });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("接続を閉じる処理の例外は、準備の失敗の結果を変えない", async () => {
    const close = () => {
      throw new Error("架空の close の失敗");
    };
    expect(await openBook({ storage: staticHandle({ close }) })).toEqual({
      status: "newer-version",
    });
  });

  it("id を作れないときは書き込み処理の失敗として load-failed になり、接続を閉じる", async () => {
    const storage = await switchableStorage();
    const opened = await openBook({
      storage: storage.open,
      newId: () => {
        throw new Error("架空の id の失敗");
      },
    });
    expect(opened.status).toBe("load-failed");
    if (opened.status === "load-failed") expect(opened.message).toContain("架空の id の失敗");
    expect(storage.closeCount).toBe(1);
  });

  it("読み込み中: 差し替えの delayMs の間は openBook と操作が未完了（読み込み中）", async () => {
    let settled = false;
    const pending = openBook({ storage: () => createMemoryStorage({ delayMs: 40 }) }).then((r) => {
      settled = true;
      return r;
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(settled).toBe(false);
    const opened = await pending;
    expect(opened.status).toBe("ready");
    if (opened.status !== "ready") return;
    let listed = false;
    const listing = opened.book.listCategories().then((r) => {
      listed = true;
      return r;
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(listed).toBe(false);
    expect((await listing).ok).toBe(true);
  });
});

describe("収支の追加・更新・削除（BR2.1〜BR2.3）", () => {
  it("追加は id・登録日時・更新日時を付けて保存し、その月の一覧に出る", async () => {
    const { book } = await memoryBook();
    const food = await categoryId(book, "食費");
    const added = await book.addTransaction(fakeInput({ categoryId: food, amount: "１,２００" }));
    expect(added).toEqual({
      ok: true,
      value: {
        id: "id-0011",
        date: "2026-10-05",
        type: "expense",
        categoryId: food,
        amount: 1200,
        memo: "架空のランチ",
        createdAt: FIXED_NOW_ISO,
        updatedAt: FIXED_NOW_ISO,
      },
    });
    const listed = await book.listTransactions("2026-10");
    expect(listed.ok && listed.value.map((t) => t.id)).toEqual(["id-0011"]);
  });

  it("追加の検証エラー（入力エラー）は保存に触れず、項目の順に返す", async () => {
    const { book, storage } = await memoryBook();
    const before = await dumpStores(storage.handle);
    const result = await book.addTransaction(
      fakeInput({ date: "2026-02-30", amount: "abc", memo: "架".repeat(201) }),
    );
    expectValidationCodes(result, ["date:invalid-date", "amount:not-integer", "memo:too-long"]);
    expect(await dumpStores(storage.handle)).toEqual(before);
  });

  it("カテゴリがない → category-missing、種別が違う → category-type-mismatch（保存領域は変わらない）", async () => {
    const { book, storage } = await memoryBook();
    const salary = await categoryId(book, "給与");
    const before = await dumpStores(storage.handle);
    expectRule(await book.addTransaction(fakeInput({ categoryId: "c-消えた" })), {
      code: "category-missing",
    });
    expectRule(await book.addTransaction(fakeInput({ categoryId: salary })), {
      code: "category-type-mismatch",
    });
    expect(await dumpStores(storage.handle)).toEqual(before);
  });

  it("更新は id と登録日時を残し、日付を別の月に変えると新しい月の一覧に移る（AC2.4.1〜AC2.4.3）", async () => {
    const { book } = await memoryBook({ now: steppingNow() });
    const food = await categoryId(book, "食費");
    const added = await book.addTransaction(fakeInput({ categoryId: food }));
    if (!added.ok) throw new Error("追加できませんでした");
    const updated = await book.updateTransaction(
      added.value.id,
      fakeInput({ categoryId: food, date: "2026-11-03", amount: 3000, memo: "架空の夕食" }),
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.id).toBe(added.value.id);
    expect(updated.value.createdAt).toBe(added.value.createdAt);
    expect(updated.value.updatedAt > added.value.updatedAt).toBe(true);
    expect(await book.listTransactions("2026-10")).toEqual({ ok: true, value: [] });
    expect(await book.listTransactions("2026-11")).toEqual({ ok: true, value: [updated.value] });
  });

  it("更新の失敗: ない id は not-found、検証エラー、カテゴリがない（保存領域は変わらない）", async () => {
    const { book, storage } = await memoryBook();
    const food = await categoryId(book, "食費");
    const added = await book.addTransaction(fakeInput({ categoryId: food }));
    if (!added.ok) throw new Error("追加できませんでした");
    const before = await dumpStores(storage.handle);
    expectRule(await book.updateTransaction("tx-ない", fakeInput({ categoryId: food })), {
      code: "not-found",
    });
    expectRule(
      await book.updateTransaction(1 as unknown as string, fakeInput({ categoryId: food })),
      {
        code: "not-found",
      },
    );
    expectValidationCodes(await book.updateTransaction(added.value.id, fakeInput({ date: "" })), [
      "date:required",
    ]);
    expectRule(await book.updateTransaction(added.value.id, fakeInput({ categoryId: "c-ない" })), {
      code: "category-missing",
    });
    expect(await dumpStores(storage.handle)).toEqual(before);
  });

  it("削除は存在を確かめて消し、ない id は not-found", async () => {
    const { book } = await memoryBook();
    const food = await categoryId(book, "食費");
    const added = await book.addTransaction(fakeInput({ categoryId: food }));
    if (!added.ok) throw new Error("追加できませんでした");
    expect(await book.deleteTransaction(added.value.id)).toEqual({ ok: true, value: undefined });
    expect(await book.listTransactions("2026-10")).toEqual({ ok: true, value: [] });
    expectRule(await book.deleteTransaction(added.value.id), { code: "not-found" });
    expectRule(await book.deleteTransaction(undefined as unknown as string), { code: "not-found" });
  });
});

describe("収支の一覧（BR2.4、BR2.5）", () => {
  async function bookWithEntries() {
    const { book } = await memoryBook({ now: steppingNow() });
    const food = await categoryId(book, "食費");
    for (const date of ["2026-10-05", "2026-10-20", "2026-10-05", "2026-09-30"]) {
      const added = await book.addTransaction(fakeInput({ categoryId: food, date }));
      if (!added.ok) throw new Error("追加できませんでした");
    }
    return book;
  }

  it("対象月は日付の新しい順、同じ日付は登録日時の新しい順", async () => {
    const book = await bookWithEntries();
    const listed = await book.listTransactions("2026-10");
    expect(listed.ok && listed.value.map((t) => `${t.date}:${t.id}`)).toEqual([
      "2026-10-20:id-0012",
      "2026-10-05:id-0013",
      "2026-10-05:id-0011",
    ]);
  });

  it("書き出し用は全期間または対象月を古い順で返す", async () => {
    const book = await bookWithEntries();
    const all = await book.listAllTransactions("all");
    expect(all.ok && all.value.map((t) => t.id)).toEqual([
      "id-0014",
      "id-0011",
      "id-0013",
      "id-0012",
    ]);
    const october = await book.listAllTransactions({ month: "2026-10" });
    expect(october.ok && october.value.map((t) => t.id)).toEqual(["id-0011", "id-0013", "id-0012"]);
  });

  it("収支のない月は空の配列（空データ）", async () => {
    const book = await bookWithEntries();
    expect(await book.listTransactions("2027-01")).toEqual({ ok: true, value: [] });
    expect(await book.listAllTransactions({ month: "2027-01" })).toEqual({ ok: true, value: [] });
  });

  it("不正な月は validation（field month、code invalid-month、固定の文言）", async () => {
    const { book } = await memoryBook();
    const invalid = {
      ok: false,
      error: {
        kind: "validation",
        errors: [{ field: "month", code: "invalid-month", message: CORE_MESSAGES.monthInvalid }],
      },
    };
    expect(await book.listTransactions("2026-13")).toEqual(invalid);
    expect(await book.listTransactions("1999-12")).toEqual(invalid);
    expect(await book.listAllTransactions({ month: "2026/10" })).toEqual(invalid);
    expect(await book.listAllTransactions(null as unknown as "all")).toEqual(invalid);
    expect(await book.getEffectiveBudgets(202610 as unknown as string)).toEqual(invalid);
  });
});

describe("カテゴリの追加・名前変更（BR3.2、BR3.3）", () => {
  it("追加は同じ種別の末尾に加える（AC3.2.1）", async () => {
    const { book } = await memoryBook();
    const added = await book.addCategory("expense", "  架空の趣味 ");
    expect(added).toEqual({
      ok: true,
      value: {
        id: "id-0011",
        type: "expense",
        name: "架空の趣味",
        sortOrder: 7,
        createdAt: FIXED_NOW_ISO,
      },
    });
    const names = (await categoriesOf(book)).map((c) => c.name);
    expect(names.indexOf("架空の趣味")).toBe(7);
  });

  it("追加の検証エラー: 不正な種別・重複（全角・大文字小文字）・空白・21文字（入力エラー）", async () => {
    const { book, storage } = await memoryBook();
    expect(await book.addCategory("Expense" as "expense", "架空")).toEqual({
      ok: false,
      error: {
        kind: "validation",
        errors: [{ field: "type", code: "invalid-type", message: CORE_MESSAGES.typeInvalid }],
      },
    });
    const first = await book.addCategory("expense", "Cafe");
    expect(first.ok).toBe(true);
    const before = await dumpStores(storage.handle);
    expectValidationCodes(await book.addCategory("expense", "ＣＡＦＥ"), ["name:duplicate-name"]);
    expectValidationCodes(await book.addCategory("expense", " 食費 "), ["name:duplicate-name"]);
    expectValidationCodes(await book.addCategory("income", "　"), ["name:blank"]);
    expectValidationCodes(await book.addCategory("income", "架".repeat(21)), ["name:too-long"]);
    expect(await dumpStores(storage.handle)).toEqual(before);
  });

  it("名前変更は名前だけを変え、自分自身との比較は除く（AC3.3.1）", async () => {
    const { book } = await memoryBook();
    const added = await book.addCategory("expense", "cafe");
    if (!added.ok) throw new Error("追加できませんでした");
    expect(await book.renameCategory(added.value.id, "CAFE")).toEqual({
      ok: true,
      value: { ...added.value, name: "CAFE" },
    });
  });

  it("名前変更の失敗: ない id は not-found、ほかと重複は duplicate-name（AC3.3.2）", async () => {
    const { book, storage } = await memoryBook();
    const daily = await categoryId(book, "日用品");
    const before = await dumpStores(storage.handle);
    expectRule(await book.renameCategory("c-ない", "架空"), { code: "not-found" });
    expectValidationCodes(await book.renameCategory(daily, "食費"), ["name:duplicate-name"]);
    expectValidationCodes(await book.renameCategory(daily, ""), ["name:blank"]);
    expect(await dumpStores(storage.handle)).toEqual(before);
  });
});

describe("カテゴリの削除と使用件数（BR2.6、BR3.4、AC3.4.1〜AC3.4.3）", () => {
  it("使用件数は収支の件数と予算の行数を返し、削除の deletedBudgets と一致する", async () => {
    const { book } = await memoryBook();
    const food = await categoryId(book, "食費");
    const hobby = await book.addCategory("expense", "架空の趣味");
    if (!hobby.ok) throw new Error("追加できませんでした");
    await book.addTransaction(fakeInput({ categoryId: food }));
    await book.setBudget(hobby.value.id, "2026-08", 5000);
    await book.setBudget(hobby.value.id, "2026-10", 6000);
    const usage = await book.getCategoryUsage();
    expect(usage.ok).toBe(true);
    if (!usage.ok) return;
    expect(usage.value[food]).toEqual({ transactions: 1, budgets: 0 });
    expect(usage.value[hobby.value.id]).toEqual({ transactions: 0, budgets: 2 });
    expect(Object.keys(usage.value)).toHaveLength(11);
    const deleted = await book.deleteCategory(hobby.value.id);
    expect(deleted).toEqual({
      ok: true,
      value: { deletedBudgets: usage.value[hobby.value.id]?.budgets },
    });
    const effective = await book.getEffectiveBudgets("2026-10");
    expect(effective.ok && effective.value.some((e) => e.categoryId === hobby.value.id)).toBe(
      false,
    );
  });

  it("削除の拒否: not-found → category-in-use（件数）→ last-category-of-type の順", async () => {
    const { book, storage } = await memoryBook();
    const salary = await categoryId(book, "給与");
    await book.addTransaction(fakeInput({ type: "income", categoryId: salary }));
    await book.addTransaction(
      fakeInput({ type: "income", categoryId: salary, date: "2026-10-25" }),
    );
    expectRule(await book.deleteCategory("c-ない"), { code: "not-found" });
    expectRule(await book.deleteCategory(salary), { code: "category-in-use", count: 2 });
    expect((await book.deleteCategory(await categoryId(book, "副収入"))).ok).toBe(true);
    const other = await categoryId(book, "その他収入");
    expect(await book.deleteCategory(other)).toEqual({ ok: true, value: { deletedBudgets: 0 } });
    const before = await dumpStores(storage.handle);
    // 給与だけが残った収入カテゴリ。使用中の判定が先に来る。
    expectRule(await book.deleteCategory(salary), { code: "category-in-use", count: 2 });
    const listed = await book.listTransactions("2026-10");
    for (const t of listed.ok ? listed.value : []) await book.deleteTransaction(t.id);
    expectRule(await book.deleteCategory(salary), {
      code: "last-category-of-type",
      type: "income",
    });
    expect((await dumpStores(storage.handle)).categories).toEqual(before.categories);
  });
});

describe("予算の設定・解除・その月の予算（BR4.1〜BR4.4、US4.1〜US4.3）", () => {
  it("予算のない月は全支出カテゴリが none（空データ）", async () => {
    const { book } = await memoryBook();
    const effective = await book.getEffectiveBudgets("2026-10");
    expect(effective.ok && effective.value).toHaveLength(7);
    expect(
      effective.ok && effective.value.every((e) => e.source.kind === "none" && e.amount === null),
    ).toBe(true);
  });

  it("設定・置き換え・引き継ぎ・解除（AC4.1.1、AC4.2.1、AC4.3.1・AC4.3.2）", async () => {
    const { book } = await memoryBook();
    const food = await categoryId(book, "食費");
    const foodBudget = async (month: string) => {
      const effective = await book.getEffectiveBudgets(month);
      return effective.ok ? effective.value.find((e) => e.categoryId === food) : undefined;
    };
    expect(await book.setBudget(food, "2026-08", "30,000")).toEqual({ ok: true, value: undefined });
    expect(await book.setBudget(food, "2026-10", 1)).toEqual({ ok: true, value: undefined });
    expect(await book.setBudget(food, "2026-10", 25000)).toEqual({ ok: true, value: undefined });
    expect((await foodBudget("2026-09"))?.source).toEqual({ kind: "carried", from: "2026-08" });
    expect(await foodBudget("2026-10")).toEqual({
      categoryId: food,
      month: "2026-10",
      amount: 25000,
      source: { kind: "set" },
    });
    expect((await foodBudget("2026-07"))?.source).toEqual({ kind: "none" });
    expect(await book.clearBudget(food, "2026-10")).toEqual({ ok: true, value: undefined });
    expect(await foodBudget("2026-10")).toEqual({
      categoryId: food,
      month: "2026-10",
      amount: 30000,
      source: { kind: "carried", from: "2026-08" },
    });
  });

  it("0 円の設定は設定として扱う", async () => {
    const { book } = await memoryBook();
    const food = await categoryId(book, "食費");
    await book.setBudget(food, "2026-10", "0");
    const effective = await book.getEffectiveBudgets("2026-10");
    expect(effective.ok && effective.value[0]).toEqual({
      categoryId: food,
      month: "2026-10",
      amount: 0,
      source: { kind: "set" },
    });
  });

  it("設定の検証エラー: -1・12.5・abc、不正な月と金額は月 → 金額の順（入力エラー）", async () => {
    const { book, storage } = await memoryBook();
    const food = await categoryId(book, "食費");
    const before = await dumpStores(storage.handle);
    expectValidationCodes(await book.setBudget(food, "2026-10", -1), ["budgetAmount:out-of-range"]);
    expectValidationCodes(await book.setBudget(food, "2026-10", "12.5"), [
      "budgetAmount:not-integer",
    ]);
    expectValidationCodes(await book.setBudget(food, "2026-10", "abc"), [
      "budgetAmount:not-integer",
    ]);
    expectValidationCodes(await book.setBudget(food, "2026-13", ""), [
      "month:invalid-month",
      "budgetAmount:required",
    ]);
    expectValidationCodes(await book.setBudget(food, "2026-00", 100), ["month:invalid-month"]);
    expect(await dumpStores(storage.handle)).toEqual(before);
  });

  it("設定の規則違反: カテゴリがない → category-missing、収入 → category-type-mismatch", async () => {
    const { book, storage } = await memoryBook();
    const salary = await categoryId(book, "給与");
    const before = await dumpStores(storage.handle);
    expectRule(await book.setBudget("c-ない", "2026-10", 100), { code: "category-missing" });
    expectRule(await book.setBudget(null as unknown as string, "2026-10", 100), {
      code: "category-missing",
    });
    expectRule(await book.setBudget(salary, "2026-10", 100), { code: "category-type-mismatch" });
    expect(await dumpStores(storage.handle)).toEqual(before);
  });

  it("解除の失敗: 設定がない月は budget-not-set、不正な月は validation", async () => {
    const { book } = await memoryBook();
    const food = await categoryId(book, "食費");
    await book.setBudget(food, "2026-08", 30000);
    expectRule(await book.clearBudget(food, "2026-09"), { code: "budget-not-set" });
    expectRule(await book.clearBudget(42 as unknown as string, "2026-08"), {
      code: "budget-not-set",
    });
    expectValidationCodes(await book.clearBudget(food, "26-08"), ["month:invalid-month"]);
  });
});

describe("CSV の取り込みの確定（BR5.1、AC7.2.1・AC7.2.3・AC7.2.4）", () => {
  it("全行を行の順に追加し、追加した件数を返す", async () => {
    const { book } = await memoryBook();
    const food = await categoryId(book, "食費");
    const salary = await categoryId(book, "給与");
    const result = await book.importTransactions([
      { line: 2, input: fakeInput({ categoryId: food, date: "2026-10-01" }) },
      { line: 3, input: fakeInput({ type: "income", categoryId: salary, amount: 250000 }) },
      { line: 4, input: fakeInput({ categoryId: food, memo: "" }) },
    ]);
    expect(result).toEqual({ ok: true, value: { added: 3 } });
    const all = await book.listAllTransactions("all");
    expect(all.ok && all.value.map((t) => t.id)).toEqual(["id-0011", "id-0012", "id-0013"]);
  });

  it("検証エラーの行があれば1件も追加せず、最初に失敗した行の line を返す（入力エラー）", async () => {
    const { book, storage } = await memoryBook();
    const food = await categoryId(book, "食費");
    const before = await dumpStores(storage.handle);
    const result = await book.importTransactions([
      { line: 2, input: fakeInput({ categoryId: food }) },
      { line: 3, input: fakeInput({ categoryId: food, amount: "0" }) },
      { line: 4, input: fakeInput({ categoryId: food, date: "x" }) },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === "validation") {
      expect(result.error.line).toBe(3);
      expect(result.error.errors.map((e) => e.code)).toEqual(["out-of-range"]);
    } else {
      throw new Error("validation ではありません");
    }
    expect(await dumpStores(storage.handle)).toEqual(before);
  });

  it("カテゴリがない・種別が違う行があれば1件も追加せず、その行を昇順で返す", async () => {
    const { book, storage } = await memoryBook();
    const food = await categoryId(book, "食費");
    const before = await dumpStores(storage.handle);
    expectRule(
      await book.importTransactions([
        { line: 7, input: fakeInput({ categoryId: "c-消えた" }) },
        { line: 2, input: fakeInput({ categoryId: food }) },
        { line: 5, input: fakeInput({ type: "income", categoryId: food }) },
      ]),
      { code: "import-category-missing", lines: [5, 7] },
    );
    expect(await dumpStores(storage.handle)).toEqual(before);
  });

  it("0行なら保存に触れず { added: 0 }（保存失敗の指定があっても成功）", async () => {
    const { book, storage } = await memoryBook();
    storage.failWrites = true;
    expect(await book.importTransactions([])).toEqual({ ok: true, value: { added: 0 } });
  });
});

describe("保存失敗と想定外の例外（BR6.1、BR6.2、NFR4.1・NFR4.3）", () => {
  it("書き込みの失敗（failWrites）はすべての書き込み操作で storage になり、保存領域は変わらない", async () => {
    const { book, storage } = await memoryBook();
    const food = await categoryId(book, "食費");
    const added = await book.addTransaction(fakeInput({ categoryId: food }));
    await book.setBudget(food, "2026-10", 100);
    if (!added.ok) throw new Error("追加できませんでした");
    const before = await dumpStores(storage.handle);
    storage.failWrites = true;
    const results = [
      await book.addTransaction(fakeInput({ categoryId: food })),
      await book.updateTransaction(added.value.id, fakeInput({ categoryId: food })),
      await book.deleteTransaction(added.value.id),
      await book.addCategory("expense", "架空の新規"),
      await book.renameCategory(food, "架空の改名"),
      await book.deleteCategory(food),
      await book.setBudget(food, "2026-11", 200),
      await book.clearBudget(food, "2026-10"),
      await book.importTransactions([{ line: 2, input: fakeInput({ categoryId: food }) }]),
    ];
    for (const result of results) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatchObject({ kind: "storage" });
    }
    expect(await dumpStores(storage.handle)).toEqual(before);
    storage.failWrites = false;
    expect((await book.addCategory("expense", "架空の新規")).ok).toBe(true);
  });

  it("読み取りの失敗（failReads）はすべての読み取り操作で storage になる", async () => {
    const { book, storage } = await memoryBook();
    storage.failReads = true;
    const results = [
      await book.listTransactions("2026-10"),
      await book.listAllTransactions("all"),
      await book.listCategories(),
      await book.getCategoryUsage(),
      await book.getEffectiveBudgets("2026-10"),
    ];
    for (const result of results) {
      expect(result).toEqual({
        ok: false,
        error: { kind: "storage", message: "読み取りに失敗しました（failReads の指定）" },
      });
    }
  });

  it("書き込み処理の中の想定外の例外（id・時計の失敗）は storage になり、何も保存されない", async () => {
    let failing = false;
    const { book, storage } = await memoryBook({
      now: () => {
        if (failing) throw new Error("架空の時計の失敗");
        return new Date(FIXED_NOW_ISO);
      },
    });
    const food = await categoryId(book, "食費");
    const before = await dumpStores(storage.handle);
    failing = true;
    const result = await book.addTransaction(fakeInput({ categoryId: food }));
    expect(result.ok === false && result.error.kind).toBe("storage");
    expect(await dumpStores(storage.handle)).toEqual(before);
  });

  it("保存の窓口そのものが例外を投げても、Book は例外を投げず storage を返す", async () => {
    const book = await readyBook({
      storage: staticHandle({
        write: () => Promise.resolve({ ok: true, value: undefined as never }),
        read: () => {
          throw new Error("架空の読み取りの例外");
        },
      }),
    });
    expect(await book.listCategories()).toEqual({
      ok: false,
      error: {
        kind: "storage",
        message: `${CORE_MESSAGES.unexpectedRead}（架空の読み取りの例外）`,
      },
    });
    const throwingWrite = await readyBook({
      storage: staticHandle({
        write: vi
          .fn()
          .mockResolvedValueOnce({ ok: true, value: undefined })
          .mockRejectedValue(new Error("架空の書き込みの例外")),
      }),
    });
    expect(await throwingWrite.deleteTransaction("tx-1")).toEqual({
      ok: false,
      error: {
        kind: "storage",
        message: `${CORE_MESSAGES.unexpectedWrite}（架空の書き込みの例外）`,
      },
    });
  });

  it("保存の newer-version は読み取り・書き込みとも newer-version になる", async () => {
    const book = await readyBook({
      storage: staticHandle({
        write: vi
          .fn()
          .mockResolvedValueOnce({ ok: true, value: undefined })
          .mockResolvedValue({ ok: false, error: { kind: "newer-version" } }),
      }),
    });
    expect(await book.listCategories()).toEqual({ ok: false, error: { kind: "newer-version" } });
    expect(await book.addCategory("expense", "架空")).toEqual({
      ok: false,
      error: { kind: "newer-version" },
    });
  });

  it("壊れた入力（null の収支・行）でも例外を投げない", async () => {
    const { book } = await memoryBook({ now: fixedNow() });
    const nullInput = await book.addTransaction(
      null as unknown as Parameters<Book["addTransaction"]>[0],
    );
    expect(nullInput.ok === false && nullInput.error.kind).toBe("validation");
    const nullRow = await book.importTransactions([
      null as unknown as { line: number; input: never },
    ]);
    expect(nullRow.ok === false && nullRow.error.kind).toBe("storage");
  });
});
