import { describe, expect, it } from "vitest";
import { decodeCsv, encodeCsv } from "./csv";
import { escapeFormula, unescapeFormula } from "./formula";
import { fictionalCsvRecord, fictionalTransactionInput } from "./test-fixtures";
import { validateTransactionInput } from "./values";

describe("BR4.5 書き出し時の数式対策（AC6.2.1）", () => {
  it.each([
    ["=SUM(A1)", "'=SUM(A1)"],
    ["+1", "'+1"],
    ["-1", "'-1"],
    ["@x", "'@x"],
    ["=", "'="],
    ["'=1", "''=1"],
    ["''=1", "'''=1"],
    ["''", "'''"],
  ])("%s は %s にする", (value, expected) => {
    expect(escapeFormula(value)).toBe(expected);
  });

  it.each(["", "'", "'abc", "架空のランチ", "a=1", " =1", "＝1"])("%s は変えない", (value) => {
    expect(escapeFormula(value)).toBe(value);
  });
});

describe("BR4.6 読み込み時に数式対策を戻す（AC6.2.2）", () => {
  it.each([
    ["'=SUM(A1)", "=SUM(A1)"],
    ["''=1", "'=1"],
    ["'''", "''"],
    ["'@x", "@x"],
  ])("%s は %s に戻す", (value, expected) => {
    expect(unescapeFormula(value)).toBe(expected);
  });

  it.each(["", "'", "'abc", "架空", "=1"])("%s は変えない", (value) => {
    expect(unescapeFormula(value)).toBe(value);
  });
});

const COMBINING_VOICED_MARK = String.fromCharCode(0x3099); // 結合用の濁点

// security-design.md 4.3 の往復の値の集合（AC6.2.3、NFR8.1）
const ROUND_TRIP_VALUES = [
  "",
  "'",
  "''",
  "'abc",
  "'=1",
  "''=1",
  "=",
  "=SUM(A1)",
  "+1",
  "-1",
  "@x",
  "架空,カンマ",
  '架空の"引用"',
  "架空\n改行",
  "架空\r\n改行",
  '",=\r\n"',
  "架".repeat(200),
  `架空の結合文字か${COMBINING_VOICED_MARK}`,
  "架空の絵文字👨‍👩‍👧と結合文字が",
];

describe("往復の性質（符号化 → 復号で元に戻る）", () => {
  it.each(ROUND_TRIP_VALUES)("escapeFormula → unescapeFormula: %j", (value) => {
    expect(unescapeFormula(escapeFormula(value))).toBe(value);
  });

  it("encodeCsv → decodeCsv で、カテゴリ名とメモの全値が元に戻る", () => {
    const records = ROUND_TRIP_VALUES.map((value) =>
      fictionalCsvRecord({ category: value, memo: value }),
    );
    const result = decodeCsv(encodeCsv(records));
    expect(result.ok && result.value.map((line) => line.record)).toEqual(records);
  });

  it("先頭がタブのメモは検証で除去され、保存値はタブで始まらない（数式対策の前提）", () => {
    const result = validateTransactionInput(fictionalTransactionInput({ memo: "\t=SUM(A1)" }));
    expect(result.ok && result.value.memo).toBe("=SUM(A1)");
    const memo = result.ok ? result.value.memo : "";
    expect(memo.startsWith("\t")).toBe(false);
    expect(encodeCsv([fictionalCsvRecord({ memo })])).toContain(",'=SUM(A1)\r\n");
  });
});
