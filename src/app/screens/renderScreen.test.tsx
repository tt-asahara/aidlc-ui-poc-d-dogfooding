// タブの中身の対応（5つのタブがそれぞれの画面を出す）。
import { isValidElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { BudgetScreen } from "./BudgetScreen";
import { CategoriesScreen } from "./CategoriesScreen";
import { CsvScreen } from "./CsvScreen";
import { renderScreen } from "./renderScreen";
import { SummaryScreen } from "./SummaryScreen";
import { TransactionsScreen } from "./TransactionsScreen";
import { SCREEN_IDS } from "../types";

function typeOf(node: ReactNode): unknown {
  return isValidElement(node) ? node.type : undefined;
}

describe("タブの中身", () => {
  it("5つのタブがそれぞれの画面を出す（BR9.1）", () => {
    expect(SCREEN_IDS.map((id) => typeOf(renderScreen(id)))).toEqual([
      TransactionsScreen,
      SummaryScreen,
      BudgetScreen,
      CategoriesScreen,
      CsvScreen,
    ]);
  });
});
