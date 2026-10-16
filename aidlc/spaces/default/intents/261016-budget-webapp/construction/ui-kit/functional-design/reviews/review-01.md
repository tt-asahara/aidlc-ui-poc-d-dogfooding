## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Iteration:** 1

### 概要

U2 ui-kit の機能設計は、US9.2（AC9.2.1〜AC9.2.3）を BR5.1〜BR5.5 に対応づけており、実装に進める水準です。重大な欠陥はありません。ただし、契約 C6 との差分の記述が不完全で、標準 dialog の Esc の扱いに未定義の点があります。この 2 点は、人間が承認前に確認する価値があります。

### 検証内容

- traceability.json を確認しました。AC9.2.1〜AC9.2.3 の対象 BR はすべて rules.md に存在します。
- rules.md の BR1.1〜BR8.3 の 27 規則は、対象として参照されているか、reverse に N/A で載っているかのどちらかです。漏れと孤立はありません。
- entities.md の rules 参照は、すべて rules.md に解決します。
- functional-spec.md の W1〜W4 と状態遷移は、BR5.x・BR6.x・BR8.x と整合しています。
- C6（contract-summary.md）と entities.md の props を突き合わせました。その結果を Findings に記します。

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261016-budget-webapp/construction/ui-kit/functional-design/functional-spec.md > 7. 契約 C6 との差分、entities.md > ButtonProps・FieldProps・DialogProps・InlineMessageProps・FieldErrorProps | 7 章は C6 との差分を 3 件（elementRef、onClose の理由、Tabs の disabled）としていますが、実際の差分はもっと多くあります。(1) Dialog の `initialFocusRef` と `returnFocusRef` は C6 では RefObject ですが、設計では `initialFocus` と `returnFocus` の要素参照です。(2) FieldErrorProps の `field` が `fieldLabel` に変わっています。(3) InlineMessage の `children` が `text`（文字列）に、Button の `children` が `label` に変わっています。(4) C6 にある onClick、TextField の onChange・onEnter、Select の error、RadioGroup の legend・name が、FieldProps と ButtonProps にありません。C6 の変更ルール（Q4）では、名前や型の変更は破壊的変更です。このままコード生成に進むと、U7 が C6 の型で書いた呼び出しと食い違います。 | 7 章の差分一覧を、C6 と entities.md を 1 項目ずつ突き合わせて作り直します。名前変更と型変更は C6 側を設計に合わせるか、設計を C6 に戻すかを決めます。onClick・onChange・onEnter・legend・name を entities.md に追加します。コード生成で C6 を同じ変更で更新する対象を明記します。 | New |
| R-02 | Major | aidlc/spaces/default/intents/261016-budget-webapp/construction/ui-kit/functional-design/rules.md > BR5.4、BR5.6、functional-spec.md > 3. 状態遷移 Dialog | BR5.4 は「cancel の動作を受けて onClose("escape") を呼び、閉じるかは呼び出し側の open で決まる」としています。標準の dialog 要素は、cancel を既定動作のまま放置すると自分で閉じます。その場合、open が真のまま実際の dialog は閉じる、という食い違いが起こります。処理中に閉じさせない用途（BR5.4 の意図）も成り立ちません。cancel の既定動作を止める旨が、規則にも状態遷移にも書かれていません。open が偽になったとき以外の閉じ方（ブラウザによる閉じ）をどう扱うかも未定義です。 | BR5.4 に、cancel イベントの既定動作を止めて onClose("escape") だけを呼ぶことを明記します。BR5.5 のフォーカスの戻しが、open が偽になったときだけ動くことも確認します。テストの観点に、「Esc の後も open が真なら dialog が開いたまま」を追加します。 | New |
| R-03 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/ui-kit/functional-design/rules.md > BR6.2、inception/contract-design/contract-summary.md > 2. 共通の決まり（時間切れと再試行） | contract-summary.md は、読み込みが 5 秒を超えたときの「時間がかかっています」表示を U7 の画面が行うとしています。一方、BR6.2 は StatusPanel がこれを行います。C6 には slowAfterMs があるため BR6.2 のほうが整合しますが、責務の記述が上流とずれています。 | 責務を StatusPanel に置くと明記し、contract-summary.md の該当文を C6 更新のときに直します。 | New |
| R-04 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/ui-kit/functional-design/entities.md > TabsProps、functional-spec.md > 7 章、inception/refined-mockups/interaction-spec.md > TabNav の disabled 状態 | Tabs から disabled を外す決定（R-05）は設計側で済んでいますが、interaction-spec.md の TabNav にはまだ disabled 状態（S0-a・S0-b の表示中）が残っています。 | コード生成が interaction-spec.md を参照して disabled を実装しないよう、設計側に「interaction-spec の disabled は適用しない」と明記します。 | New |
| R-05 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/ui-kit/functional-design/rules.md > BR6.1、BR6.3、BR4.x、entities.md > DataTableProps.busy・InlineMessageProps.autoHideMs・DialogState | 規則のない設定項目や状態があります。DataTable の busy の振る舞い（aria-busy の有無など）に規則がありません。InlineMessage で tone が error のとき autoHideMs を渡した場合の扱いが未定義です。BR6.3 の「同じ文言が再び来たら数え直す」は、props の変化だけでは再発を検出できません。起動時の unavailable・newer-version で見出しへフォーカスを移す件（interaction-spec の StatusPanel）は、U7 が行うのか部品が行うのか書かれていません。DialogState に紐づく規則もありません。 | busy・autoHideMs（error）・再表示の検出方法（key の変更など）・見出しへのフォーカスの担当・DialogState の規則を、それぞれ 1 行で決めて書き足します。 | New |

### 構造検証の結果

| 項目 | 結果 | 解釈 |
|---|---|---|
| traceability.json の OK 対象 BR の存在 | PASS | BR5.1〜BR5.5 はすべて rules.md にあります。 |
| 全規則の対象指定または reverse への掲載 | PASS | 27 規則すべてが対象指定または reverse に載っています。 |
| entities.md の rules 参照 | PASS | すべて解決します。 |
| C6 との props 突き合わせ | 差異あり | 上記の 1 件目の Major を参照してください。 |
