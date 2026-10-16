// 表示の形式（NFR5.1、BR5.1）。金額は U4・U5 の整数をそのまま受け取り、表示だけを整える。画面の中で小数の計算はしない。
import type { EntryType, YearMonth } from "../data-contract";
import { APP_MESSAGES } from "./messages";

/** 負の数の記号（BR5.1）。 */
export const MINUS_SIGN = "−";

/** 整数を 3 桁区切りの文字にする（1200 → "1,200"）。負の数は記号を付けず絶対値を区切る。 */
export function formatThousands(value: number): string {
  const digits = String(Math.trunc(Math.abs(value)));
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 差額など符号を示す数（負のときは「−」）。 */
export function formatSignedNumber(value: number): string {
  return value < 0 ? `${MINUS_SIGN}${formatThousands(value)}` : formatThousands(value);
}

/** 円の表示（1200 → "1,200円"）。 */
export function formatYen(amount: number): string {
  return `${formatSignedNumber(amount)}円`;
}

/** 対象月の見出し（"2026-10" → "2026年10月"）。 */
export function formatMonthLabel(month: YearMonth): string {
  const [year, monthPart] = month.split("-");
  return `${year}年${Number(monthPart)}月`;
}

/** 種別の文字（色だけに頼らない。BR2.3）。 */
export function formatEntryType(type: EntryType): string {
  return type === "income"
    ? APP_MESSAGES.transactions.typeIncome
    : APP_MESSAGES.transactions.typeExpense;
}
