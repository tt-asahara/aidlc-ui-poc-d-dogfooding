// getMonthlySummary のテスト。U4 の openBook に U3 の差し替え（createMemoryStorage）を渡した Book と、
// メソッドを差し替えた Book（失敗・食い違い・例外の再現）を使う。偽のタイマーは使わない。
import { describe, expect, it } from "vitest";
import type { Category, Result, Transaction } from "../data-contract";
import type { Book, EffectiveBudget, OperationError } from "../bookkeeping-core";
import { getMonthlySummary } from "./getMonthlySummary";
import {
  FOOD,
  SALARY,
  SAMPLE_CATEGORIES,
  TRANSPORT,
  fakeInput,
  memoryBook,
  noBudget,
  stubbedBook,
  tx,
} from "./test-fixtures";

const MONTH = "2026-10";

const STORAGE_FAILURE: OperationError = { kind: "storage", message: "架空の読み取り失敗" };
const NEWER_VERSION: OperationError = { kind: "newer-version" };

function failure<T>(error: OperationError): Promise<Result<T, OperationError>> {
  return Promise.resolve({ ok: false, error });
}

function success<T>(value: T): Promise<Result<T, OperationError>> {
  return Promise.resolve({ ok: true, value });
}

/** U4 の初期カテゴリから、種別と名前でカテゴリを探す。 */
async function categoryOf(book: Book, type: Category["type"], index = 0): Promise<Category> {
  const listed = await book.listCategories();
  if (!listed.ok) throw new Error("カテゴリを読めませんでした");
  const found = listed.value.filter((c) => c.type === type)[index];
  if (found === undefined) throw new Error("カテゴリがありません");
  return found;
}

describe("getMonthlySummary: 正常", () => {
  it("U4 の Book から読んだ収支・カテゴリ・予算で集計し、対象月の分だけを数える（AC5.1.1、AC5.1.2）", async () => {
    const { book } = await memoryBook();
    const food = await categoryOf(book, "expense", 0);
    const transport = await categoryOf(book, "expense", 1);
    const salary = await categoryOf(book, "income", 0);
    for (const input of [
      fakeInput({ type: "income", categoryId: salary.id, amount: "250000" }),
      fakeInput({ categoryId: food.id, amount: "1200" }),
      fakeInput({ categoryId: transport.id, amount: "3000" }),
      fakeInput({ categoryId: food.id, amount: "999", date: "2026-09-30" }),
    ]) {
      const added = await book.addTransaction(input);
      expect(added.ok).toBe(true);
    }
    expect((await book.setBudget(food.id, MONTH, 1000)).ok).toBe(true);

    const result = await getMonthlySummary(book, MONTH);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      month: MONTH,
      incomeTotal: 250000,
      expenseTotal: 4200,
      balance: 245800,
      hasTransactions: true,
    });
    const foodRow = result.value.expenseRows.find((r) => r.categoryId === food.id);
    expect(foodRow).toMatchObject({
      budget: 1000,
      budgetSource: { kind: "set" },
      actual: 1200,
      remaining: -200,
      over: true,
    });
    // U4 の初期カテゴリ（支出7・収入3）が全件、U4 の並びで行になる。
    expect(result.value.expenseRows).toHaveLength(7);
    expect(result.value.incomeRows).toHaveLength(3);
  });

  it("収支のない月は合計 0・hasTransactions false で、予算だけが行に出る（AC5.4.1、AC5.4.2）", async () => {
    const { book } = await memoryBook();
    const food = await categoryOf(book, "expense", 0);
    expect((await book.setBudget(food.id, MONTH, 30000)).ok).toBe(true);
    const result = await getMonthlySummary(book, MONTH);
    expect(result.ok && result.value).toMatchObject({
      incomeTotal: 0,
      expenseTotal: 0,
      balance: 0,
      hasTransactions: false,
    });
    expect(result.ok && result.value.expenseRows[0]).toMatchObject({
      budget: 30000,
      actual: 0,
      remaining: 30000,
    });
  });

  it("予算の引き継ぎは U4 の結果のまま行に出る（AC5.1.4: 前月は none、設定月は set、翌月は carried）", async () => {
    const { book } = await memoryBook();
    const food = await categoryOf(book, "expense", 0);
    expect((await book.setBudget(food.id, "2026-08", 25000)).ok).toBe(true);

    const budgetOf = async (month: string) => {
      const result = await getMonthlySummary(book, month);
      if (!result.ok) throw new Error("集計を取得できませんでした");
      return result.value.expenseRows.find((r) => r.categoryId === food.id);
    };
    expect(await budgetOf("2026-07")).toMatchObject({
      budget: null,
      budgetSource: { kind: "none" },
    });
    expect(await budgetOf("2026-08")).toMatchObject({
      budget: 25000,
      budgetSource: { kind: "set" },
    });
    expect(await budgetOf("2026-09")).toMatchObject({
      budget: 25000,
      budgetSource: { kind: "carried", from: "2026-08" },
    });
    expect(await budgetOf("2026-11")).toMatchObject({
      budget: 25000,
      budgetSource: { kind: "carried", from: "2026-08" },
    });
  });
});

