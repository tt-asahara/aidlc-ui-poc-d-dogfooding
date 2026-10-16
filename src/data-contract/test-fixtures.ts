// テスト専用の架空データ生成関数（NFR8.5）。公開窓口（index.ts）からは公開しない。
// 実在の個人・口座・取引に由来する値は使わず、「架空」と分かる名前だけを使う。
import type { Category, CsvRecord, EntryType, TransactionInput } from "./types";

/** 正しい収支の入力（支出・架空のランチ）。overrides で一部の項目だけを差し替える。 */
export function fictionalTransactionInput(
  overrides: Partial<Record<keyof TransactionInput, unknown>> = {},
): TransactionInput {
  return {
    date: "2026-10-01",
    type: "expense",
    categoryId: "cat-fictional-food",
    amount: "1200",
    memo: "架空のランチ",
    ...overrides,
  } as TransactionInput;
}

/** 架空のカテゴリ。日時は固定の架空の値。 */
export function fictionalCategory(id: string, type: EntryType, name: string): Category {
  return { id, type, name, sortOrder: 0, createdAt: "2026-10-01T09:00:00+09:00" };
}

/** 正しい CSV レコード（支出・架空のランチ）。 */
export function fictionalCsvRecord(overrides: Partial<CsvRecord> = {}): CsvRecord {
  return {
    date: "2026-10-01",
    type: "expense",
    category: "架空の食費",
    amount: "1200",
    memo: "架空のランチ",
    ...overrides,
  };
}

/** 指定した数の書記素（ASCII の "a"）からなる文字列。 */
export function graphemes(count: number, unit = "a"): string {
  return unit.repeat(count);
}

/**
 * 時間測定用の架空 CSV（見出し＋ count レコード）。
 * 1レコードは約 200 バイト以内に収まるため、5,000 レコードで 1MB 以内になる。
 */
export function fictionalCsvText(count: number): string {
  const rows: string[] = ["date,type,category,amount,memo"];
  for (let i = 0; i < count; i += 1) {
    const day = String((i % 28) + 1).padStart(2, "0");
    const memo = `"架空のメモ ${i}, ""引用"" を含む値"`;
    rows.push(`2026-10-${day},expense,架空の食費,${(i % 9999) + 1},${memo}`);
  }
  return `${String.fromCharCode(0xfeff)}${rows.join("\r\n")}\r\n`;
}
