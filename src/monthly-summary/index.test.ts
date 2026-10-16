// 公開窓口（C4）のテスト。U7 が使う2つの関数が取れ、公開窓口経由でも動くことを確かめる。
import { describe, expect, it } from "vitest";
import * as publicApi from "./index";
import type { ExpenseRow, IncomeRow, MonthlySummary } from "./index";
import { FOOD, SAMPLE_CATEGORIES, memoryBook, tx } from "./test-fixtures";

describe("monthly-summary の公開窓口", () => {
  it("公開するのは computeMonthlySummary と getMonthlySummary の2つの関数だけ", () => {
    expect(Object.keys(publicApi).sort()).toEqual(["computeMonthlySummary", "getMonthlySummary"]);
    expect(typeof publicApi.computeMonthlySummary).toBe("function");
    expect(typeof publicApi.getMonthlySummary).toBe("function");
  });

  it("公開窓口の computeMonthlySummary は C4 の型どおりの値を返す", () => {
    const summary: MonthlySummary = publicApi.computeMonthlySummary({
      month: "2026-10",
      transactions: [tx(FOOD, 1200)],
      categories: SAMPLE_CATEGORIES,
      budgets: [],
    });
    const expenseRow: ExpenseRow | undefined = summary.expenseRows[0];
    const incomeRow: IncomeRow | undefined = summary.incomeRows[0];
    expect(expenseRow?.actual).toBe(1200);
    expect(incomeRow?.actual).toBe(0);
  });

  it("公開窓口の getMonthlySummary は U4 の Book から集計を返す（空の家計簿は支出7・収入3の行）", async () => {
    const { book } = await memoryBook();
    const result = await publicApi.getMonthlySummary(book, "2026-10");
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.hasTransactions).toBe(false);
    expect(result.ok && result.value.expenseRows).toHaveLength(7);
    expect(result.ok && result.value.incomeRows).toHaveLength(3);
  });
});
