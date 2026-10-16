import { describe, expect, it } from "vitest";
import * as contract from "./index";
import { MESSAGES } from "./messages";

const C1_FUNCTIONS = [
  "validateTransactionInput",
  "validateCategoryName",
  "validateBudgetAmount",
  "isValidYearMonth",
  "toYearMonth",
  "normalizeCategoryNameForCompare",
  "encodeCsv",
  "decodeCsv",
  "validateCsvRecord",
  "escapeFormula",
  "unescapeFormula",
] as const;

describe("公開窓口（契約 C1）", () => {
  it.each(C1_FUNCTIONS)("%s を関数として公開する", (name) => {
    expect(typeof contract[name]).toBe("function");
  });

  it("C1 の関数と定数だけを公開し、内部の補助関数や文言の表は公開しない", () => {
    expect(Object.keys(contract).sort()).toEqual(
      [...C1_FUNCTIONS, "CSV_HEADER", "SCHEMA_VERSION"].sort(),
    );
  });

  it("SCHEMA_VERSION は 1（BR5.1）", () => {
    expect(contract.SCHEMA_VERSION).toBe(1);
  });

  it("CSV_HEADER は契約の見出しと一致する", () => {
    expect(contract.CSV_HEADER).toEqual(["date", "type", "category", "amount", "memo"]);
  });
});

describe("固定文言の表（BR6.1、NFR8.3）", () => {
  it("すべての文言が空でない固定の文字列で、差し込みの書式を含まない", () => {
    const messages = Object.values(MESSAGES);
    expect(messages.length).toBeGreaterThanOrEqual(16);
    for (const message of messages) {
      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toMatch(/\$\{|\{[0-9a-zA-Z_]*\}|%s|%d/);
    }
  });

  it("項目名を含む文言は「項目名：直し方」の形", () => {
    for (const message of Object.values(MESSAGES)) {
      if (message.includes("：")) expect(message).toMatch(/^[^：]+：.+$/);
    }
  });
});
