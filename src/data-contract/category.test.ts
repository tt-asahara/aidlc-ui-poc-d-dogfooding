import { describe, expect, it } from "vitest";
import { normalizeCategoryNameForCompare, validateCategoryName } from "./category";
import { fictionalCategory, graphemes } from "./test-fixtures";

const MSG = {
  blank: "カテゴリ名を入力してください",
  tooLong: "カテゴリ名：20文字以内で入力してください",
  duplicate: "カテゴリ名：同じ種別に同じ名前があります",
} as const;

const IDEOGRAPHIC_SPACE = String.fromCharCode(0x3000); // 全角空白

const existing = [
  fictionalCategory("c-food", "expense", "食費"),
  fictionalCategory("c-food-en", "expense", "food"),
  fictionalCategory("c-salary", "income", "架空の給与"),
];

describe("BR2.1 カテゴリ名の長さと空白", () => {
  it("前後の空白を除いた名前を返す（AC1.1.5）", () => {
    expect(validateCategoryName(" 書籍 ", "expense", existing)).toEqual({
      ok: true,
      value: "書籍",
    });
  });

  it("20 文字（書記素）までを受け付ける", () => {
    expect(validateCategoryName(graphemes(20, "架"), "expense", existing).ok).toBe(true);
  });

  it("21 文字は too-long", () => {
    expect(validateCategoryName(graphemes(21), "expense", existing)).toEqual({
      ok: false,
      error: [{ field: "name", code: "too-long", message: MSG.tooLong }],
    });
  });

  it.each(["", "   ", `${IDEOGRAPHIC_SPACE}\t`, null, 42])(
    "空白のみや想定外の型（%s）は blank",
    (name) => {
      expect(validateCategoryName(name as string, "expense", existing)).toEqual({
        ok: false,
        error: [{ field: "name", code: "blank", message: MSG.blank }],
      });
    },
  );
});

describe("BR2.2 カテゴリ名の重複（AC1.1.3）", () => {
  it.each(["食費", " 食費 ", "ＦＯＯＤ", "Food", "FOOD "])(
    "同じ種別の既存の名前と比較キーが同じ「%s」は duplicate-name",
    (name) => {
      expect(validateCategoryName(name, "expense", existing)).toEqual({
        ok: false,
        error: [{ field: "name", code: "duplicate-name", message: MSG.duplicate }],
      });
    },
  );

  it("種別が違えば同じ名前でも重複としない（収入側の「食費」）", () => {
    expect(validateCategoryName("食費", "income", existing)).toEqual({ ok: true, value: "食費" });
  });

  it("名前変更では自分自身を除いて比較する", () => {
    expect(validateCategoryName("ＦＯＯＤ", "expense", existing, "c-food-en")).toEqual({
      ok: true,
      value: "ＦＯＯＤ",
    });
    expect(validateCategoryName("食費", "expense", existing, "c-food-en").ok).toBe(false);
  });

  it("比較キーは前後空白・全角半角・大文字小文字を区別しない", () => {
    expect(normalizeCategoryNameForCompare(" ＦＯＯＤ ")).toBe("food");
    expect(
      normalizeCategoryNameForCompare(`${IDEOGRAPHIC_SPACE}Ｆｏｏｄ１${IDEOGRAPHIC_SPACE}`),
    ).toBe("food1");
    expect(normalizeCategoryNameForCompare("食費")).toBe("食費");
  });
});
