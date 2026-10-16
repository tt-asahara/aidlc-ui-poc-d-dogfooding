// 収支の持ち主（Ledger）。保存に触れない純粋な関数だけを持ち、U1 の型だけに依存する（ADR-002）。
// 書き込み処理の中で読み直した値を book.ts から受け取り、判定と値の組み立てを行う（BR2.1〜BR2.5、BR5.1）。
import type { Category, EntryType, Transaction } from "../data-contract";
import type { RuleViolation, ValidTransaction } from "./types";

/** 新しい収支。id・createdAt・updatedAt を付ける（BR2.1）。 */
export function buildNewTransaction(
  valid: ValidTransaction,
  id: string,
  nowIso: string,
): Transaction {
  return { ...valid, id, createdAt: nowIso, updatedAt: nowIso };
}

/** 更新した収支。id と createdAt は元の値のまま、updatedAt だけ新しくする（BR2.2）。 */
export function buildUpdatedTransaction(
  existing: Transaction,
  valid: ValidTransaction,
  nowIso: string,
): Transaction {
  return { ...valid, id: existing.id, createdAt: existing.createdAt, updatedAt: nowIso };
}

/** 収支が参照するカテゴリの確認。ない → category-missing、種別が違う → category-type-mismatch（BR2.1）。 */
export function checkCategoryForEntry(
  category: Category | undefined,
  type: EntryType,
): RuleViolation | undefined {
  if (category === undefined) return { code: "category-missing" };
  if (category.type !== type) return { code: "category-type-mismatch" };
  return undefined;
}

/**
 * 取り込みの各行のカテゴリの確認。カテゴリがない、または種別が違う行の line を昇順で返す（BR5.1）。
 * 全行に問題がなければ空の配列。
 */
export function findImportCategoryProblems(
  rows: readonly { line: number; value: ValidTransaction }[],
  categories: readonly Category[],
): number[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  return rows
    .filter((row) => checkCategoryForEntry(byId.get(row.value.categoryId), row.value.type))
    .map((row) => row.line)
    .sort((a, b) => a - b);
}

/** 対象月の一覧の並び: 日付の新しい順 → 登録日時の新しい順 → id の昇順（BR2.4）。元の配列は変えない。 */
export function sortNewestFirst(transactions: readonly Transaction[]): Transaction[] {
  return [...transactions].sort(
    (a, b) =>
      compareText(b.date, a.date) ||
      compareText(b.createdAt, a.createdAt) ||
      compareText(a.id, b.id),
  );
}

/** 書き出し用の並び: 日付の古い順 → 登録日時の古い順 → id の昇順（BR2.5）。元の配列は変えない。 */
export function sortOldestFirst(transactions: readonly Transaction[]): Transaction[] {
  return [...transactions].sort(
    (a, b) =>
      compareText(a.date, b.date) ||
      compareText(a.createdAt, b.createdAt) ||
      compareText(a.id, b.id),
  );
}

/** 文字列の符号単位の順（localeCompare は使わない）。 */
function compareText(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
