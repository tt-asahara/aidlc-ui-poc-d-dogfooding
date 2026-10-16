## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Iteration:** 1

### 概要

U5 monthly-summary の Functional Design（ADVISORY、1 回のみ）を確認しました。結論は READY です。人間が承認前に知っておくとよい軽微な指摘が 4 件あり、ブロッカーはありません。

- C4 の型との整合: entities.md の MonthlySummary、ExpenseRow、IncomeRow、SummaryInput は契約 C4 と一致しています。「契約 C4 との差分: なし」は正しいです。
- U4 の実 API との整合: Book の listTransactions、listCategories、getEffectiveBudgets と、OperationError の 4 種類（validation、rule、storage、newer-version）に合っています。BR2.4 の前提も実装と一致します。getEffectiveBudgets は支出カテゴリ全件を返し、amount は source が none のとき null になります。listCategories の順は支出が先、収入が後です。category-missing は RuleViolation に存在します。
- トレーサビリティ: traceability.json の upstream_ids は US5.1〜US5.4 の AC 10 件と一致します。OK の target はすべて実在する BR です。rules.md の 12 規則のうち、BR1.1、1.2、1.3、1.4、2.2、2.3、2.4、3.1、4.1 は forward 側で、BR2.1、3.2、4.2 は reverse 側で処理されています。未処理の規則はありません。
- 質問 0 件の妥当性: 合計、行、超過の定義は FR5 と C4 で決まります。予算の引き継ぎは U4 が決めます。表示の細部は U7 が担当します。超過の境界（実績が予算と同額なら超過でない）は spec の例で明示されています。0 件は妥当です。
- 例の表: AC4.3.2 の 0 円予算を含め、すべての例が規則と矛盾しません。

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/monthly-summary/functional-design/rules.md > BR1.2 と BR1.3 と BR4.2、functional-spec.md > W2 | incomeTotal と expenseTotal の定義が揺れています。BR1.2 は「収支の金額の合計」、BR1.3 と W2 は「行の actual の合計」です。W2 の sumByCategory は種別が一致するものだけを数えます。カテゴリ不整合の入力で computeMonthlySummary を直接呼ぶと、定義によって合計が変わります。getMonthlySummary 経由では category-missing で先に失敗するため、この揺れが表に出るのは単体テストだけです。 | 合計は行の actual の和（BR1.3）と一本化し、BR1.2 の文言をそれに合わせてください。または、不整合入力での computeMonthlySummary の挙動を 1 行で明記し、テストの観点に加えてください。 | New |
| R-02 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/monthly-summary/functional-design/rules.md > BR4.2 | カテゴリ不整合の判定が category-missing に集約されています。種別が違う場合は、U4 の RuleViolation に category-type-mismatch がありますが、そちらは使いません。U7 が「別のタブで削除された」と読める失敗を、実際には種別不一致のときにも受け取ります。U4 は同一トランザクション内で書くので、実際に起きる可能性は低いです。 | 種別不一致も category-missing に集約するのか、category-type-mismatch を返すのかを理由付きで決めてください。集約を維持するなら、その旨を functional-spec.md の 3 章に注記してください。 | New |
| R-03 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/monthly-summary/functional-design/functional-spec.md > W1 | 3 回の読み取り（収支、カテゴリ、予算）が別々の非同期呼び出しです。呼び出し順（直列か並列か）と、呼び出しの間に別タブの書き込みが入る可能性への言及がありません。その間にカテゴリが変わると、spec 上は category-missing の失敗になりえます。BR4.2 は「別タブでの削除」を想定していますが、W1 にはその因果が書かれていません。 | 読み取りを直列に行い、不整合を検出したらそのまま失敗にして U7 の再読み込みに任せる旨を W1 に 1 行追記してください。 | New |
| R-04 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/monthly-summary/functional-design/functional-spec.md > 4 章 性能 | NFR3（月次集計の表示切り替え 500ms 以内）の測定対象が、computeMonthlySummary の計算だけを指しているように読めます。実際の予算は、U4 の 3 回の読み取りを含む getMonthlySummary 全体にかかります。目安を NFR Requirements で決めるとありますが、予算の範囲は未定です。 | NFR Requirements で、500ms の予算が U4 の読み取りを含む getMonthlySummary 全体にかかることを明示し、計算部分の目安をそこから割り当ててください。 | New |
