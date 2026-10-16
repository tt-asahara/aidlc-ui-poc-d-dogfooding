// computeMonthlySummary のテスト（配列の入力だけ。保存は使わない）。
// functional-spec.md 2章の例の表の全行、境界、空の月、食い違う入力、最大の金額を確かめる。
import { describe, expect, it } from "vitest";
import { computeMonthlySummary } from "./compute";
import {
  FOOD,
  HOBBY,
  SALARY,
  SAMPLE_CATEGORIES,
  SIDE_INCOME,
  TRANSPORT,
  fakeCategory,
  fakeEffectiveBudget,
  noBudget,
  tx,
} from "./test-fixtures";
import type { EffectiveBudget } from "../bookkeeping-core";

const MONTH = "2026-10";

function budgetFor(
  category: { id: string },
  amount: number | null,
  source: EffectiveBudget["source"] = amount === null ? { kind: "none" } : { kind: "set" },
): EffectiveBudget {
  return { categoryId: category.id, month: MONTH, amount, source };
}

function rowOf(summary: ReturnType<typeof computeMonthlySummary>, id: string) {
  const row = summary.expenseRows.find((r) => r.categoryId === id);
  if (row === undefined) throw new Error(`支出の行がありません: ${id}`);
  return row;
}

describe("computeMonthlySummary: 受け入れ条件の例の表", () => {
  it("AC5.1.1: 給与 250,000・食費 1,200・交通費 3,000 は収入 250,000、支出 4,200、差額 245,800", () => {
    const summary = computeMonthlySummary({
      month: MONTH,
      transactions: [tx(SALARY, 250000), tx(FOOD, 1200), tx(TRANSPORT, 3000)],
      categories: SAMPLE_CATEGORIES,
      budgets: [],
    });
    expect(summary.incomeTotal).toBe(250000);
    expect(summary.expenseTotal).toBe(4200);
    expect(summary.balance).toBe(245800);
    expect(summary.hasTransactions).toBe(true);
    expect(summary.month).toBe(MONTH);
  });

  it("AC5.1.2: 2026-09-30 と 2026-10-01 の収支を混ぜても、対象月 2026-10 は 10月1日の分だけ数える", () => {
    const summary = computeMonthlySummary({
      month: MONTH,
      transactions: [tx(FOOD, 700, "2026-09-30"), tx(FOOD, 900, "2026-10-01")],
      categories: SAMPLE_CATEGORIES,
      budgets: [],
    });
    expect(summary.expenseTotal).toBe(900);
    expect(rowOf(summary, FOOD.id).actual).toBe(900);
  });

  it("AC5.1.3: 収入 1,000・支出 3,000 は差額 −2,000（負の値）", () => {
    const summary = computeMonthlySummary({
      month: MONTH,
      transactions: [tx(SALARY, 1000), tx(FOOD, 3000)],
      categories: SAMPLE_CATEGORIES,
      budgets: [],
    });
    expect(summary.balance).toBe(-2000);
  });

  it("AC5.2.1: 食費 予算 1,000・実績 1,200 は残り −200、超過", () => {
    const summary = computeMonthlySummary({
      month: MONTH,
      transactions: [tx(FOOD, 1200)],
      categories: SAMPLE_CATEGORIES,
      budgets: [budgetFor(FOOD, 1000)],
    });
    expect(rowOf(summary, FOOD.id)).toMatchObject({
      budget: 1000,
      actual: 1200,
      remaining: -200,
      over: true,
    });
  });

  it("AC5.2.2: 交通費 予算なし・実績 3,000 は予算 null、残り null、超過でない", () => {
    const summary = computeMonthlySummary({
      month: MONTH,
      transactions: [tx(TRANSPORT, 3000)],
      categories: SAMPLE_CATEGORIES,
      budgets: [noBudget(TRANSPORT.id)],
    });
    expect(rowOf(summary, TRANSPORT.id)).toMatchObject({
      budget: null,
      budgetSource: { kind: "none" },
      actual: 3000,
      remaining: null,
      over: false,
    });
  });

  it("AC5.3.1: 給与 250,000・副収入 20,000 は収入の行に両方出る（予算の項目は持たない）", () => {
    const summary = computeMonthlySummary({
      month: MONTH,
      transactions: [tx(SALARY, 250000), tx(SIDE_INCOME, 20000)],
      categories: SAMPLE_CATEGORIES,
      budgets: [],
    });
    expect(summary.incomeRows).toEqual([
      { categoryId: SALARY.id, categoryName: "架空の給与", actual: 250000 },
      { categoryId: SIDE_INCOME.id, categoryName: "架空の副収入", actual: 20000 },
    ]);
    expect(summary.incomeTotal).toBe(270000);
  });

  it("AC5.4.1・AC5.4.2: 収支なしの月は合計 0、hasTransactions false、食費 予算 30,000 は残り 30,000", () => {
    const summary = computeMonthlySummary({
      month: MONTH,
      transactions: [],
      categories: SAMPLE_CATEGORIES,
      budgets: [budgetFor(FOOD, 30000)],
    });
    expect(summary).toMatchObject({
      incomeTotal: 0,
      expenseTotal: 0,
      balance: 0,
      hasTransactions: false,
    });
    expect(rowOf(summary, FOOD.id)).toMatchObject({
      budget: 30000,
      actual: 0,
      remaining: 30000,
      over: false,
    });
    expect(summary.expenseRows).toHaveLength(3);
    expect(summary.incomeRows).toHaveLength(2);
  });

  it("AC4.3.2: 食費 予算 0・実績 500 は残り −500、超過（0 円予算は判定する）", () => {
    const summary = computeMonthlySummary({
      month: MONTH,
      transactions: [tx(FOOD, 500)],
      categories: SAMPLE_CATEGORIES,
      budgets: [budgetFor(FOOD, 0)],
    });
    expect(rowOf(summary, FOOD.id)).toMatchObject({ budget: 0, remaining: -500, over: true });
  });

  it("実績 = 予算（1,000 と 1,000）は残り 0 で、超過でない", () => {
    const summary = computeMonthlySummary({
      month: MONTH,
      transactions: [tx(FOOD, 400), tx(FOOD, 600)],
      categories: SAMPLE_CATEGORIES,
      budgets: [budgetFor(FOOD, 1000)],
    });
    expect(rowOf(summary, FOOD.id)).toMatchObject({ actual: 1000, remaining: 0, over: false });
  });
});

