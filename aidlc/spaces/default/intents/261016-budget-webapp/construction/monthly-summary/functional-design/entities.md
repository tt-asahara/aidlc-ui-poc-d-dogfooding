# 月次集計の形（monthly-summary）

- 出典: `inception/contract-design/contract-summary.md`（C1、C3、C4）、`inception/domain-design/components.md`（MonthlySummary）、`inception/domain-design/decisions.md`（ADR-003）、`inception/requirements-analysis/requirements.md`（FR5.1〜FR5.6、NFR5）、`inception/user-stories/stories.md`（US5.1〜US5.4）、`construction/bookkeeping-core/code-generation/code-summary.md`（U4 からの引き継ぎ）
- U5 はデータを持たず、保存もしない（ADR-003）。U4 から受け取った収支・カテゴリ・その月に使う予算だけを入力に、表示のたびに計算する。

```yaml
entities:
  - name: MonthlySummary
    description: 対象月の集計（C4）。保存しない
    attributes:
      - { name: month, logical_type: YearMonth, required: true }
      - { name: incomeTotal, logical_type: integer, required: true, min: 0, constraints: [対象月の収入の amount の合計] }
      - { name: expenseTotal, logical_type: integer, required: true, min: 0, constraints: [ExpenseRow.actual の合計と一致] }
      - { name: balance, logical_type: integer, required: true, constraints: [incomeTotal − expenseTotal。負の値もある] }
      - { name: expenseRows, logical_type: "list of ExpenseRow", required: true, constraints: [支出カテゴリ全件、U4 の listCategories の順] }
      - { name: incomeRows, logical_type: "list of IncomeRow", required: true, constraints: [収入カテゴリ全件、U4 の listCategories の順] }
      - { name: hasTransactions, logical_type: boolean, required: true, constraints: [対象月の収支が1件以上] }
    rules: [BR1.1, BR1.2, BR1.3, BR1.4, BR4.1]

  - name: ExpenseRow
    description: 支出カテゴリ1件の行（C4）
    attributes:
      - { name: categoryId, logical_type: string, required: true }
      - { name: categoryName, logical_type: string, required: true }
      - { name: budget, logical_type: "integer または null", required: true, constraints: [EffectiveBudget.amount。予算なしは null。0 は予算 0 円] }
      - { name: budgetSource, logical_type: BudgetSource, required: true, constraints: [EffectiveBudget.source をそのまま] }
      - { name: actual, logical_type: integer, required: true, min: 0 }
      - { name: remaining, logical_type: "integer または null", required: true, constraints: [budget − actual。budget が null なら null。負の値もある] }
      - { name: over, logical_type: boolean, required: true, constraints: [budget が null でなく actual > budget のとき true] }
    rules: [BR2.1, BR2.2, BR2.3, BR2.4]

  - name: IncomeRow
    description: 収入カテゴリ1件の行（C4）。予算は持たない
    attributes:
      - { name: categoryId, logical_type: string, required: true }
      - { name: categoryName, logical_type: string, required: true }
      - { name: actual, logical_type: integer, required: true, min: 0 }
    rules: [BR3.1]

  - name: SummaryInput
    description: computeMonthlySummary の入力（C4）。U4 から取った値
    attributes:
      - { name: month, logical_type: YearMonth, required: true }
      - { name: transactions, logical_type: "list of Transaction", required: true, constraints: [対象月の収支（U4 の listTransactions の結果）] }
      - { name: categories, logical_type: "list of Category", required: true, constraints: [U4 の listCategories の結果（支出の後に収入、各 sortOrder 順）] }
      - { name: budgets, logical_type: "list of EffectiveBudget", required: true, constraints: [U4 の getEffectiveBudgets の結果（支出カテゴリ全件）] }
    rules: [BR1.1, BR4.2]
```

## 契約 C4 との差分

- なし。
