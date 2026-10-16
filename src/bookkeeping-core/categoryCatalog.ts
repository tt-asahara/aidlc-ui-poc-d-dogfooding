// カテゴリの持ち主（CategoryCatalog）。保存に触れない純粋な関数だけを持ち、U1 の型と検証だけに依存する（ADR-002）。
// 書き込み処理の中で読み直した値を book.ts から受け取り、判定と値の組み立てを行う（BR1.2、BR3.1〜BR3.4）。
import { validateCategoryName } from "../data-contract";
import type { Category, EntryType, Result, ValidationError } from "../data-contract";
import type { RuleViolation } from "./types";

/** 初回に作る架空の初期カテゴリ（FR3.1、entities.md InitialCategorySet）。並び順に sortOrder を 0 から振る。 */
export const INITIAL_CATEGORY_NAMES: Readonly<Record<EntryType, readonly string[]>> = {
  expense: ["食費", "日用品", "住居費", "水道光熱費", "交通費", "娯楽", "その他支出"],
  income: ["給与", "副収入", "その他収入"],
};

const TYPE_ORDER: readonly EntryType[] = ["expense", "income"];

export function isEntryType(value: unknown): value is EntryType {
  return value === "income" || value === "expense";
}

/** 初期カテゴリを作るのは、カテゴリが0件のとき（getAll("categories") の全件の長さ）だけ（BR1.2）。 */
export function needsInitialCategories(existing: readonly Category[]): boolean {
  return existing.length === 0;
}

/** 初期カテゴリ10件（支出7件・収入3件の順）。id は呼ぶたびに newId() で付ける。 */
export function buildInitialCategories(createdAt: string, newId: () => string): Category[] {
  return TYPE_ORDER.flatMap((type) =>
    INITIAL_CATEGORY_NAMES[type].map((name, sortOrder) => ({
      id: newId(),
      type,
      name,
      sortOrder,
      createdAt,
    })),
  );
}

/** 同じ種別の sortOrder の最大値 + 1（なければ 0）（BR3.2）。 */
export function nextSortOrder(existing: readonly Category[], type: EntryType): number {
  const orders = existing.filter((c) => c.type === type).map((c) => c.sortOrder);
  return orders.length === 0 ? 0 : Math.max(...orders) + 1;
}

/** 追加するカテゴリの名前と並びを決める。名前の検証は U1 の validateCategoryName（BR3.2）。 */
export function prepareNewCategory(
  type: EntryType,
  name: string,
  existing: readonly Category[],
): Result<{ type: EntryType; name: string; sortOrder: number }, ValidationError[]> {
  const checked = validateCategoryName(name, type, existing);
  if (!checked.ok) return checked;
  return {
    ok: true,
    value: { type, name: checked.value, sortOrder: nextSortOrder(existing, type) },
  };
}

/** 名前だけを置き換えたカテゴリ。自分自身は重複の比較から除く。種別・並び・作成日時は変えない（BR3.3）。 */
export function prepareRename(
  target: Category,
  name: string,
  existing: readonly Category[],
): Result<Category, ValidationError[]> {
  const checked = validateCategoryName(name, target.type, existing, target.id);
  if (!checked.ok) return checked;
  return { ok: true, value: { ...target, name: checked.value } };
}

/**
 * 削除できるかを、(1) 存在 → (2) 収支からの使用 → (3) 同じ種別の最後の1件 の順に確かめる（BR3.4）。
 * 削除できるときは undefined。値はすべて書き込み処理の中で読み直したもの（BR6.3）。
 */
export function checkCategoryDeletion(
  target: Category | undefined,
  transactionCount: number,
  existing: readonly Category[],
): RuleViolation | undefined {
  if (target === undefined) return { code: "not-found" };
  if (transactionCount > 0) return { code: "category-in-use", count: transactionCount };
  const sameType = existing.filter((c) => c.type === target.type);
  if (sameType.length <= 1) return { code: "last-category-of-type", type: target.type };
  return undefined;
}

/** 一覧の並び: 支出の後に収入、それぞれ sortOrder → createdAt → id の昇順（BR3.1）。元の配列は変えない。 */
export function sortCategories(categories: readonly Category[]): Category[] {
  return [...categories].sort(compareCategories);
}

function compareCategories(a: Category, b: Category): number {
  return (
    TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) ||
    a.sortOrder - b.sortOrder ||
    compareText(a.createdAt, b.createdAt) ||
    compareText(a.id, b.id)
  );
}

/** 文字列の符号単位の順（localeCompare は使わない）。 */
function compareText(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
