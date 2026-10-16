// 値の検証と正規化（BR1.1〜BR1.7）。すべて純粋な関数で、例外を投げない（NFR8.2）。
// 想定外の型は、先に型を確かめることで例外を起こさずに項目のエラーとして返す。
import { MESSAGES } from "./messages";
import { countGraphemes, isNonBlankString, normalizeDigits, trimText } from "./text";
import type {
  EntryType,
  FieldName,
  IsoDate,
  Result,
  TransactionInput,
  ValidationCode,
  ValidationError,
  ValidTransactionInput,
  YearMonth,
} from "./types";

export type FieldResult<T> = Result<T, ValidationError>;

export const AMOUNT_MAX = 99_999_999;
export const MEMO_MAX_GRAPHEMES = 200;

const DATE_MIN = "2000-01-01";
const DATE_MAX = "2099-12-31";
const YEAR_MONTH_MIN = "2000-01";
const YEAR_MONTH_MAX = "2099-12";
const DATE_PATTERN = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
const YEAR_MONTH_PATTERN = /^([0-9]{4})-([0-9]{2})$/;
const DIGITS_ONLY = /^[0-9]+$/;

export function fieldError(
  field: FieldName,
  code: ValidationCode,
  message: string,
): ValidationError {
  return { field, code, message };
}

export function ok<T>(value: T): FieldResult<T> {
  return { ok: true, value };
}

export function fail<T>(field: FieldName, code: ValidationCode, message: string): FieldResult<T> {
  return { ok: false, error: fieldError(field, code, message) };
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month - 1] ?? 0;
}

/** BR1.1 日付。前後の空白を除いた値を返す（ゼロ埋めなどの書き換えはしない）。 */
export function validateDate(value: unknown): FieldResult<IsoDate> {
  if (!isNonBlankString(value)) return fail("date", "required", MESSAGES.dateRequired);
  const date = trimText(value);
  const match = DATE_PATTERN.exec(date);
  if (!match) return fail("date", "invalid-date", MESSAGES.dateInvalid);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return fail("date", "invalid-date", MESSAGES.dateInvalid);
  }
  if (date < DATE_MIN || date > DATE_MAX) {
    return fail("date", "out-of-range-date", MESSAGES.dateOutOfRange);
  }
  return ok(date);
}

/** BR1.2 対象月が YYYY-MM で 2000-01〜2099-12 か。文字列以外は false。 */
export function isValidYearMonth(month: string): boolean {
  if (typeof month !== "string") return false;
  const match = YEAR_MONTH_PATTERN.exec(month);
  if (!match) return false;
  const monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12) return false;
  return month >= YEAR_MONTH_MIN && month <= YEAR_MONTH_MAX;
}

/** 検証済みの日付から対象月を取り出す（例: 2026-10-31 → 2026-10）。 */
export function toYearMonth(date: IsoDate): YearMonth {
  return date.slice(0, 7);
}

/** BR1.5 種別。英字は小文字に直し、CSV の「収入」「支出」も受け付ける。 */
export function validateEntryType(value: unknown): FieldResult<EntryType> {
  if (!isNonBlankString(value)) return fail("type", "required", MESSAGES.typeInvalid);
  const type = trimText(value).toLowerCase();
  if (type === "income" || type === "収入") return ok("income");
  if (type === "expense" || type === "支出") return ok("expense");
  return fail("type", "invalid-type", MESSAGES.typeInvalid);
}

export type IntegerParse =
  { kind: "integer"; value: number } | { kind: "required" } | { kind: "not-integer" };

/**
 * 金額・予算額の共通の正規化（BR1.3、BR3.1、NFR5.1）。
 * 数値はそのまま安全な整数かを判定し、文字列は前後空白の除去・全角の正規化・カンマの除去の後、
 * 半角数字だけかを確かめてから Number に変換する。範囲の判定は呼び出し側が行う。
 */
export function parseInteger(value: unknown): IntegerParse {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? { kind: "integer", value } : { kind: "not-integer" };
  }
  if (value === null || value === undefined) return { kind: "required" };
  if (typeof value !== "string") return { kind: "not-integer" };
  const normalized = normalizeDigits(trimText(value)).replace(/,/g, "");
  if (normalized === "") return { kind: "required" };
  if (!DIGITS_ONLY.test(normalized)) return { kind: "not-integer" };
  // 桁の多い値は安全な整数を超え得るが、範囲の判定（上限 99,999,999）で必ず弾かれる。
  return { kind: "integer", value: Number(normalized) };
}

/** BR1.3 金額（1〜99,999,999 の整数）。 */
export function validateAmount(value: unknown): FieldResult<number> {
  const parsed = parseInteger(value);
  if (parsed.kind === "required") return fail("amount", "required", MESSAGES.amountRequired);
  if (parsed.kind === "not-integer") return fail("amount", "not-integer", MESSAGES.amountInvalid);
  if (parsed.value < 1 || parsed.value > AMOUNT_MAX) {
    return fail("amount", "out-of-range", MESSAGES.amountInvalid);
  }
  return ok(parsed.value);
}

/** BR1.4 メモ（前後空白の除去後 0〜200 書記素）。未指定は空文字。 */
export function validateMemo(value: unknown): FieldResult<string> {
  if (value === null || value === undefined) return ok("");
  if (typeof value !== "string") return fail("memo", "required", MESSAGES.memoNotText);
  const memo = trimText(value);
  if (countGraphemes(memo, MEMO_MAX_GRAPHEMES) > MEMO_MAX_GRAPHEMES) {
    return fail("memo", "too-long", MESSAGES.memoTooLong);
  }
  return ok(memo);
}

/** BR1.6 カテゴリ id の必須判定（存在と種別の一致は U4 が確かめる）。 */
export function validateCategoryId(value: unknown): FieldResult<string> {
  if (!isNonBlankString(value)) return fail("categoryId", "required", MESSAGES.categoryRequired);
  return ok(value);
}

/** 項目ごとの結果から、エラーを並びの順に集める。 */
export function collectErrors(results: readonly FieldResult<unknown>[]): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const result of results) {
    if (!result.ok) errors.push(result.error);
  }
  return errors;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

/**
 * W1 収支の入力を検証する。全項目を判定し（BR1.7）、エラーを
 * 日付・種別・カテゴリ・金額・メモの順で返す。
 */
export function validateTransactionInput(
  input: TransactionInput,
): Result<ValidTransactionInput, ValidationError[]> {
  const source = asRecord(input);
  const date = validateDate(source.date);
  const type = validateEntryType(source.type);
  const categoryId = validateCategoryId(source.categoryId);
  const amount = validateAmount(source.amount);
  const memo = validateMemo(source.memo);
  if (date.ok && type.ok && categoryId.ok && amount.ok && memo.ok) {
    return {
      ok: true,
      value: {
        date: date.value,
        type: type.value,
        categoryId: categoryId.value,
        amount: amount.value,
        memo: memo.value,
      },
    };
  }
  return { ok: false, error: collectErrors([date, type, categoryId, amount, memo]) };
}
