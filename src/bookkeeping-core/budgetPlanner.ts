// 予算の持ち主（BudgetPlanner）。保存に触れない純粋な関数だけを持ち、U1 の型だけに依存する（ADR-002）。
// その月に使う予算の計算（resolveEffectiveBudgets）は公開の窓口からも使える（BR4.1〜BR4.4、NFR5.1）。
import type { Budget, Category, YearMonth } from "../data-contract";
import type { EffectiveBudget, RuleViolation } from "./types";

/** 保存する予算の値。同じ [categoryId, month] の値は put で置き換わる（BR4.1）。 */
export function buildBudget(
  categoryId: string,
  month: YearMonth,
  amount: number,
  nowIso: string,
): Budget {
  return { categoryId, month, amount, updatedAt: nowIso };
}

/** 予算を設定できるカテゴリか。ない → category-missing、収入 → category-type-mismatch（BR4.1）。 */
export function checkBudgetCategory(category: Category | undefined): RuleViolation | undefined {
  if (category === undefined) return { code: "category-missing" };
  if (category.type !== "expense") return { code: "category-type-mismatch" };
  return undefined;
}

/** 予算の設定を外せるか。その月に設定がなければ budget-not-set（BR4.2）。 */
export function checkBudgetClear(existing: Budget | undefined): RuleViolation | undefined {
  return existing === undefined ? { code: "budget-not-set" } : undefined;
}

/**
 * その月に使う予算（BR4.3、W4）。支出カテゴリごとに、その月以前の設定のうち最も新しい月の値を使う。
 * その月の設定なら set、前の月の設定なら carried（from その月）、なければ none（amount は null）。
 * 後の月の設定は前の月に使わない。0 円も設定として扱う。金額は保存した整数をそのまま返す（NFR5.1）。
 * YYYY-MM の文字列は辞書順と月の順が一致するため、文字列の比較で前後を決める。
 * 結果はカテゴリの一覧の並び（sortOrder → createdAt → id の昇順）。
 */
export function resolveEffectiveBudgets(
  categories: readonly Category[],
  budgets: readonly Budget[],
  month: YearMonth,
): EffectiveBudget[] {
  const latestByCategory = new Map<string, Budget>();
  for (const budget of budgets) {
    if (budget.month > month) continue;
    const current = latestByCategory.get(budget.categoryId);
    if (current === undefined || budget.month > current.month) {
      latestByCategory.set(budget.categoryId, budget);
    }
  }
  return categories
    .filter((c) => c.type === "expense")
    .sort(compareExpenseCategories)
    .map((category) => toEffective(category.id, month, latestByCategory.get(category.id)));
}

function toEffective(
  categoryId: string,
  month: YearMonth,
  latest: Budget | undefined,
): EffectiveBudget {
  if (latest === undefined) return { categoryId, month, amount: null, source: { kind: "none" } };
  if (latest.month === month) {
    return { categoryId, month, amount: latest.amount, source: { kind: "set" } };
  }
  return {
    categoryId,
    month,
    amount: latest.amount,
    source: { kind: "carried", from: latest.month },
  };
}

/** 支出カテゴリどうしの並び（BR3.1 と同じ: sortOrder → createdAt → id の昇順）。 */
function compareExpenseCategories(a: Category, b: Category): number {
  return (
    a.sortOrder - b.sortOrder || compareText(a.createdAt, b.createdAt) || compareText(a.id, b.id)
  );
}

function compareText(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
