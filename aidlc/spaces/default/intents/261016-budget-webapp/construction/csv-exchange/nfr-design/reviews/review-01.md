## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-16T12:40:58Z
**Iteration:** 1

### 概要

今回は ADVISORY の1回だけのレビューです。security-design.md、logical-components.md、traceability.json を、実際の U1 の API（`validateCsvRecord`、`normalizeCategoryNameForCompare`、`decodeCsv`、`CsvLine`、`ValidCsvRecord`）、U4 の API（`Book`、`ImportRow`、`OperationError`、`RuleViolation`）、C5 の型、既存の eslint.config.js と vitest.config.ts と突き合わせました。

- 第1章の行検証の手順は U1 の実際の戻り値と整合しています。`validateCsvRecord` は成功時に `type` と `categoryName` を返し、失敗時は日付・種別・カテゴリ・金額・メモの順に `ValidationError[]` を返します。
- ファイル全体の6つの理由は C5 の `ImportFileError` と一致しています。
- 確定時の `import-category-missing` は U4 の `RuleViolation` と一致しています。
- Q1 = A と Q2 = A の判断は、FD の BR3.3 末尾と W2 を置き換える形で第1章に記録されています。これは AC7.1.1 と AC7.1.2 に矛盾しません。
- NFR の14件（NFR1.1、3.1、3.2、4.1〜4.3、6.1〜6.3、8.1〜8.4、9.1）は traceability.json にすべてあり、参照先の章も存在します。
- mermaid の記法は目視で問題ありません。
- Critical と Major の指摘はありません。以下は Unit の承認の前に知っておくとよい Minor の指摘です。

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/csv-exchange/nfr-design/security-design.md > 第4章 例外と失敗 | parseImportFile の想定外の例外をすべて read-failed（「ファイルを読み込めませんでした」）に変換する設計です。U4 の listCategories や listAllTransactions が例外を投げた場合も、利用者には「ファイルが読めない」と表示されます。C5 は parseImportFile の戻り値に OperationError の storage も許しており、共通の決まりも想定外の例外を storage か unexpected に変換するとしています。原因とは違う案内になるおそれがあります。 | ファイルの読み取り（arrayBuffer、デコード）の例外だけを read-failed にします。Book 呼び出しの例外は storage（例: 「保存できませんでした」）に変換すると書き、例外テストにその2系統を含めます。 | New |
| R-02 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/csv-exchange/nfr-design/security-design.md > 第5章 外部に出さないこと（no-restricted-imports の行） | 禁止するのは fake-indexeddb と `../storage` だけです。ところが同じ章と logical-components.md 第3章は、U6 が使うのは U1 と U4 の公開窓口だけだとしています。契約の決まりでは公開窓口以外の import も禁止です。`../bookkeeping-core/book` や `../data-contract/csv` のような内部ファイルの直接 import は Lint で止まりません。 | 禁止の一覧に `../bookkeeping-core/*` と `../data-contract/*`（index を除く）を足します。または窓口の import だけを許す patterns の書き方にして、一覧に書き切ります。 | New |
| R-03 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/csv-exchange/nfr-design/logical-components.md > 第3章 依存の向き（mermaid） | messages.ts は U6 が作る文言の置き場所とされています。第4章の「保存できませんでした」「書き出せませんでした」「ファイルを読み込めませんでした」は export と commit でも使います。しかし図には export → messages と commit → messages の辺がありません。例外を包む処理をどのファイルに置くかも書かれておらず、各操作ごとに try/catch を書くのか index.ts の共通の包みなのかを実装者が推測することになります。 | 図に不足の辺を足し、例外の包みの置き場所（index.ts か各操作のファイルか）を1文で決めます。 | New |
| R-04 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/csv-exchange/nfr-design/security-design.md > 第6.3節 性能の確かめ方（too-many-rows の行） | 「最小の行を並べた CSV」の中身が決まっていません。U1 の decodeCsv は空行を読み飛ばすので、空行は最悪の入力になりません。最悪になるのは `,,,,` のような非空の最短の行（約17万レコード）です。この場合 decodeCsv は5,000件の判定の前に全レコードの CsvLine を作ります。判定も1回の測定で 500ms 以内としており、根拠も測定のぶれの扱いも書かれていません。NFR4.2 の「解析せずに断る」という表現とも、復号の後で断る第2章の設計が食い違ったままです。 | テスト用の入力を `,,,,` の行を1MB に近づけるまで並べたものとして明記します。500ms の根拠を書くか、空回し1回の後に複数回の中央値で判定します。NFR4.2 の確認の表現を「中身の検証と行ごとの照合はしない」に直す、と書きます。 | New |
| R-05 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/csv-exchange/functional-design/rules.md > BR3.3 の最後の文と functional-spec.md W2 | security-design.md 第1章は、この2か所を置き換えると宣言しています。しかし Functional Design の成果物には、置き換えられる前の記述（検証に失敗した項目がある行でも照合する）がそのまま残っています。コード生成が rules.md だけを読むと、Q1 = A の決定と逆の実装になるおそれがあります。 | Code Generation の計画で、BR3.3 の末尾と W2 より security-design.md 第1章を優先すると明記します。または承認後に rules.md と functional-spec.md の該当箇所へ置き換えの注記を入れます。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| traceability.json の解析と照合 | PASS: JSON は正しく、upstream_ids 14件と coverage 14件が一致し、参照先の章（第1章、第2章、第3章、第4章、第5章、第6.1〜6.3節）はすべて存在する | NFR Requirements の NFR1.1、3.1、3.2、4.1〜4.3、6.1〜6.3、8.1〜8.4、9.1 の漏れはありません |
| U1 の API との照合 | PASS: `validateCsvRecord`、`normalizeCategoryNameForCompare`、`decodeCsv`、`CsvLine`、`ValidCsvRecord` は index.ts から公開されており、設計の使い方と一致する | Q1 = A の手順（検証に成功した行だけを照合する）は実装可能です |
| U4 の API との照合 | PASS: `listCategories`、`listAllTransactions`、`importTransactions`、`ImportRow`、`import-category-missing` は types.ts と一致する | 確定と名前の変更の扱い（第3章）は U4 の実際の動作と整合しています |
| mermaid の目視確認 | PASS（記法は有効） | 辺の不足は上記の Minor の指摘のとおりです |

### Summary

設計は実際の U1 と U4 の API に沿っており、Q1 = A と Q2 = A の判断も整合した形で記録されています。例外の変換先の細分化、Lint の禁止範囲の補強、図の辺の補完、最悪時のテスト入力の明確化、FD の旧記述との優先関係の明記が望ましいですが、いずれも実装を止める内容ではないため READY とします。
