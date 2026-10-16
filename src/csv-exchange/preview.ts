// 読み込みとプレビュー（W2、BR2.1〜BR2.4、BR3.1〜BR3.8、security-design.md 第1章・第2章）。
// ファイル全体の確認（readImportFile）と、行の検証・照合・既存と同じ内容の判定（buildPreview）に分ける。
// 2つの段階で想定外の例外の変換が違うため（読み取りは read-failed、Book の呼び出しは storage）、
// 組み合わせと例外の変換は index.ts が行う。
import { decodeCsv, validateCsvRecord } from "../data-contract";
import type { CsvFormatError, CsvLine, Result, Transaction } from "../data-contract";
import type { Book, OperationError } from "../bookkeeping-core";
import { createCategoryMatcher, type CategoryMatcher } from "./categoryMatcher";
import { readFileText } from "./fileReader";
import { CSV_MESSAGES } from "./messages";
import type { ImportFileError, ImportPreview, InvalidRow, PreviewRow } from "./types";

/** 見出しを除いたレコードの件数の上限（ちょうどは進む）。 */
export const MAX_IMPORT_ROWS = 5000;

const CSV_COLUMN_COUNT = 5;

/** ファイル全体の確認を通った内容。 */
export interface DecodedImport {
  fileName: string;
  lines: CsvLine[];
}

/** U1 の CsvFormatError を C5 の ImportFileError にする（BR2.3）。header-mismatch の found は渡さない。 */
function toImportFileError(error: CsvFormatError): ImportFileError {
  switch (error.kind) {
    case "empty":
      return { kind: "empty" };
    case "header-mismatch":
      return { kind: "header-mismatch" };
    case "malformed":
      return { kind: "malformed", line: error.line, message: error.message };
  }
}

/**
 * ファイル全体を、大きさ → 文字コード → CSV の形 → 件数の順に確かめる（security-design.md 第2章）。
 * どれかに当たれば、行ごとの検証をせずに理由を返す。
 */
export async function readImportFile(file: File): Promise<Result<DecodedImport, ImportFileError>> {
  const text = await readFileText(file);
  if (!text.ok) return text;
  const decoded = decodeCsv(text.value);
  if (!decoded.ok) return { ok: false, error: toImportFileError(decoded.error) };
  // 引用の中の改行で複数の物理行にまたがるレコードも1件と数える（decodeCsv のレコード単位）。
  if (decoded.value.length > MAX_IMPORT_ROWS) {
    return { ok: false, error: { kind: "too-many-rows", limitRows: MAX_IMPORT_ROWS } };
  }
  return { ok: true, value: { fileName: file.name, lines: decoded.value } };
}

/** 既存と同じ内容の判定のキー（日付・種別・カテゴリ・金額・メモ）。区切りの文字と値が混ざらないよう JSON にする。 */
function contentKey(row: {
  date: string;
  type: string;
  categoryId: string;
  amount: number;
  memo: string;
}): string {
  return JSON.stringify([row.date, row.type, row.categoryId, row.amount, row.memo]);
}

type LineResult = { kind: "valid"; row: PreviewRow } | { kind: "invalid"; row: InvalidRow };

/** 取り込めない行（BR3.5）。raw はファイル上の全列の値（数式対策の ' を外す前）。 */
function invalidLine(line: CsvLine, fields: string[], reasons: string[]): LineResult {
  return { kind: "invalid", row: { line: line.line, reasons, raw: fields } };
}

/** 1行を、列の数 → 値の検証 → カテゴリの照合の順に確かめる（security-design.md 第1章、Q1 = A）。 */
function checkLine(
  line: CsvLine,
  matcher: CategoryMatcher,
  existingKeys: ReadonlySet<string>,
): LineResult {
  const record = line.record;
  const fields = line.fields ?? [
    record.date,
    record.type,
    record.category,
    record.amount,
    record.memo,
  ];
  if (fields.length !== CSV_COLUMN_COUNT) {
    return invalidLine(line, fields, [CSV_MESSAGES.columnCount]);
  }
  const validated = validateCsvRecord(record);
  if (!validated.ok) {
    // 値の検証に失敗した行はカテゴリと照合しない。理由は U1 の文言だけ（Q1 = A、Q2 = A）。
    return invalidLine(
      line,
      fields,
      validated.error.map((e) => e.message),
    );
  }
  const value = validated.value;
  const match = matcher.find(value.type, value.categoryName);
  if (match.kind === "type-mismatch") {
    return invalidLine(line, fields, [CSV_MESSAGES.categoryTypeMismatch]);
  }
  if (match.kind === "not-found") {
    return invalidLine(line, fields, [CSV_MESSAGES.categoryNotFound]);
  }
  const content = {
    date: value.date,
    type: value.type,
    categoryId: match.category.id,
    amount: value.amount,
    memo: value.memo,
  };
  return {
    kind: "valid",
    row: {
      line: line.line,
      ...content,
      categoryName: match.category.name,
      sameAsExisting: existingKeys.has(contentKey(content)),
    },
  };
}

function existingContentKeys(transactions: readonly Transaction[]): Set<string> {
  return new Set(transactions.map(contentKey));
}

/**
 * 行ごとに検証し、取り込める行と取り込めない行に分ける（BR3.1〜BR3.8）。
 * カテゴリと既存の収支は U4 から1回ずつ読み、失敗はそのまま返す。行の並びは decodeCsv の順（行番号の昇順）を保つ。
 */
export async function buildPreview(
  book: Book,
  decoded: DecodedImport,
): Promise<Result<ImportPreview, OperationError>> {
  const [categories, existing] = await Promise.all([
    book.listCategories(),
    book.listAllTransactions("all"),
  ]);
  if (!categories.ok) return categories;
  if (!existing.ok) return existing;

  const matcher = createCategoryMatcher(categories.value);
  const existingKeys = existingContentKeys(existing.value);
  const validRows: PreviewRow[] = [];
  const invalidRows: InvalidRow[] = [];
  for (const line of decoded.lines) {
    const result = checkLine(line, matcher, existingKeys);
    if (result.kind === "valid") validRows.push(result.row);
    else invalidRows.push(result.row);
  }
  return { ok: true, value: { fileName: decoded.fileName, validRows, invalidRows } };
}
