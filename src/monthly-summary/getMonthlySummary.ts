// 月次集計の取得（契約 C4、規則 BR4.1・BR4.2、security-design.md 第2章）。
// U4 の Book から カテゴリ → 予算 → 収支 の順に1つずつ読み、computeMonthlySummary に渡す。例外は投げず、必ず Result で返す。
import type { Category, Result, Transaction, YearMonth } from "../data-contract";
import type { Book, OperationError } from "../bookkeeping-core";
import { computeMonthlySummary } from "./compute";
import type { MonthlySummary } from "./types";

const READ_FAILED_MESSAGE = "データを読み込めませんでした";

/** 対象月の収支のカテゴリが、すべて同じ種別のカテゴリとして一覧にあるか（BR4.2）。 */
function hasUnknownCategory(
  transactions: readonly Transaction[],
  categories: readonly Category[],
): boolean {
  const typeById = new Map<string, Category["type"]>();
  for (const category of categories) typeById.set(category.id, category.type);
  return transactions.some((t) => typeById.get(t.categoryId) !== t.type);
}

export async function getMonthlySummary(
  book: Book,
  month: YearMonth,
): Promise<Result<MonthlySummary, OperationError>> {
  try {
    // 読み取りは並列にせず、この順に1つずつ行う。カテゴリを先に読むと、収支の側の「一覧にないカテゴリ」を
    // 確実に食い違いとして見つけられる。どれかが失敗したら、その OperationError をそのまま返す（月の検証も U4）。
    const categories = await book.listCategories();
    if (!categories.ok) return categories;
    const budgets = await book.getEffectiveBudgets(month);
    if (!budgets.ok) return budgets;
    const transactions = await book.listTransactions(month);
    if (!transactions.ok) return transactions;

    // 一部が抜けた集計を見せない。種別の不一致も category-missing にまとめる。
    if (hasUnknownCategory(transactions.value, categories.value)) {
      return { ok: false, error: { kind: "rule", violation: { code: "category-missing" } } };
    }
    return {
      ok: true,
      value: computeMonthlySummary({
        month,
        transactions: transactions.value,
        categories: categories.value,
        budgets: budgets.value,
      }),
    };
  } catch {
    // 想定外の例外（バグ）は境界で失敗に変換し、握りつぶさない。
    return { ok: false, error: { kind: "storage", message: READ_FAILED_MESSAGE } };
  }
}
