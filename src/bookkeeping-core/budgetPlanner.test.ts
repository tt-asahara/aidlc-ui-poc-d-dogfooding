// 予算の持ち主のテスト（BR4.1〜BR4.4、NFR5.1、functional-spec.md 第2章の例の表）。
import { describe, expect, it } from "vitest";
import {
  buildBudget,
  checkBudgetCategory,
  checkBudgetClear,
  resolveEffectiveBudgets,
} from "./budgetPlanner";
import { fakeBudget, fakeCategory } from "./test-fixtures";

const food = fakeCategory({ id: "c-food", sortOrder: 0 });
const daily = fakeCategory({ id: "c-daily", name: "架空の日用品", sortOrder: 1 });
const salary = fakeCategory({ id: "c-salary", type: "income", name: "架空の給与", sortOrder: 0 });

function budget(month: string, amount: number, categoryId = "c-food") {
  return fakeBudget({ categoryId, month, amount });
}

function effectiveFor(budgets: ReturnType<typeof budget>[], month: string) {
  return resolveEffectiveBudgets([food], budgets, month)[0];
}

describe("その月に使う予算（BR4.3、W4 の例の表）", () => {
  it("2026-08: 30,000、2026-10: 25,000 で 2026-09 は 30,000（引き継ぎ、from 2026-08）", () => {
    const budgets = [budget("2026-08", 30000), budget("2026-10", 25000)];
    expect(effectiveFor(budgets, "2026-09")).toEqual({
      categoryId: "c-food",
      month: "2026-09",
      amount: 30000,
      source: { kind: "carried", from: "2026-08" },
    });
  });

  it("同上で 2026-11 は 25,000（引き継ぎ、from 2026-10）", () => {
    const budgets = [budget("2026-10", 25000), budget("2026-08", 30000)];
    expect(effectiveFor(budgets, "2026-11")).toEqual({
      categoryId: "c-food",
      month: "2026-11",
      amount: 25000,
      source: { kind: "carried", from: "2026-10" },
    });
  });

  it("2026-08: 30,000 だけで 2026-07 は予算なし（後の月の設定は前の月に使わない、空データ）", () => {
    expect(effectiveFor([budget("2026-08", 30000)], "2026-07")).toEqual({
      categoryId: "c-food",
      month: "2026-07",
      amount: null,
      source: { kind: "none" },
    });
    expect(effectiveFor([], "2026-07")?.source).toEqual({ kind: "none" });
  });

  it("2026-08: 30,000 で 2026-10 を解除した後の 2026-10 は 30,000（引き継ぎ、AC4.3.2）", () => {
    expect(effectiveFor([budget("2026-08", 30000)], "2026-10")).toEqual({
      categoryId: "c-food",
      month: "2026-10",
      amount: 30000,
      source: { kind: "carried", from: "2026-08" },
    });
  });

  it("2026-10: 0 は 0 円の設定（未設定とは区別する）", () => {
    expect(effectiveFor([budget("2026-10", 0)], "2026-10")).toEqual({
      categoryId: "c-food",
      month: "2026-10",
      amount: 0,
      source: { kind: "set" },
    });
  });

  it("ある月を変えても前の月は変わらず、後の月は新しい値を引き継ぐ（AC4.1.3、AC4.2.4）", () => {
    const before = [budget("2026-08", 30000)];
    const after = [budget("2026-08", 30000), budget("2026-10", 20000)];
    expect(effectiveFor(after, "2026-09")).toEqual(effectiveFor(before, "2026-09"));
    expect(effectiveFor(after, "2026-12")?.amount).toBe(20000);
    expect(effectiveFor(after, "2026-12")?.source).toEqual({ kind: "carried", from: "2026-10" });
  });

  it("支出カテゴリだけを、カテゴリの並びの順に返し、金額は整数そのまま（NFR5.1）", () => {
    const budgets = [budget("2026-10", 12345, "c-daily"), budget("2026-10", 99999999, "c-food")];
    const result = resolveEffectiveBudgets([salary, daily, food], budgets, "2026-10");
    expect(result.map((e) => [e.categoryId, e.amount])).toEqual([
      ["c-food", 99999999],
      ["c-daily", 12345],
    ]);
    expect(result.every((e) => Number.isInteger(e.amount))).toBe(true);
    expect(resolveEffectiveBudgets([salary], budgets, "2026-10")).toEqual([]);
  });
});

describe("その月に使う予算の並び（BR3.1 と同じ）", () => {
  it("同じ sortOrder なら createdAt、さらに id の昇順", () => {
    const early = fakeCategory({ id: "c-z", sortOrder: 2, createdAt: "2026-01-01T00:00:00.000Z" });
    const lateB = fakeCategory({ id: "c-b", sortOrder: 2, createdAt: "2026-02-01T00:00:00.000Z" });
    const lateA = fakeCategory({ id: "c-a", sortOrder: 2, createdAt: "2026-02-01T00:00:00.000Z" });
    const result = resolveEffectiveBudgets([lateB, early, lateA], [], "2026-10");
    expect(result.map((e) => e.categoryId)).toEqual(["c-z", "c-a", "c-b"]);
  });
});

describe("予算の設定・解除の判定（BR4.1、BR4.2）", () => {
  it("設定の値は [categoryId, month] と金額・更新日時", () => {
    expect(buildBudget("c-food", "2026-10", 5000, "2026-10-16T00:00:00.000Z")).toEqual({
      categoryId: "c-food",
      month: "2026-10",
      amount: 5000,
      updatedAt: "2026-10-16T00:00:00.000Z",
    });
  });

  it("支出カテゴリなら設定でき、ない・収入なら拒否する", () => {
    expect(checkBudgetCategory(food)).toBeUndefined();
    expect(checkBudgetCategory(undefined)).toEqual({ code: "category-missing" });
    expect(checkBudgetCategory(salary)).toEqual({ code: "category-type-mismatch" });
  });

  it("解除はその月に設定があるときだけ", () => {
    expect(checkBudgetClear(budget("2026-10", 1))).toBeUndefined();
    expect(checkBudgetClear(undefined)).toEqual({ code: "budget-not-set" });
  });
});
