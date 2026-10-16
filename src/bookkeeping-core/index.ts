// U4 bookkeeping-core の公開窓口（契約 C3）。ほかの Unit（U5〜U7）はこのファイルだけを import する。
// C3 に載っている型と openBook・resolveEffectiveBudgets だけを公開し、内部の部品（持ち主・失敗の置き換え・id）は公開しない。
export type {
  Book,
  BookOpenResult,
  BudgetSource,
  CategoryUsage,
  EffectiveBudget,
  ImportRow,
  OpenBookOptions,
  OperationError,
  RuleViolation,
} from "./types";
export { openBook } from "./book";
export { resolveEffectiveBudgets } from "./budgetPlanner";
