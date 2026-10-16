// 月次集計の計算（契約 C4、規則 BR1.1〜BR3.2、BR4.2）。
// 同期の純粋な関数。入力だけから結果を作り、保存・時計・乱数・タイマーに触れない（eslint.config.js で守る）。
// 金額は整数の足し算・引き算だけで扱う。例外は投げない。
import type { Category, Transaction, YearMonth } from "../data-contract";
import type { BudgetSource, EffectiveBudget } from "../bookkeeping-core";
import type { ExpenseRow, IncomeRow, MonthlySummary } from "./types";

export interface SummaryInput {
  month: YearMonth;
  /** 対象月の収支（U4 の listTransactions の結果）。ほかの月が混ざっても数えない。 */
  transactions: readonly Transaction[];
  /** U4 の listCategories の結果（支出の後に収入、それぞれ sortOrder 順）。 */
  categories: readonly Category[];
  /** U4 の getEffectiveBudgets の結果（支出カテゴリ全件）。 */
  budgets: readonly EffectiveBudget[];
}

const NO_BUDGET_SOURCE: BudgetSource = { kind: "none" };

/** 日付（YYYY-MM-DD）の先頭7文字が対象月と一致するか（BR1.1）。 */
function isInMonth(transaction: Transaction, month: YearMonth): boolean {
  return transaction.date.slice(0, 7) === month;
}

/**
 * カテゴリごとの実績（対象月の amount の合計）を求める。
 * カテゴリの id と種別がどちらも一致する収支だけを数え、一致しない収支はどの行にも入れない（security-design.md 第1章）。
 */
function sumActualByCategory(
  monthTransactions: readonly Transaction[],
  categories: readonly Category[],
): Map<string, number> {
  const typeById = new Map<string, Category["type"]>();
  for (const category of categories) {
    if (!typeById.has(category.id)) typeById.set(category.id, category.type);
  }
  const sums = new Map<string, number>();
  for (const transaction of monthTransactions) {
    if (typeById.get(transaction.categoryId) !== transaction.type) continue;
    sums.set(transaction.categoryId, (sums.get(transaction.categoryId) ?? 0) + transaction.amount);
  }
  return sums;
}

function expenseRowOf(
  category: Category,
  actual: number,
  budget: EffectiveBudget | undefined,
): ExpenseRow {
  // 予算の値と出所は U4 の結果をそのまま使う（BR2.4）。行がなければ予算なし。
  const amount = budget?.amount ?? null;
  return {
    categoryId: category.id,
    categoryName: category.name,
    budget: amount,
    budgetSource: budget === undefined ? NO_BUDGET_SOURCE : { ...budget.source },
    actual,
    remaining: amount === null ? null : amount - actual,
    over: amount !== null && actual > amount,
  };
}

export function computeMonthlySummary(input: SummaryInput): MonthlySummary {
  const { month, categories } = input;
  const monthTransactions = input.transactions.filter((t) => isInMonth(t, month));
  const sums = sumActualByCategory(monthTransactions, categories);

  const budgetByCategory = new Map<string, EffectiveBudget>();
  for (const budget of input.budgets) {
    if (!budgetByCategory.has(budget.categoryId)) budgetByCategory.set(budget.categoryId, budget);
  }

  // カテゴリの並びは U4 の並びのまま保つ（BR3.2）。
  const expenseRows: ExpenseRow[] = categories
    .filter((c) => c.type === "expense")
    .map((c) => expenseRowOf(c, sums.get(c.id) ?? 0, budgetByCategory.get(c.id)));
  const incomeRows: IncomeRow[] = categories
    .filter((c) => c.type === "income")
    .map((c) => ({ categoryId: c.id, categoryName: c.name, actual: sums.get(c.id) ?? 0 }));

  // 合計は行の actual の和に一本化する（BR1.3）。合計と行の和は必ず一致する。
  const incomeTotal = incomeRows.reduce((sum, row) => sum + row.actual, 0);
  const expenseTotal = expenseRows.reduce((sum, row) => sum + row.actual, 0);

  return {
    month,
    incomeTotal,
    expenseTotal,
    balance: incomeTotal - expenseTotal,
    expenseRows,
    incomeRows,
    hasTransactions: monthTransactions.length > 0,
  };
}
