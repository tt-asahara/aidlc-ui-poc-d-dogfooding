// U4 の検証エラーの文言のテスト（NFR8.3、security-design.md 第4章）。
// U1 の文言と一致することを確かめるため、このテストだけは U1 の内部の文言の定数表を直接読む
// （U1 の公開窓口は文言を出しておらず、変えない）。アプリのコードは U1 の公開窓口だけを import する。
import { describe, expect, it } from "vitest";
import { validateTransactionInput } from "../data-contract";
import { MESSAGES as U1_MESSAGES } from "../data-contract/messages";
import { invalidMonthError, invalidTypeError } from "./errors";
import { CORE_MESSAGES } from "./messages";

describe("U4 の検証エラーの文言", () => {
  it("対象月の文言は U1 の対象月の文言と同じ", () => {
    expect(CORE_MESSAGES.monthInvalid).toBe(U1_MESSAGES.monthInvalid);
  });

  it("種別の文言は U1 の種別の文言と同じ（公開窓口の検証結果とも一致する）", () => {
    expect(CORE_MESSAGES.typeInvalid).toBe(U1_MESSAGES.typeInvalid);
    const checked = validateTransactionInput({
      date: "2026-10-01",
      type: "架空の種別",
      categoryId: "cat-架空",
      amount: 100,
      memo: "",
    });
    expect(checked.ok).toBe(false);
    if (!checked.ok) {
      expect(checked.error).toContainEqual(invalidTypeError());
    }
  });

  it("文言は固定で、入力値を埋め込む書式を持たない", () => {
    for (const message of Object.values(CORE_MESSAGES)) {
      expect(message).not.toMatch(/[{}]|\$\{|%s/);
      expect(message.length).toBeGreaterThan(0);
    }
  });

  it("invalidMonthError・invalidTypeError は項目・種類・文言の組を返す", () => {
    expect(invalidMonthError()).toEqual({
      field: "month",
      code: "invalid-month",
      message: CORE_MESSAGES.monthInvalid,
    });
    expect(invalidTypeError()).toEqual({
      field: "type",
      code: "invalid-type",
      message: CORE_MESSAGES.typeInvalid,
    });
  });
});