describe("computeMonthlySummary: 行・並び・予算の引き継ぎ", () => {
  it("実績も予算もないカテゴリも全件の行になり、カテゴリの並び（U4 の並び）を保つ", () => {
    // 入力の並びをそのまま保つ。sortOrder で並べ直さない。
    const categories = [HOBBY, FOOD, TRANSPORT, SIDE_INCOME, SALARY];
    const summary = computeMonthlySummary({
      month: MONTH,
      transactions: [tx(FOOD, 100)],
      categories,
      budgets: [],
    });
    expect(summary.expenseRows.map((r) => r.categoryId)).toEqual([HOBBY.id, FOOD.id, TRANSPORT.id]);
    expect(summary.incomeRows.map((r) => r.categoryId)).toEqual([SIDE_INCOME.id, SALARY.id]);
    expect(rowOf(summary, HOBBY.id)).toMatchObject({
      actual: 0,
      budget: null,
      budgetSource: { kind: "none" },
      remaining: null,
      over: false,
    });
  });

  it("予算の値と出所は U4 の結果のまま行に出る（carried の from も同じ）", () => {
    const carried = fakeEffectiveBudget({
      categoryId: FOOD.id,
      amount: 25000,
      source: { kind: "carried", from: "2026-08" },
    });
    const summary = computeMonthlySummary({
      month: MONTH,
      transactions: [tx(FOOD, 5000)],
      categories: SAMPLE_CATEGORIES,
      budgets: [carried],
    });
    expect(rowOf(summary, FOOD.id)).toMatchObject({
      budget: 25000,
      budgetSource: { kind: "carried", from: "2026-08" },
      remaining: 20000,
    });
  });

  it("同じカテゴリの複数の収支は足し合わせる", () => {
    const summary = computeMonthlySummary({
      month: MONTH,
      transactions: [tx(FOOD, 100), tx(FOOD, 250), tx(FOOD, 50, "2026-10-31")],
      categories: SAMPLE_CATEGORIES,
      budgets: [],
    });
    expect(rowOf(summary, FOOD.id).actual).toBe(400);
  });

  it("入力の配列を書き換えず、例外も投げない（空のカテゴリ・空の収支）", () => {
    const transactions = [tx(FOOD, 100)];
    const categories = [...SAMPLE_CATEGORIES];
    computeMonthlySummary({ month: MONTH, transactions, categories, budgets: [] });
    expect(transactions).toHaveLength(1);
    expect(categories).toEqual(SAMPLE_CATEGORIES);
    expect(
      computeMonthlySummary({ month: MONTH, transactions: [], categories: [], budgets: [] }),
    ).toEqual({
      month: MONTH,
      incomeTotal: 0,
      expenseTotal: 0,
      balance: 0,
      expenseRows: [],
      incomeRows: [],
      hasTransactions: false,
    });
  });
});

