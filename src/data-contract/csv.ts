// CSV の符号化・復号（BR4.1〜BR4.7）。純粋な関数で、例外を投げない。
import { escapeFormula, unescapeFormula } from "./formula";
import { MESSAGES } from "./messages";
import { isNonBlankString, trimText } from "./text";
import type {
  CsvFormatError,
  CsvLine,
  CsvRecord,
  Result,
  ValidationError,
  ValidCsvRecord,
} from "./types";
import {
  collectErrors,
  fail,
  ok,
  validateAmount,
  validateDate,
  validateEntryType,
  validateMemo,
  type FieldResult,
} from "./values";

export const CSV_HEADER = ["date", "type", "category", "amount", "memo"] as const;

const BOM = String.fromCharCode(0xfeff); // UTF-8 の BOM（U+FEFF）
const CRLF = "\r\n";
const NEEDS_QUOTING = /[",\r\n]|^\s|\s$/;

const CHAR_QUOTE = 0x22; // "
const CHAR_COMMA = 0x2c; // ,
const CHAR_CR = 0x0d;
const CHAR_LF = 0x0a;

const MALFORMED_UNCLOSED = "引用が閉じられていません";
const MALFORMED_AFTER_QUOTE = "引用の後に区切り以外の文字があります";

/** RFC 4180 の引用規則（BR4.2）。 */
function quoteField(value: string): string {
  return NEEDS_QUOTING.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * W4 CsvRecord の並びを CSV にする（BR4.2、BR4.5）。
 * 先頭に BOM、見出し行、以降1レコード1行、行の区切りは CRLF（最終行の後にも付ける）。
 */
export function encodeCsv(records: readonly CsvRecord[]): string {
  const lines = [CSV_HEADER.join(",")];
  for (const record of records) {
    const values = [
      record.date,
      record.type,
      escapeFormula(record.category),
      record.amount,
      escapeFormula(record.memo),
    ];
    lines.push(values.map(quoteField).join(","));
  }
  return BOM + lines.join(CRLF) + CRLF;
}

interface RawRow {
  line: number;
  fields: string[];
}

type ParseResult = Result<RawRow[], { line: number; message: string }>;

/**
 * 入力を先頭から1回だけ走査する状態機械（security-design.md 4.2）。後戻りしないため、時間は入力の長さに比例する。
 * 状態は「引用の外」「引用の中」「引用の中で直前が "」の3つで、引用の中の処理はこの関数内のループで表す。
 * 行番号は物理行で数える（CRLF・LF・単独の CR をそれぞれ1つの改行とする）。
 */
function parseRows(text: string): ParseResult {
  const rows: RawRow[] = [];
  const length = text.length;
  let index = 0;
  let line = 1;

  while (index < length) {
    const rowLine = line;
    const fields: string[] = [];
    let hasQuotedField = false;
    let rowEnded = false;

    while (!rowEnded) {
      let value: string;
      if (text.charCodeAt(index) === CHAR_QUOTE) {
        // 引用の中
        hasQuotedField = true;
        const quoteLine = line;
        const parts: string[] = [];
        index += 1;
        let segmentStart = index;
        for (;;) {
          if (index >= length) {
            return { ok: false, error: { line: quoteLine, message: MALFORMED_UNCLOSED } };
          }
          const code = text.charCodeAt(index);
          if (code === CHAR_QUOTE) {
            // 引用の中で直前が "
            if (text.charCodeAt(index + 1) === CHAR_QUOTE) {
              parts.push(text.slice(segmentStart, index + 1));
              index += 2;
              segmentStart = index;
              continue;
            }
            parts.push(text.slice(segmentStart, index));
            index += 1;
            break;
          }
          if (code === CHAR_LF || (code === CHAR_CR && text.charCodeAt(index + 1) !== CHAR_LF)) {
            line += 1;
          }
          index += 1;
        }
        value = parts.join("");
        if (index < length) {
          const next = text.charCodeAt(index);
          if (next !== CHAR_COMMA && next !== CHAR_CR && next !== CHAR_LF) {
            return { ok: false, error: { line, message: MALFORMED_AFTER_QUOTE } };
          }
        }
      } else {
        // 引用の外
        const start = index;
        while (index < length) {
          const code = text.charCodeAt(index);
          if (code === CHAR_COMMA || code === CHAR_CR || code === CHAR_LF) break;
          index += 1;
        }
        value = text.slice(start, index);
      }
      fields.push(value);

      if (index >= length) {
        rowEnded = true;
      } else {
        const code = text.charCodeAt(index);
        index += 1;
        if (code === CHAR_COMMA) continue;
        if (code === CHAR_CR && text.charCodeAt(index) === CHAR_LF) index += 1;
        line += 1;
        rowEnded = true;
      }
    }

    const isBlankRow = fields.length === 1 && fields[0] === "" && !hasQuotedField;
    if (!isBlankRow) rows.push({ line: rowLine, fields });
  }
  return { ok: true, value: rows };
}

function isHeaderRow(fields: readonly string[]): boolean {
  return (
    fields.length === CSV_HEADER.length &&
    fields.every((field, index) => trimText(field) === CSV_HEADER[index])
  );
}

function toCsvLine(row: RawRow): CsvLine {
  const [date = "", type = "", category = "", amount = "", memo = ""] = row.fields;
  return {
    line: row.line,
    record: {
      date,
      type,
      category: unescapeFormula(category),
      amount,
      memo: unescapeFormula(memo),
    },
    fields: row.fields,
  };
}

/**
 * W5 CSV を復号する（BR4.1、BR4.3、BR4.4、BR4.6）。
 * BOM の有無と CRLF・LF を受け付け、各レコードに開始行の番号を付ける。行の値の検証は行わない（BR4.7 は validateCsvRecord）。
 */
export function decodeCsv(text: string): Result<CsvLine[], CsvFormatError> {
  if (typeof text !== "string") return { ok: false, error: { kind: "empty" } };
  const content = text.startsWith(BOM) ? text.slice(BOM.length) : text;
  if (trimText(content) === "") return { ok: false, error: { kind: "empty" } };

  const parsed = parseRows(content);
  if (!parsed.ok) {
    return { ok: false, error: { kind: "malformed", ...parsed.error } };
  }
  const [header, ...records] = parsed.value;
  if (header === undefined) return { ok: false, error: { kind: "empty" } };
  if (!isHeaderRow(header.fields)) {
    return { ok: false, error: { kind: "header-mismatch", found: header.fields.map(trimText) } };
  }
  if (records.length === 0) return { ok: false, error: { kind: "empty" } };
  return { ok: true, value: records.map(toCsvLine) };
}

function validateCsvCategory(value: unknown): FieldResult<string> {
  if (!isNonBlankString(value)) return fail("category", "required", MESSAGES.csvCategoryRequired);
  return ok(trimText(value));
}

/**
 * CSV の1行を画面入力と同じ規則（BR1.1、BR1.3〜BR1.6）で検証する（BR4.7）。
 * エラーは日付・種別・カテゴリ・金額・メモの順。カテゴリ名からの id の解決は U6・U4 が行う。
 */
export function validateCsvRecord(record: CsvRecord): Result<ValidCsvRecord, ValidationError[]> {
  const source: Partial<CsvRecord> = typeof record === "object" && record !== null ? record : {};
  const date = validateDate(source.date);
  const type = validateEntryType(source.type);
  const category = validateCsvCategory(source.category);
  const amount = validateAmount(source.amount);
  const memo = validateMemo(source.memo);
  if (date.ok && type.ok && category.ok && amount.ok && memo.ok) {
    return {
      ok: true,
      value: {
        date: date.value,
        type: type.value,
        categoryName: category.value,
        amount: amount.value,
        memo: memo.value,
      },
    };
  }
  return { ok: false, error: collectErrors([date, type, category, amount, memo]) };
}
