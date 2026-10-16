import { describe, expect, it } from "vitest";
import { fictionalTransactionInput, graphemes } from "./test-fixtures";
import type { TransactionInput } from "./types";
import { isValidYearMonth, toYearMonth, validateTransactionInput } from "./values";

const MSG = {
  dateRequired: "日付を入力してください",
  dateInvalid: "日付：存在する日付を YYYY-MM-DD で入力してください",
  dateOutOfRange: "日付：2000-01-01〜2099-12-31 の日付を入力してください",
  type: "種別：income（収入）か expense（支出）を指定してください",
  category: "カテゴリを選んでください",
  amountRequired: "金額を入力してください",
  amountInvalid: "金額：1〜99,999,999 の整数で入力してください",
  memoTooLong: "メモ：200文字以内で入力してください",
} as const;

const IDEOGRAPHIC_SPACE = String.fromCharCode(0x3000); // 全角空白

function errorsOf(input: TransactionInput) {
  const result = validateTransactionInput(input);
  return result.ok ? [] : result.error;
}

describe("validateTransactionInput の正常系（AC1.1.1）", () => {
  it("正しい入力を正規化した値として返す", () => {
    const result = validateTransactionInput(
      fictionalTransactionInput({ memo: " 架空のランチ ", amount: "1,200" }),
    );
    expect(result).toEqual({
      ok: true,
      value: {
        date: "2026-10-01",
        type: "expense",
        categoryId: "cat-fictional-food",
        amount: 1200,
        memo: "架空のランチ",
      },
    });
  });
});

describe("BR1.1 日付", () => {
  it.each(["2000-01-01", "2028-02-29", "2099-12-31"])("%s を受け付ける", (date) => {
    expect(errorsOf(fictionalTransactionInput({ date }))).toEqual([]);
  });

  it.each(["2026-02-29", "2026-13-01", "2026/10/01", "2026-04-31", "２０２６-10-01"])(
    "%s は invalid-date",
    (date) => {
      expect(errorsOf(fictionalTransactionInput({ date }))).toEqual([
        { field: "date", code: "invalid-date", message: MSG.dateInvalid },
      ]);
    },
  );

  it.each(["1999-12-31", "2100-01-01"])("%s は out-of-range-date", (date) => {
    expect(errorsOf(fictionalTransactionInput({ date }))).toEqual([
      { field: "date", code: "out-of-range-date", message: MSG.dateOutOfRange },
    ]);
  });

  it.each(["", "   ", null, undefined, 20261001])("空や想定外の型（%s）は required", (date) => {
    expect(errorsOf(fictionalTransactionInput({ date }))).toEqual([
      { field: "date", code: "required", message: MSG.dateRequired },
    ]);
  });
});

describe("BR1.2 対象月", () => {
  it.each(["2000-01", "2026-10", "2099-12"])("%s は正しい", (month) => {
    expect(isValidYearMonth(month)).toBe(true);
  });

  it.each(["1999-12", "2100-01", "2026-13", "2026-00", "2026-1", "2026/10", "", "2026-10-01"])(
    "%s は正しくない",
    (month) => {
      expect(isValidYearMonth(month)).toBe(false);
    },
  );

  it("文字列以外は正しくない（例外にしない）", () => {
    expect(isValidYearMonth(202610 as unknown as string)).toBe(false);
  });

  it("toYearMonth は日付から対象月を取り出す", () => {
    expect(toYearMonth("2026-10-31")).toBe("2026-10");
  });
});

describe("BR1.3 金額（NFR5.1）", () => {
  it.each<[string | number, number]>([
    [1, 1],
    [99999999, 99999999],
    ["１２００", 1200],
    ["1,200", 1200],
    ["１，２００", 1200],
    [" 3000 ", 3000],
  ])("%s を整数 %d として受け付ける", (amount, expected) => {
    const result = validateTransactionInput(fictionalTransactionInput({ amount }));
    expect(result.ok && result.value.amount).toBe(expected);
    expect(result.ok && Number.isSafeInteger(result.value.amount)).toBe(true);
  });

  it.each<[unknown, string]>([
    [0, "out-of-range"],
    [-1, "out-of-range"],
    [100000000, "out-of-range"],
    [1e8, "out-of-range"],
    ["0", "out-of-range"],
    ["100000000", "out-of-range"],
    [1.5, "not-integer"],
    ["1.5", "not-integer"],
    ["-1", "not-integer"],
    ["¥1200", "not-integer"],
    ["1200円", "not-integer"],
    ["abc", "not-integer"],
    [Number.NaN, "not-integer"],
    [Number.POSITIVE_INFINITY, "not-integer"],
    [[1200], "not-integer"],
  ])("%s は %s", (amount, code) => {
    expect(errorsOf(fictionalTransactionInput({ amount }))).toEqual([
      { field: "amount", code, message: MSG.amountInvalid },
    ]);
  });

  it.each(["", "  ", ",", null, undefined])("空（%s）は required", (amount) => {
    expect(errorsOf(fictionalTransactionInput({ amount }))).toEqual([
      { field: "amount", code: "required", message: MSG.amountRequired },
    ]);
  });
});

