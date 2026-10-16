// カテゴリの照合表（BR3.3、FD Q1 = A、security-design.md 第1章）。保存に触れない純粋な関数。
// U4 の listCategories の結果から1回だけ作り、U1 の normalizeCategoryNameForCompare の値をキーにする
// （カテゴリ名の重複の判定と同じ比べ方。全角・大文字小文字・前後の空白の違いを吸収する）。
import { normalizeCategoryNameForCompare } from "../data-contract";
import type { Category, EntryType } from "../data-contract";

export type CategoryMatch =
  | { kind: "found"; category: Category }
  /** 同じ種別にはないが、別の種別にある */
  | { kind: "type-mismatch" }
  /** どの種別にもない */
  | { kind: "not-found" };

export interface CategoryMatcher {
  /** CSV のカテゴリ名（U1 の検証を通った値）を、行の種別のカテゴリと照合する。 */
  find(type: EntryType, categoryName: string): CategoryMatch;
}

export function createCategoryMatcher(categories: readonly Category[]): CategoryMatcher {
  // 種別ごとの「比較キー → カテゴリ」と、どれかの種別にある比較キーの集合（entities.md CategoryMatcher）。
  const byType = new Map<EntryType, Map<string, Category>>([
    ["expense", new Map()],
    ["income", new Map()],
  ]);
  const anyType = new Set<string>();
  for (const category of categories) {
    const key = normalizeCategoryNameForCompare(category.name);
    const ofType = byType.get(category.type);
    // 同じ種別の中では比較キーは重複しない（U1・U4 の重複の規則）。万一重複していれば先のものを使う。
    if (ofType !== undefined && !ofType.has(key)) ofType.set(key, category);
    anyType.add(key);
  }

  return {
    find(type, categoryName) {
      const key = normalizeCategoryNameForCompare(categoryName);
      const found = byType.get(type)?.get(key);
      if (found !== undefined) return { kind: "found", category: found };
      return anyType.has(key) ? { kind: "type-mismatch" } : { kind: "not-found" };
    },
  };
}
