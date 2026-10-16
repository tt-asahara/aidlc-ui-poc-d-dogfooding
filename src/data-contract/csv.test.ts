import { describe, expect, it } from "vitest";
import { CSV_HEADER, decodeCsv, encodeCsv, validateCsvRecord } from "./csv";
import { fictionalCsvRecord } from "./test-fixtures";
import type { CsvLine } from "./types";

const BOM = String.fromCharCode(0xfeff);
const HEADER_LINE = "date,type,category,amount,memo";

function decodedLines(text: string): CsvLine[] {
  const result = decodeCsv(text);
  if (!result.ok) throw new Error(`復号に失敗しました: ${JSON.stringify(result.error)}`);
  return result.value;
}

describe("BR4.1 見出し", () => {
  it("見出しは date,type,category,amount,memo", () => {
    expect(CSV_HEADER).toEqual(["date", "type", "category", "amount", "memo"]);
  });

  it("前後の空白は除いて比べる", () => {
    const lines = decodedLines(" date , type,category ,amount, memo\n2026-10-01,expense,架空,1,\n");
    expect(lines).toHaveLength(1);
  });

  it.each([
    ["日付,金額", ["日付", "金額"]],
    ["DATE,TYPE,CATEGORY,AMOUNT,MEMO", ["DATE", "TYPE", "CATEGORY", "AMOUNT", "MEMO"]],
    ["date,type,category,amount", ["date", "type", "category", "amount"]],
    [
      "date,type,category,amount,memo,extra",
      ["date", "type", "category", "amount", "memo", "extra"],
    ],
  ])("見出し %s は header-mismatch（実際の見出しを添える）", (header, found) => {
    expect(decodeCsv(`${header}\r\n2026-10-01,expense,架空,1,\r\n`)).toEqual({
      ok: false,
      error: { kind: "header-mismatch", found },
    });
  });
});

describe("BR4.2 書き出しの形式", () => {
  it("0件は BOM と見出し行だけ", () => {
    expect(encodeCsv([])).toBe(`${BOM}${HEADER_LINE}\r\n`);
  });

  it("BOM・見出し・CRLF で1レコード1行、最終行の後にも CRLF", () => {
    expect(encodeCsv([fictionalCsvRecord(), fictionalCsvRecord({ amount: "300", memo: "" })])).toBe(
      `${BOM}${HEADER_LINE}\r\n2026-10-01,expense,架空の食費,1200,架空のランチ\r\n` +
        `2026-10-01,expense,架空の食費,300,\r\n`,
    );
  });

  it('カンマ・ダブルクォート・改行・前後の空白を含む値は引用し、内部の " は重ねる', () => {
    const text = encodeCsv([
      fictionalCsvRecord({ category: " 架空 ", memo: '架空,"引用"\n2行目' }),
    ]);
    expect(text).toBe(
      `${BOM}${HEADER_LINE}\r\n2026-10-01,expense," 架空 ",1200,"架空,""引用""\n2行目"\r\n`,
    );
  });

  it("カテゴリ名とメモに数式対策を適用する（日付・種別・金額には適用しない）", () => {
    const text = encodeCsv([fictionalCsvRecord({ category: "=架空", memo: "@架空" })]);
    expect(text).toContain(",'=架空,1200,'@架空\r\n");
  });
});

