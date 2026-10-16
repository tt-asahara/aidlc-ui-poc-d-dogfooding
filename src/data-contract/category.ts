// カテゴリ名の検証（BR2.1、BR2.2）。純粋な関数で、例外を投げない。
import { MESSAGES } from "./messages";
import { countGraphemes, isNonBlankString, trimText } from "./text";
import type { Category, EntryType, Result, ValidationError } from "./types";
import { fieldError } from "./values";

export const CATEGORY_NAME_MAX_GRAPHEMES = 20;

/**
 * 重複判定用の比較キー（BR2.2）。前後の空白を除き、NFKC で全角英数を半角に直し、英字を小文字にする。
 * NFKC は全角空白も半角に直すため、正規化の後にもう一度前後の空白を除く。
 */
export function normalizeCategoryNameForCompare(name: string): string {
  return trimText(trimText(name).normalize("NFKC").toLowerCase());
}

/**
 * W2 カテゴリ名を検証する。同じ種別の既存カテゴリ（excludeId は名前変更時の自分自身）と比較キーで比べ、
 * 成功時は前後の空白を除いた名前を返す。
 */
export function validateCategoryName(
  name: string,
  type: EntryType,
  existing: readonly Category[],
  excludeId?: string,
): Result<string, ValidationError[]> {
  if (!isNonBlankString(name)) {
    return { ok: false, error: [fieldError("name", "blank", MESSAGES.categoryNameBlank)] };
  }
  const trimmed = trimText(name);
  if (countGraphemes(trimmed, CATEGORY_NAME_MAX_GRAPHEMES) > CATEGORY_NAME_MAX_GRAPHEMES) {
    return { ok: false, error: [fieldError("name", "too-long", MESSAGES.categoryNameTooLong)] };
  }
  const key = normalizeCategoryNameForCompare(trimmed);
  const isDuplicate = existing.some(
    (category) =>
      category.type === type &&
      category.id !== excludeId &&
      normalizeCategoryNameForCompare(category.name) === key,
  );
  if (isDuplicate) {
    return {
      ok: false,
      error: [fieldError("name", "duplicate-name", MESSAGES.categoryNameDuplicate)],
    };
  }
  return { ok: true, value: trimmed };
}
