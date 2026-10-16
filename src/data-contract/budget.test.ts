import { describe, expect, it } from "vitest";
import { validateBudgetAmount } from "./budget";

const MSG = {
  required: "予算額を入力してください",
  invalid: "予算額：0〜99,999,999 の整数で入力してください",
} as const;

describe("BR3.1 予算額", () => {
  it.each<[string | number, number]>([
    [0, 0],
    ["0", 0],
    [99999999, 99999999],
    ["99,999,999", 99999999],
    ["５０，０００", 50000],
  ])("%s を整数 %d として受け付ける（0円の予算も受け付ける）", (amount, expected) => {
    expect(validateBudgetAmount(amount)).toEqual({ ok: true, value: expected });
  });

  it.each<[unknown, string]>([
    [-1, "out-of-range"],
    [100000000, "out-of-range"],
    [12.5, "not-integer"],
    ["12.5", "not-integer"],
    ["abc", "not-integer"],
    ["-1", "not-integer"],
    [Number.NaN, "not-integer"],
  ])("%s は %s", (amount, code) => {
    expect(validateBudgetAmount(amount as string | number)).toEqual({
      ok: false,
      error: [{ field: "budgetAmount", code, message: MSG.invalid }],
    });
  });

  it.each(["", "  ", null, undefined])("空（%s）は required", (amount) => {
    expect(validateBudgetAmount(amount as unknown as string)).toEqual({
      ok: false,
      error: [{ field: "budgetAmount", code: "required", message: MSG.required }],
    });
  });
});
