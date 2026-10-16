## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-16T09:24:27Z
**Iteration:** 1

### 概要

U1 data-contract の Functional Design は、AC1.1.1〜AC1.1.5 と AC6.2.1〜AC6.2.3 を規則 BR1.1 から BR4.6 に漏れなく結び付けており、開発者が実装に着手できる水準です。数式対策の往復（BR4.5 と BR4.6）も境界値で成り立ちます。人間が承認前に判断すべき事項は、CSV 行の検証の入り口と文言の食い違い（Major）、および契約 C1 の更新時期（Major）の2点です。残りは Minor です。

### 検証内容

- traceability.json を解析しました。upstream_ids の8件はすべて OK で、target の BR 番号はすべて rules.md に存在します。rules.md の19規則のうち、BR1.1、BR1.3、BR1.4、BR2.1、BR2.2、BR3.1、BR4.5、BR4.6 は target に含まれ、残り11規則は reverse に理由つきで載っています。
- stories.md の AC1.1.1〜AC1.1.5 と AC6.2.1〜AC6.2.3 の本文を、割り当てた規則と突き合わせました。対応は妥当です。unit-of-work-story-map.md の担当（US1.1 と US6.2 が U1）とも一致します。
- BR4.5 と BR4.6 を境界値で手計算しました。次の値はすべて「書き出し → 読み込み」で元に戻ります。
  - `=SUM(A1)`
  - `+1`
  - `-1`
  - `@x`
  - `'=1`（`''=1` を経由）
  - `'abc`（変化なし）
  - `'`（単独）
  - `''`（`'''` を経由）
  - 空文字
  - 先頭が数式記号でない通常の値
  
  往復の主張は成立します。
- 内容は contract-summary.md の C1 と照合しました。関数名、型、CSV_HEADER、SCHEMA_VERSION は一致します。差分は `out-of-range-date` の追加と、下記の指摘のとおりです。
- Q1〜Q3 の回答（A、A、A）は BR1.3、BR1.1、BR1.5 に反映されています。

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261016-budget-webapp/construction/data-contract/functional-design/rules.md > BR1.6、BR1.5、BR4.7、BR6.1 と functional-spec.md > W1、W5 | CSV 行の検証の入り口が決まっていません。C1 の公開関数は、`categoryId` を取る `validateTransactionInput` だけです。ところが BR4.7 は CSV 行にも同じ規則を使うとしています。BR1.6 は CSV で別の文言（「カテゴリを指定してください」）を要求し、BR6.1 は「画面と CSV で同じ文言」と定めており、この2つは矛盾します。`ValidationError.field` に `category` がありますが、どの規則もこの値を返しません。BR1.5 の statement は「CSV 読み込みでは収入・支出も受け付ける」と限定していますが、logic は入力元を問わず受け付けます。 | CSV 行を検証する関数（または入力元を区別する引数）を C1 に加えるか、U6 が名前から id を解決してから `validateTransactionInput` を呼ぶ前提を明記してください。それに合わせて次を整理してください。(1) `field` に `category` を使うかどうか。(2) CSV 用の文言を認めるのか、BR6.1 を直すのか。(3) BR1.5 の statement と logic のどちらが正か。 | New |
| R-02 | Major | aidlc/spaces/default/intents/261016-budget-webapp/construction/data-contract/functional-design/functional-spec.md > 7. 他の Unit とのつながり、entities.md > 概要 | `ValidationError.code` への `out-of-range-date` の追加を、`contract-summary.md` の C1 に反映するのがコード生成の時点になっています。それまで下流 Unit（U3〜U7）の設計は、このコードのない C1 を前提に進みます。契約文書自身が「`code` の列挙への追加は、画面が種類ごとに表示を決めるため破壊的変更」と定めています。U7 のエラー表示と U6 の不正行の理由は、このコードの分岐を持たなければなりません。 | 下流 Unit の設計が古い契約を読まないよう、C1 の `ValidationCode` へ `out-of-range-date` を加える更新を、この Unit の承認と同時に行うか、更新が済むまで下流が参照すべき差分として spec 内に明示してください。 | New |
| R-03 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/data-contract/functional-design/rules.md > BR1.1 logic | 「前後の空白を除いた値」で判定しますが、受け付けたときは「値は変えない」とあり、返す値が空白除去後か元の値か読み取れません。元の値を返すと `Transaction.date` に空白が残ります。 | 受け付けた場合は空白除去後の値を返す、と明記してください。 | New |
| R-04 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/data-contract/functional-design/rules.md > BR1.3、functional-spec.md > 6. 境界値の例 | 数値で渡した `-1` は範囲外ですが、文字列の `"-1"` は半角数字だけでないため not-integer になり、エラーコードが入力の型で変わります。境界値表も「not-integer または out-of-range」と曖昧に書いており、テストが期待値を決められません。 | 型ごと、入力ごとの期待コードを表にしてください（`0`、`-1`、`"0"`、`"-1"`、`1.5` など）。 | New |
| R-05 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/data-contract/functional-design/rules.md > BR4.3 | 「完全に空の行（値が1つもない行）」を飛ばすとありますが、`,,,,` のように空値が5つ並ぶ行を飛ばすかどうかは決まっていません。単独の CR が改行として扱われるかどうかも書かれていません。 | 空行の定義を「空文字だけの行」か「全列が空の行」かで明記し、CR 単独の扱いも書いてください。 | New |
| R-06 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/data-contract/functional-design/entities.md > TransactionInput.memo、functional-spec.md > W1 | entities.md は `memo` を任意（`required: false`）、C1 の型は必須の `string` です。W1 は null を required として返すとありますが、`memo` には required の項目になる規則がなく、未指定のときの扱いが BR1.4 の「未指定は空文字」とだけ対応しています。C1 の公開関数のうち、`toYearMonth` は規則も手順も持ちません。 | `memo` の未指定（undefined、null）は空文字として扱う、と明記してください。あわせて `toYearMonth` の仕様（入力が `IsoDate` の前提でよいか）を1行で書いてください。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| traceability.json の解析と rules.md との突き合わせ | PASS（coverage の target 8件がすべて存在、rules.md の19規則が target か reverse に載っている） | 規則の孤児も、存在しない BR への参照もありません。 |
| BR4.5 と BR4.6 の手計算による往復の確認 | PASS（10種の値で元に戻る） | 往復の主張は成り立ちます。 |

### Summary

構造と往復の設計は健全で、指摘はどれも Unit の設計を実装に移すための明確化です。承認前に、CSV 行の検証の入り口と文言の矛盾（Major）と、C1 への `out-of-range-date` 反映時期（Major）を判断してください。
