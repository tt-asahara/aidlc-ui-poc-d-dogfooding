// 契約 C4（月次集計）の型。contract-summary.md の C4 と一致させる。
// 画面の表示（3桁区切り・「赤字」「超過」の文字など）は U7 が行い、U5 は数と真偽だけを返す。
import type { YearMonth } from "../data-contract";
import type { BudgetSource } from "../bookkeeping-core";

/** 支出カテゴリ1件の行。 */
export interface ExpenseRow {
  categoryId: string;
  categoryName: string;
  /** 予算なしは null。0 は「予算 0 円」。 */
  budget: number | null;
  budgetSource: BudgetSource;
  /** 対象月のそのカテゴリの支出の合計。 */
  actual: number;
  /** 予算 − 実績。予算なしは null。負の値もある。 */
  remaining: number | null;
  /** 予算があり、実績が予算より大きいときだけ true（0 円予算も判定する）。 */
  over: boolean;
}

/** 収入カテゴリ1件の行。予算は持たない。 */
export interface IncomeRow {
  categoryId: string;
  categoryName: string;
  actual: number;
}

export interface MonthlySummary {
  month: YearMonth;
  incomeTotal: number;
  /** ExpenseRow.actual の合計と一致する。 */
  expenseTotal: number;
  /** incomeTotal − expenseTotal。負の値もある。 */
  balance: number;
  /** 支出カテゴリ全件（U4 の listCategories の並び）。 */
  expenseRows: ExpenseRow[];
  /** 収入カテゴリ全件（U4 の listCategories の並び）。 */
  incomeRows: IncomeRow[];
  /** 対象月に収支が1件以上あるか。 */
  hasTransactions: boolean;
}
