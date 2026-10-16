## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-16T12:32:57Z
**Iteration:** 1

### 概要

U6 csv-exchange の機能設計（ADVISORY の1回のみの確認）。U1 の実装（csv.ts、formula.ts、values.ts、index.ts）と U4 の公開型（Book、ImportRow、OperationError）に対して、書き出し・読み込み・確定の流れを突き合わせた。契約 C5 の型、AC6.1.1〜AC7.4.2 の21件はすべて traceability.json の OK 行で規則に結び付いており、逆引きの N/A 7件も妥当。BOM・CRLF・数式対策の往復、5,000 件・1MB の境界、U4 への1回の importTransactions 呼び出しは、U1・U4 の実際の挙動と整合する。人間が承認前に確認すべき点は、BR3.3 の「検証失敗行でもカテゴリを照合する」が U1 の公開窓口だけでは実現できないこと（Major 1件）と、軽微な4件。Critical はない。

### 検証内容

- traceability.json を解析し、AC 21件がすべて OK で、対象の BR がすべて rules.md に存在することを確認した。
- U1 の decodeCsv の挙動を確認した。BOM 除去、空・空白のみ・見出しのみは empty、見出し不一致は header-mismatch、引用の不整合は malformed（物理行番号つき）で、レコード行番号は見出しを1行目とする。これは BR2.3 と PreviewRow.line の定義に合う。
- U4 の listAllTransactions（日付の古い順、`"all"` か `{ month }`）と importTransactions（全件追加か0件、`import-category-missing` に `lines`）が BR1.1、BR4.1、BR4.2 の前提と一致することを確認した。
- vitest.config.ts を確認した。csv-exchange 用のプロジェクト定義はまだない。

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261016-budget-webapp/construction/csv-exchange/functional-design/rules.md > BR3.3（および functional-spec.md の W2 手順） | BR3.3 は「U1 の検証で失敗した項目がある行でも、種別とカテゴリ名が検証を通っていれば照合し、理由をまとめて返す」としている。しかし validateCsvRecord は全項目が通ったときだけ値（ValidCsvRecord）を返し、失敗時は ValidationError の配列しか返さない。種別の正規化（validateEntryType は大文字小文字を無視し 収入／支出 も受け付ける）と trimText は U1 の index.ts から公開されていない。このため部分失敗の行では、U6 は正規化済みの種別とトリム済みのカテゴリ名を得られない。U1 の規則を U6 で書き写すと、FR1.4 の「画面入力と CSV で同じ検証」に反する二重管理になる。 | 次のどちらかを選んで規則を書き直す。（a）照合は U1 の検証を完全に通った行だけに限る（AC7.1.2 の2例はこれで満たせる。複数の理由の併記は検証失敗とカテゴリ照合を別々に扱わない）。（b）U1 の窓口に種別とカテゴリ名の正規化を公開する変更を、人間の承認を得て起こす。いずれにしても、種別・カテゴリ名を U6 がどう得るかをこの設計で明記する。 | New |
| R-02 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/csv-exchange/functional-design/entities.md > ImportFileError | 属性が kind だけだが、規則と契約 C5 は kind ごとの付随値（too-large の limitBytes、too-many-rows の limitRows、malformed の line と message、read-failed の message）を使う。「契約 C5 との差分: なし」は成り立つが、属性表だけでは実装者が付随値を推測することになる。 | kind ごとの付随値を属性（または条件つきの属性）として書き、read-failed の2つの文言（UTF-8 でない場合と読めない場合）がどちらも message に入ることを明記する。 | New |
| R-03 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/csv-exchange/functional-design/rules.md > 解釈の記録（AC7.1.1） | AC7.1.1 の文言「3行目：金額が数値ではありません」を、U1 の文言「金額：1〜99,999,999 の整数で入力してください」に置き換える解釈をしている。受け入れ条件の文面と異なるため、承認済みの AC の変更にあたるかどうかを人間が判断する必要がある。 | 承認時にこの解釈を明示して確認を取る。受け入れ条件の文面を変えない方針なら、U1 の文言の側を見直すかを U1 の担当で決める。 | New |
| R-04 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/csv-exchange/functional-design/rules.md > BR4.2 | 「別のタブでカテゴリが消えた・変わった場合」とあるが、カテゴリ名の変更では categoryId は残るため U4 は import-category-missing を返さず、そのまま取り込む。「変わった」は実際の挙動と合わない（プレビューの categoryName は古い表示のまま）。 | 「消えた場合」に限定するか、名前変更では取り込みが成功し、プレビューの名前だけが古くなることを明記する。 | New |
| R-05 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/csv-exchange/functional-design/functional-spec.md > 5. テストの観点 | File と Blob は Node.js 24 の組み込みを使うと書いているが、vitest.config.ts に csv-exchange 用のプロジェクト（node 環境）と Unit 単独の行 80% 下限がない。jsdom のプロジェクトに入れると jsdom の File に arrayBuffer がない場合がある。 | コード生成への引き継ぎとして、csv-exchange を node 環境のプロジェクトとして vitest.config.ts に足し、`src/csv-exchange/**` に行 80% の下限を置くことを明記する。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| traceability.json の解析と照合 | PASS: AC 21件すべて OK、対象 BR はすべて存在、逆引き7件は N/A で理由あり | 受け入れ条件の抜け・孤立した規則なし |
| U1 の挙動との突き合わせ（decodeCsv、encodeCsv、validateCsvRecord、escapeFormula） | 一部不一致: BR3.3 の部分失敗の照合は公開窓口だけでは実現不可 | Major 1件の根拠。ほかは整合 |
| U4 の窓口との突き合わせ（listAllTransactions、listCategories、importTransactions、OperationError） | PASS | 呼び出しの形と失敗の種類が一致 |

### Summary

設計は C5 と U1・U4 の実際の挙動によく合っており、実装者が大きく迷う箇所は少ない。人間が確認すべき主な点は、検証に失敗した行でのカテゴリ照合（BR3.3）が U1 の公開窓口では実現できないことで、対象を完全に検証を通った行に絞るか U1 の窓口を広げるかを承認時に決めればよい。