describe("getMonthlySummary: 失敗（入力エラー・読み込みの失敗）", () => {
  it("不正な月は U4 の validation をそのまま返す", async () => {
    const { book } = await memoryBook();
    for (const month of ["2026-13", "2026-1", "", "架空"]) {
      const result = await getMonthlySummary(book, month);
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.kind).toBe("validation");
    }
  });

  it("failReads（読み込みの失敗）は storage の失敗になる", async () => {
    const { book, setFailReads } = await memoryBook();
    setFailReads(true);
    const result = await getMonthlySummary(book, MONTH);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("storage");
  });

  it("3つの読み取りそれぞれの失敗が、その OperationError のまま返る（版上げも同じ）", async () => {
    const { book } = await memoryBook();
    const okCategories = () => success<Category[]>(SAMPLE_CATEGORIES);
    const okBudgets = () => success<EffectiveBudget[]>([]);
    const okTransactions = () => success<Transaction[]>([]);

    const cases: [string, Partial<Book>, OperationError][] = [
      ["listCategories", { listCategories: () => failure(STORAGE_FAILURE) }, STORAGE_FAILURE],
      [
        "getEffectiveBudgets",
        {
          listCategories: okCategories,
          getEffectiveBudgets: () => failure(NEWER_VERSION),
        },
        NEWER_VERSION,
      ],
      [
        "listTransactions",
        {
          listCategories: okCategories,
          getEffectiveBudgets: okBudgets,
          listTransactions: () => failure(STORAGE_FAILURE),
        },
        STORAGE_FAILURE,
      ],
    ];
    for (const [, overrides, expected] of cases) {
      const result = await getMonthlySummary(stubbedBook(book, overrides), MONTH);
      expect(result).toEqual({ ok: false, error: expected });
    }
    // 3つとも成功すれば集計が返る（失敗の組み合わせの対照）。
    const allOk = await getMonthlySummary(
      stubbedBook(book, {
        listCategories: okCategories,
        getEffectiveBudgets: okBudgets,
        listTransactions: okTransactions,
      }),
      MONTH,
    );
    expect(allOk.ok).toBe(true);
  });

  it("読み取りは categories → budgets → transactions の順に1つずつ行い、失敗した後は次を読まない", async () => {
    const { book } = await memoryBook();
    const calls: string[] = [];
    const recording = stubbedBook(book, {
      listCategories: () => {
        calls.push("categories");
        return success<Category[]>(SAMPLE_CATEGORIES);
      },
      getEffectiveBudgets: () => {
        calls.push("budgets");
        return failure(STORAGE_FAILURE);
      },
      listTransactions: () => {
        calls.push("transactions");
        return success<Transaction[]>([]);
      },
    });
    await getMonthlySummary(recording, MONTH);
    expect(calls).toEqual(["categories", "budgets"]);

    calls.length = 0;
    const ordered = stubbedBook(book, {
      listCategories: () => {
        calls.push("categories");
        return success<Category[]>(SAMPLE_CATEGORIES);
      },
      getEffectiveBudgets: () => {
        calls.push("budgets");
        return success<EffectiveBudget[]>([]);
      },
      listTransactions: () => {
        calls.push("transactions");
        return success<Transaction[]>([]);
      },
    });
    await getMonthlySummary(ordered, MONTH);
    expect(calls).toEqual(["categories", "budgets", "transactions"]);
  });
});

