// タブの識別子から、その画面の中身を作る（TabNav の中身）。
import type { ReactNode } from "react";
import type { ScreenId } from "../types";
import { BudgetScreen } from "./BudgetScreen";
import { CategoriesScreen } from "./CategoriesScreen";
import { CsvScreen } from "./CsvScreen";
import { SummaryScreen } from "./SummaryScreen";
import { TransactionsScreen } from "./TransactionsScreen";

export function renderScreen(screen: ScreenId): ReactNode {
  switch (screen) {
    case "transactions":
      return <TransactionsScreen />;
    case "summary":
      return <SummaryScreen />;
    case "budgets":
      return <BudgetScreen />;
    case "categories":
      return <CategoriesScreen />;
    case "csv":
      return <CsvScreen />;
  }
}
