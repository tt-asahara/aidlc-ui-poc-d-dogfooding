// 予算額の検証（BR3.1）。金額と同じ正規化（BR1.3）で、下限だけを 0 とする。
import { MESSAGES } from "./messages";
import type { Result, ValidationError } from "./types";
import { AMOUNT_MAX, fieldError, parseInteger } from "./values";

/** W3 予算額を検証し、0〜99,999,999 の整数を返す。0 は「0円の予算」として受け付ける。 */
export function validateBudgetAmount(amount: string | number): Result<number, ValidationError[]> {
  const parsed = parseInteger(amount);
  if (parsed.kind === "required") {
    return { ok: false, error: [fieldError("budgetAmount", "required", MESSAGES.budgetRequired)] };
  }
  if (parsed.kind === "not-integer") {
    return {
      ok: false,
      error: [fieldError("budgetAmount", "not-integer", MESSAGES.budgetInvalid)],
    };
  }
  if (parsed.value < 0 || parsed.value > AMOUNT_MAX) {
    return {
      ok: false,
      error: [fieldError("budgetAmount", "out-of-range", MESSAGES.budgetInvalid)],
    };
  }
  return { ok: true, value: parsed.value };
}