describe("getMonthlySummary: 読み込み中", () => {
  it("差し替えの delayMs の間は結果が未完了で、待てば集計が返る", async () => {
    const { book } = await memoryBook({ delayMs: 40 });
    const pending = getMonthlySummary(book, MONTH);
    const PENDING = Symbol("pending");
    const early = await Promise.race([
      pending,
      new Promise<typeof PENDING>((resolve) => setTimeout(() => resolve(PENDING), 15)),
    ]);
    expect(early).toBe(PENDING);
    const settled = await pending;
    expect(settled.ok).toBe(true);
  });
});

describe("getMonthlySummary: 食い違いと例外", () => {
  it("収支のカテゴリが一覧にないときは category-missing（一部が抜けた集計を返さない）", async () => {
    const { book } = await memoryBook();
    const stub = stubbedBook(book, {
      listCategories: () => success<Category[]>(SAMPLE_CATEGORIES),
      getEffectiveBudgets: () => success<EffectiveBudget[]>([noBudget(FOOD.id)]),
      listTransactions: () =>
        success<Transaction[]>([tx(FOOD, 1000), tx({ ...FOOD, id: "cat-消えた" }, 500)]),
    });
    expect(await getMonthlySummary(stub, MONTH)).toEqual({
      ok: false,
      error: { kind: "rule", violation: { code: "category-missing" } },
    });
  });

  it("収支の種別が一覧のカテゴリの種別と違うときも category-missing にまとめる", async () => {
    const { book } = await memoryBook();
    const stub = stubbedBook(book, {
      listCategories: () => success<Category[]>(SAMPLE_CATEGORIES),
      getEffectiveBudgets: () => success<EffectiveBudget[]>([]),
      // 給与（収入カテゴリ）の id で種別が支出の収支。
      listTransactions: () =>
        success<Transaction[]>([tx(SALARY, 100, "2026-10-05", { type: "expense" })]),
    });
    const result = await getMonthlySummary(stub, MONTH);
    expect(result).toEqual({
      ok: false,
      error: { kind: "rule", violation: { code: "category-missing" } },
    });
  });

  it("予算だけが食い違う（予算の行がないカテゴリ）ときは、そのまま集計する", async () => {
    const { book } = await memoryBook();
    const stub = stubbedBook(book, {
      listCategories: () => success<Category[]>(SAMPLE_CATEGORIES),
      getEffectiveBudgets: () => success<EffectiveBudget[]>([]),
      listTransactions: () => success<Transaction[]>([tx(TRANSPORT, 800)]),
    });
    const result = await getMonthlySummary(stub, MONTH);
    expect(result.ok && result.value.expenseTotal).toBe(800);
    expect(result.ok && result.value.expenseRows[1]).toMatchObject({
      categoryId: TRANSPORT.id,
      budget: null,
      remaining: null,
    });
  });

  it("想定外の例外（同期の throw も Promise の reject も）は投げ直さず、storage「データを読み込めませんでした」にする", async () => {
    const { book } = await memoryBook();
    const throwing = stubbedBook(book, {
      listCategories: () => {
        throw new Error("架空の想定外");
      },
    });
    const rejecting = stubbedBook(book, {
      listCategories: () => success<Category[]>(SAMPLE_CATEGORIES),
      getEffectiveBudgets: () => Promise.reject(new Error("架空の想定外の reject")),
    });
    const expected = {
      ok: false,
      error: { kind: "storage", message: "データを読み込めませんでした" },
    };
    expect(await getMonthlySummary(throwing, MONTH)).toEqual(expected);
    expect(await getMonthlySummary(rejecting, MONTH)).toEqual(expected);
  });
});
