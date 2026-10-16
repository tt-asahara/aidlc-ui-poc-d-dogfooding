## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-16T14:14:43Z
**Iteration:** 1

### 概要

今回は ADVISORY（1 回限り）のレビューです。traceability.json を解析し、参照している BR がすべて rules.md に存在すること、未参照の規則がないことを確認しました（欠落 0、未使用 0）。C3 の Book 操作、C4 の MonthlySummary、C5 の ExportResult / ImportPreview / ImportFileError の型を、実装済みの src/ と突き合わせました。画面から使う操作はすべて実在し、型も一致しています。mockups.md の画面状態（S0-a、S0-b、S1-1 から S1-7、D1、S2-1 から S2-3、S3-1、S4、D2、S5、D3）は、すべてどこかの規則または機能仕様に反映されています。Q1 = A（D2 は予算の件数だけを示す）は BR3.4 と entities.md の差分欄に一貫して反映されています。

Critical や Major の欠陥は見つかりませんでした。実装者が推測で補うことになる点が、以下の Minor 6 件です。承認前にご判断ください。

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/app-screens/functional-design/rules.md > BR7.1 | BR7.1 は ImportFileError の文言を U7 側で固定している。しかし U6 の ImportFileError には、U6 が持つ固定文言をそのまま返す kind がある。read-failed は notUtf8「UTF-8 の CSV ファイルを選んでください」と readFailed の 2 種類を message で返す。malformed の message は U1 の文言（例「引用が閉じられていません」）。BR7.1 の表では、read-failed が「ファイルを読み込めませんでした」の 1 種類に、malformed が「｛行｝行目の形式が違います」に置き換わり、U6 の理由が消える。functional-spec 5章の「承認済みの文言を言い換えない」とも食い違う。 | read-failed と malformed は message をそのまま表示すると決める。malformed は行番号を添えるだけにする。固定文言を U7 で持つのは message を持たない 4 種類（header-mismatch、empty、too-large、too-many-rows）に限る。 | New |
| R-02 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/app-screens/functional-design/rules.md > BR7.1、BR7.4 | parseImportFile は ImportFileError だけでなく OperationError（storage、newer-version）も返す。commitImport は validation（line 付き）も返す。BR7.1 は前者の storage を、BR7.4 は後者の validation を扱っていない。取り込みの確定時に再検証が失敗した場合の画面の動きが決まっていない。 | parseImportFile の storage は BR8.2 の読み込み失敗の表示にするか、ファイル欄の固定の文言にするかを決める。commitImport の validation（line 付き）は D3 の中に「｛行｝行目を確認してください」などと示し、D3 を閉じるか残すかも決める。 | New |
| R-03 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/app-screens/functional-design/rules.md > BR3.4 と functional-spec.md 4章 | D2 の確定時に deleteCategory が返す rule（category-in-use、last-category-of-type、not-found）の扱いが書かれていない。mockups.md の D2 には「確定時に最新データで使用件数を再確認し、使われていたら削除せず理由を表示する」とある。成功時の知らせ（deletedBudgets の件数を含めるか）も未定義。functional-spec 4章の「rule（その他）は各画面の文言」は BR3.4 と BR4.3 だけを指しており、not-found（収支の更新・削除、カテゴリの名前変更）と category-type-mismatch の文言はどの規則にもない。 | D2 の確定時の失敗の表示（D2 を閉じて行の下に理由を出す、など）と成功の知らせを BR3.4 に追加する。not-found と category-type-mismatch の画面の文言と、その後の操作（表示の取り直し）を 1 か所に定める。 | New |
| R-04 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/app-screens/functional-design/rules.md > BR2.4、BR1.4 | 編集で日付を別の月に変えて保存した場合、共有の対象月（SharedMonth）を移すのか、元の月のまま見せて「2026年11月に移動しました」だけを出すのかが書かれていない。BR1.4 は月の変更が他のタブに波及すると定めており、「移動」の意味によって予算・集計タブの月が変わるかどうかが分かれる。mockups.md S1-2 も同じ曖昧さを持つ。 | BR2.4 に、対象月を移すかどうかを 1 文で明記する（既定は元の月のまま、とする案が最小）。 | New |
| R-05 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/app-screens/functional-design/entities.md > AsyncView と rules.md > BR1.4、BR8.1 | 月を素早く切り替えたときに、遅れて返った古い月の読み取り結果が新しい月の表示を上書きする競合への規則がない。getMonthlySummary は 3 回の読み取りを順に行うため、切り替えの間にずれが起きやすい。AsyncView の state にリクエストの識別子がない。あわせて、タブを切り替えたときの編集中のフォーム値・追加欄の入力値を保持するか破棄するかも未定義。 | AsyncView に最新の要求だけを反映する規則を 1 つ追加する（例: 要求ごとの連番を持ち、最新でない結果は捨てる）。タブ切り替え時の入力の扱い（破棄でよい）も 1 文で記す。 | New |
| R-06 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/app-screens/functional-design/rules.md > BR1.1 | BR1.1 は「文言の『項目名：』は U1 の文言に含まれている」と書くが、U1 の文言には項目名から始まらないものがある（例: csv.test.ts の「カテゴリを指定してください」は「カテゴリ」で始まるが、項目名の後ろに「：」は付かない）。実際に二重を避けているのは U2 の formatFieldError（項目名で始まる文はそのまま、そうでなければ「項目名：」を付ける）で、FieldError を通せば足りる。規則の説明が実装の事実とずれている。 | BR1.1 の logic を「FieldError（formatFieldError）に項目名とメッセージを渡す。画面側で項目名を足さない」に直す。 | New |
