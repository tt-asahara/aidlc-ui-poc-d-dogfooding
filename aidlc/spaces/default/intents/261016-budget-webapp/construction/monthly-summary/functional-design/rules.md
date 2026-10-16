# 月次集計の規則（monthly-summary）

- 出典: `inception/requirements-analysis/requirements.md`（FR5.1〜FR5.6、NFR5）、`inception/user-stories/stories.md`（AC5.1.1〜AC5.4.2、AC4.3.2）、`inception/contract-design/contract-summary.md`（C3、C4）、`inception/domain-design/decisions.md`（ADR-003）、`functional-design-questions.md`（質問0件）

```yaml
rules:
  - id: BR1.1
    statement: 集計は対象月の収支だけを使う
    category: calculation
    applies_to: [computeMonthlySummary, MonthlySummary]
    trigger: computeMonthlySummary の呼び出し時
    logic: transactions のうち date の先頭7文字が month と一致するものだけを数える（U4 の listTransactions は対象月だけを返すが、計算の側でも念のため絞る）
    violation: なし
    source: FR5.2, AC5.1.2

  - id: BR1.2
    statement: 収入合計は対象月の収入の金額の合計、支出合計は支出の金額の合計、差額は収入合計 − 支出合計
    category: calculation
    applies_to: [MonthlySummary]
    trigger: computeMonthlySummary の呼び出し時
    logic: 整数の足し算・引き算だけで求める（小数・丸めを使わない）。差額は負の値もありうる
    violation: なし
    source: FR5.2, NFR5, AC5.1.1, AC5.1.3

  - id: BR1.3
    statement: 支出合計は支出カテゴリ別の実績の合計と一致する
    category: invariant
    applies_to: [MonthlySummary, ExpenseRow]
    trigger: computeMonthlySummary の結果
    logic: expenseTotal を ExpenseRow.actual の合計として求める（incomeTotal も IncomeRow.actual の合計）。収支のカテゴリが categories にない場合（通常は起きない）は「不明なカテゴリ」の行を作らず、BR4.2 のとおり getMonthlySummary で失敗として扱う
    violation: なし
    source: FR5.4, AC5.2.3

  - id: BR1.4
    statement: 対象月に収支が1件もなければ hasTransactions を false にし、合計はすべて 0 にする
    category: calculation
    applies_to: [MonthlySummary]
    trigger: 対象月の収支が0件のとき
    logic: incomeTotal・expenseTotal・balance は 0、各行の actual は 0。予算の行は予算をそのまま表示に使えるよう残す（remaining = budget）。文言と登録への導線は U7
    violation: なし
    source: FR5.5, AC5.4.1, AC5.4.2

  - id: BR2.1
    statement: 支出カテゴリごとに、予算・実績・残り・超過の行を作る（実績も予算もないカテゴリも含め全件）
    category: calculation
    applies_to: [ExpenseRow]
    trigger: computeMonthlySummary の呼び出し時
    logic: categories の支出カテゴリそれぞれについて、対象月のそのカテゴリの支出の金額の合計を actual とし、budgets から同じ categoryId の EffectiveBudget を引いて budget・budgetSource にする
    violation: なし
    source: FR5.3

  - id: BR2.2
    statement: 残りは予算 − 実績。予算なしのときは残りもなし
    category: calculation
    applies_to: [ExpenseRow]
    trigger: 行の計算時
    logic: budget が null なら remaining は null。そうでなければ budget − actual（負の値もある。0 円予算も計算する）
    violation: なし
    source: FR5.3, AC5.2.1, AC5.2.2, AC5.4.2

  - id: BR2.3
    statement: 超過は、予算があり実績が予算より大きいときだけ。予算なしは超過としない。0 円予算は判定する
    category: calculation
    applies_to: [ExpenseRow]
    trigger: 行の計算時
    logic: over = budget !== null && actual > budget。実績が予算と同じ額は超過ではない
    violation: なし
    source: FR5.3, FR4.2, AC5.2.1, AC5.2.2, AC4.3.2

  - id: BR2.4
    statement: 予算の値と出所は U4 の結果をそのまま使い、U5 では引き継ぎを計算し直さない
    category: policy
    applies_to: [ExpenseRow]
    trigger: 行の計算時
    logic: EffectiveBudget の amount と source をそのまま budget と budgetSource にする。budgets に行がない支出カテゴリは budget null・source none とする
    violation: なし
    source: FR4.3, C3, C4

  - id: BR3.1
    statement: 収入カテゴリごとに実績の行を作る（実績のないカテゴリも含め全件）。予算は持たない
    category: calculation
    applies_to: [IncomeRow]
    trigger: computeMonthlySummary の呼び出し時
    logic: categories の収入カテゴリそれぞれについて、対象月のそのカテゴリの収入の金額の合計を actual にする
    violation: なし
    source: FR5.6, AC5.3.1

  - id: BR3.2
    statement: 行の並びは U4 のカテゴリの並び（各種別の sortOrder 順）のまま
    category: calculation
    applies_to: [ExpenseRow, IncomeRow]
    trigger: 行の計算時
    logic: categories の順を保つ。並べ替えはしない
    violation: なし
    source: C3（listCategories の並び）, C4

  - id: BR4.1
    statement: getMonthlySummary は、U4 から対象月の収支・カテゴリ・その月に使う予算を取り、computeMonthlySummary に渡す
    category: policy
    applies_to: [getMonthlySummary]
    trigger: getMonthlySummary の呼び出し時
    logic: book.listTransactions(month)、book.listCategories()、book.getEffectiveBudgets(month) を呼び、どれかが失敗したら最初の失敗の OperationError をそのまま返す（month の検証も U4）。すべて成功したら計算結果を ok で返す
    violation: U4 の OperationError（validation・storage・newer-version）
    source: C4, FR8.2

  - id: BR4.2
    statement: 計算は同期の純粋な関数で、例外を投げない。入力の食い違い（収支のカテゴリが一覧にない）は getMonthlySummary で失敗として返す
    category: invariant
    applies_to: [computeMonthlySummary, getMonthlySummary]
    trigger: すべての呼び出し
    logic: >
      computeMonthlySummary は入力だけから結果を作り、保存・時計・乱数に触れない。カテゴリが一覧にない（または種別が違う）収支はどの行にも
      入れず、合計にも入れない（合計と行の和が必ず一致する。C4 の型は変えない）。getMonthlySummary は計算の前に、対象月の収支の categoryId が
      すべて同じ種別のカテゴリとして一覧にあるかを確かめ、1件でもなければ { kind: rule, violation: { code: category-missing } } を返す
      （一部が抜けた集計を見せない）。想定外の例外は getMonthlySummary で { kind: storage, message: "データを読み込めませんでした" } にする
    violation: rule（category-missing）、storage
    source: ADR-003, NFR5, FR5.4, 契約の共通の決まり
```

## 規則の要約

| 範囲 | 規則 |
|------|------|
| 合計 | BR1.1〜BR1.4 |
| 支出の行 | BR2.1〜BR2.4 |
| 収入の行と並び | BR3.1、BR3.2 |
| 取得と失敗 | BR4.1、BR4.2 |