describe("BR1.4 メモ", () => {
  it("200 文字（書記素）までを受け付ける。絵文字・結合文字も1文字と数える", () => {
    const emoji = graphemes(200, "👨‍👩‍👧");
    const result = validateTransactionInput(fictionalTransactionInput({ memo: emoji }));
    expect(result.ok && result.value.memo).toBe(emoji);
    expect(errorsOf(fictionalTransactionInput({ memo: graphemes(200, "が") }))).toEqual([]);
  });

  it("201 文字は too-long", () => {
    expect(errorsOf(fictionalTransactionInput({ memo: graphemes(201) }))).toEqual([
      { field: "memo", code: "too-long", message: MSG.memoTooLong },
    ]);
  });

  it("前後の空白（全角空白・タブ・改行を含む）を除いた値を返す", () => {
    const result = validateTransactionInput(
      fictionalTransactionInput({ memo: `${IDEOGRAPHIC_SPACE}\t 架空のランチ \r\n` }),
    );
    expect(result.ok && result.value.memo).toBe("架空のランチ");
  });

  it("未指定（undefined・null）は空文字として受け付ける", () => {
    for (const memo of [undefined, null]) {
      const result = validateTransactionInput(fictionalTransactionInput({ memo }));
      expect(result.ok && result.value.memo).toBe("");
    }
  });

  it("文字列以外（数値・配列）は例外にせず memo の required として返す", () => {
    for (const memo of [123, ["架空"]]) {
      expect(errorsOf(fictionalTransactionInput({ memo }))).toEqual([
        { field: "memo", code: "required", message: "メモ：文字で入力してください" },
      ]);
    }
  });
});

describe("BR1.5 種別", () => {
  it.each<[string, string]>([
    ["income", "income"],
    ["expense", "expense"],
    ["EXPENSE", "expense"],
    [" Income ", "income"],
    ["収入", "income"],
    ["支出", "expense"],
  ])("%s を %s として受け付ける", (type, expected) => {
    const result = validateTransactionInput(fictionalTransactionInput({ type }));
    expect(result.ok && result.value.type).toBe(expected);
  });

  it.each(["入金", "expenses", "in come"])("%s は invalid-type", (type) => {
    expect(errorsOf(fictionalTransactionInput({ type }))).toEqual([
      { field: "type", code: "invalid-type", message: MSG.type },
    ]);
  });

  it.each(["", null, 1])("空や想定外の型（%s）は required", (type) => {
    expect(errorsOf(fictionalTransactionInput({ type }))).toEqual([
      { field: "type", code: "required", message: MSG.type },
    ]);
  });
});

describe("BR1.6 必須（カテゴリ）", () => {
  it.each(["", "  ", null, undefined, 3])("カテゴリ id が空や想定外の型（%s）は required", (id) => {
    expect(errorsOf(fictionalTransactionInput({ categoryId: id }))).toEqual([
      { field: "categoryId", code: "required", message: MSG.category },
    ]);
  });
});

describe("BR1.7 全項目を検証し、画面の項目順で返す（AC1.1.2、AC1.1.4）", () => {
  it("1つ目で止めず、日付・種別・カテゴリ・金額・メモの順で全エラーを返す", () => {
    const input = fictionalTransactionInput({
      memo: graphemes(201),
      amount: "abc",
      categoryId: "",
      type: "入金",
      date: "2026-02-29",
    });
    expect(errorsOf(input).map((e) => [e.field, e.code])).toEqual([
      ["date", "invalid-date"],
      ["type", "invalid-type"],
      ["categoryId", "required"],
      ["amount", "not-integer"],
      ["memo", "too-long"],
    ]);
  });

  it("入力そのものが想定外（null）でも例外を投げず、必須項目の required を返す", () => {
    const result = validateTransactionInput(null as unknown as TransactionInput);
    expect(result.ok).toBe(false);
    expect(errorsOf(null as unknown as TransactionInput).map((e) => e.field)).toEqual([
      "date",
      "type",
      "categoryId",
      "amount",
    ]);
  });

  it("文言に入力値を差し込まない（NFR8.3）", () => {
    const hostile = "<script>架空</script>";
    const errors = errorsOf(
      fictionalTransactionInput({ date: hostile, type: hostile, amount: hostile }),
    );
    expect(errors).toHaveLength(3);
    for (const error of errors) {
      expect(error.message).not.toContain(hostile);
    }
  });
});