describe("computeMonthlySummary: 合計と行の和、食い違う入力、最大の金額", () => {
  it("合計は行の actual の和と必ず一致する", () => {
    const summary = computeMonthlySummary({
      month: MONTH,
      transactions: [
        tx(SALARY, 200000),
        tx(SIDE_INCOME, 1234),
        tx(FOOD, 1111),
        tx(TRANSPORT, 2222),
        tx(HOBBY, 3333),
      ],
      categories: SAMPLE_CATEGORIES,
      budgets: [],
    });
    expect(summary.expenseTotal).toBe(summary.expenseRows.reduce((s, r) => s + r.actual, 0));
    expect(summary.incomeTotal).toBe(summary.incomeRows.reduce((s, r) => s + r.actual, 0));
    expect(summary.balance).toBe(summary.incomeTotal - summary.expenseTotal);
  });

  it("食い違う入力（一覧にないカテゴリ・種別が違う収支）は、どの行にも合計にも入れない", () => {
    const summary = computeMonthlySummary({
      month: MONTH,
      transactions: [
        tx(FOOD, 1000),
        // 一覧にないカテゴリの支出。
        tx(fakeCategory({ id: "cat-消えた", name: "架空の消えたカテゴリ" }), 9999),
        // 食費（支出カテゴリ）の id で、種別だけ収入の収支。
        tx(FOOD, 7777, "2026-10-05", { type: "income" }),
        // 給与（収入カテゴリ）の id で、種別だけ支出の収支。
        tx(SALARY, 5555, "2026-10-05", { type: "expense" }),
      ],
      categories: SAMPLE_CATEGORIES,
      budgets: [],
    });
    expect(summary.expenseTotal).toBe(1000);
    expect(summary.incomeTotal).toBe(0);
    expect(summary.balance).toBe(-1000);
    expect(summary.expenseRows.reduce((s, r) => s + r.actual, 0)).toBe(summary.expenseTotal);
    expect(summary.incomeRows.reduce((s, r) => s + r.actual, 0)).toBe(summary.incomeTotal);
    expect(summary.expenseRows.map((r) => r.categoryId)).not.toContain("cat-消えた");
  });

  it("最大の金額 99,999,999 円 × 5,000 件の合計は安全な整数で、正確に求まる", () => {
    const transactions = Array.from({ length: 5000 }, (_, i) =>
      tx(i % 2 === 0 ? FOOD : SALARY, 99_999_999),
    );
    const summary = computeMonthlySummary({
      month: MONTH,
      transactions,
      categories: SAMPLE_CATEGORIES,
      budgets: [],
    });
    expect(summary.expenseTotal).toBe(2500 * 99_999_999);
    expect(summary.incomeTotal).toBe(2500 * 99_999_999);
    expect(summary.balance).toBe(0);
    const total = summary.incomeTotal + summary.expenseTotal;
    expect(total).toBe(5000 * 99_999_999);
    expect(Number.isSafeInteger(total)).toBe(true);
    expect(Number.isSafeInteger(summary.balance)).toBe(true);
  });
});