describe("BR4.3 読み込み", () => {
  const body = "2026-10-01,expense,架空の食費,1200,架空のランチ";

  it("BOM の有無と CRLF・LF の改行を同じように受け付ける", () => {
    const expected = decodedLines(`${BOM}${HEADER_LINE}\r\n${body}\r\n`);
    expect(decodedLines(`${HEADER_LINE}\n${body}\n`)).toEqual(expected);
    expect(decodedLines(`${HEADER_LINE}\r\n${body}`)).toEqual(expected);
    expect(expected).toEqual([
      {
        line: 2,
        record: fictionalCsvRecord(),
        fields: ["2026-10-01", "expense", "架空の食費", "1200", "架空のランチ"],
      },
    ]);
  });

  it("引用内の改行・カンマ・重ねたダブルクォートは値の一部。行番号はレコードの開始行", () => {
    const text =
      `${HEADER_LINE}\r\n` +
      `2026-10-01,expense,架空の食費,1,"1行目,""架空""\r\n2行目\n3行目"\r\n` +
      `2026-10-02,income,架空の給与,2,\r\n`;
    const lines = decodedLines(text);
    expect(lines.map((l) => l.line)).toEqual([2, 5]);
    expect(lines[0]?.record.memo).toBe('1行目,"架空"\r\n2行目\n3行目');
    expect(lines[1]?.record.type).toBe("income");
  });

  it("完全に空の行は飛ばし、行番号は元ファイルの物理行のまま", () => {
    const lines = decodedLines(`${HEADER_LINE}\r\n\r\n${body}\n\n\n${body}\r\n`);
    expect(lines.map((l) => l.line)).toEqual([3, 6]);
  });

  it("引用した空の値だけの行は空の行として飛ばさない", () => {
    const lines = decodedLines(`${HEADER_LINE}\n""\n`);
    expect(lines).toEqual([
      {
        line: 2,
        record: { date: "", type: "", category: "", amount: "", memo: "" },
        fields: [""],
      },
    ]);
  });

  it("閉じていない引用は malformed（引用が始まった行番号）", () => {
    const result = decodeCsv(`${HEADER_LINE}\n${body}\n2026-10-03,expense,"架空\n続き\n`);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatchObject({ kind: "malformed", line: 3 });
  });

  it("閉じた引用の直後に余分な文字がある値は malformed", () => {
    const result = decodeCsv(`${HEADER_LINE}\n2026-10-01,expense,"架空"x,1,\n`);
    expect(!result.ok && result.error).toMatchObject({ kind: "malformed", line: 2 });
  });

  it("列が5でないレコードも返し、足りない列は空文字、全列は fields に残す", () => {
    const lines = decodedLines(`${HEADER_LINE}\n2026-10-01,expense\n${body},余分\n`);
    expect(lines[0]?.record).toEqual({
      date: "2026-10-01",
      type: "expense",
      category: "",
      amount: "",
      memo: "",
    });
    expect(lines[0]?.fields).toHaveLength(2);
    expect(lines[1]?.fields).toHaveLength(6);
  });

  it("カテゴリ名とメモから数式対策の ' を1つ外す（ほかの列は外さない）", () => {
    const lines = decodedLines(`${HEADER_LINE}\n'2026-10-01,expense,'=架空,1,''=1\n`);
    expect(lines[0]?.record).toMatchObject({ date: "'2026-10-01", category: "=架空", memo: "'=1" });
    expect(lines[0]?.fields?.[2]).toBe("'=架空");
  });
});

describe("BR4.4 空の判定", () => {
  it.each([
    ["0 バイト", ""],
    ["BOM のみ", BOM],
    ["空白と改行のみ", " \r\n\n"],
    ["見出しのみ", `${BOM}${HEADER_LINE}\r\n`],
    ["見出しのみ（改行なし）", HEADER_LINE],
    ["見出しと空の行のみ", `${HEADER_LINE}\n\n\n`],
  ])("%s は empty", (_label, text) => {
    expect(decodeCsv(text)).toEqual({ ok: false, error: { kind: "empty" } });
  });

  it("文字列以外は例外にせず empty とする", () => {
    expect(decodeCsv(undefined as unknown as string)).toEqual({
      ok: false,
      error: { kind: "empty" },
    });
  });
});

describe("validateCsvRecord（BR4.7・BR1.6）", () => {
  it("画面入力と同じ規則で列を検証し、正規化した値を返す", () => {
    expect(
      validateCsvRecord(fictionalCsvRecord({ amount: "１，２００", memo: " 架空のランチ " })),
    ).toEqual({
      ok: true,
      value: {
        date: "2026-10-01",
        type: "expense",
        categoryName: "架空の食費",
        amount: 1200,
        memo: "架空のランチ",
      },
    });
  });

  it.each<[string, string]>([
    ["収入", "income"],
    ["支出", "expense"],
    ["Income", "income"],
  ])("種別「%s」は %s", (type, expected) => {
    const result = validateCsvRecord(fictionalCsvRecord({ type }));
    expect(result.ok && result.value.type).toBe(expected);
  });

  it("カテゴリ名が空なら category の required（CSV 用の文言）", () => {
    expect(validateCsvRecord(fictionalCsvRecord({ category: "  " }))).toEqual({
      ok: false,
      error: [{ field: "category", code: "required", message: "カテゴリを指定してください" }],
    });
  });

  it("全列を検証し、日付・種別・カテゴリ・金額・メモの順でエラーを返す", () => {
    const result = validateCsvRecord({
      date: "2026-02-30",
      type: "入金",
      category: "",
      amount: "1200円",
      memo: "a".repeat(201),
    });
    expect(!result.ok && result.error.map((e) => [e.field, e.code])).toEqual([
      ["date", "invalid-date"],
      ["type", "invalid-type"],
      ["category", "required"],
      ["amount", "not-integer"],
      ["memo", "too-long"],
    ]);
  });

  it("日付の範囲外・金額の範囲外も画面入力と同じ code", () => {
    const result = validateCsvRecord(fictionalCsvRecord({ date: "1999-12-31", amount: "0" }));
    expect(!result.ok && result.error.map((e) => e.code)).toEqual([
      "out-of-range-date",
      "out-of-range",
    ]);
  });
});
