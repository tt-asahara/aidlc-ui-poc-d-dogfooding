## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-16T09:51:46Z
**Iteration:** 1

### 概要

U1 data-contract のコード生成は、rules.md の BR1.1〜BR6.1 を実装・テストしており、契約 C1 とも一致しています。Critical と Major の指摘はありません。以下は人間が判断すべき Minor の指摘です。

### 検証内容

- `npm run verify` を実行しました。整形、Lint（警告 0）、型チェック、テストはすべて成功しました。テストは 8 ファイル・212 件が合格しました。行カバレッジは 100%（しきい値 80%）で、`vitest.config.ts` のしきい値は下げられていません。
- BR4.5 と BR4.6 の往復は、`formula.ts` を読んで確認しました。`escapeFormula` と `unescapeFormula` は互いに逆で、全単射になっています。`formula.test.ts` は、security-design 4.3 の値の集合（`'`、`''`、`'=1`、`''=1`、改行、結合文字、絵文字、200 文字）を、関数単体と `encodeCsv` から `decodeCsv` への全体の両方で往復させています。
- BR4.3 の行番号は、`parseRows` が物理行で数えています（CRLF、LF、単独の CR を各 1 行）。引用内の改行も数え、レコードの開始行を記録します。閉じない引用は、引用が始まった行番号の malformed になります。空行は飛ばし、引用した空値だけの行は飛ばしません。
- 計算量は、1 回の走査で入力長に比例します。測定値は 5,000 レコードで 2.9ms、1MB の引用付きの値で 18.6ms で、合格条件 1,000ms を大きく下回ります。
- NFR1.1 は `eslint.config.js` で security-design 第 2 章の禁止一覧を `src/data-contract/` に適用しています（`*.test.ts` は除外）。`lint-config.test.ts` が違反の検出を確かめています。
- traceability.json の target 先は、挙げられたファイルがすべて存在することを確認しました。
- C1 の更新（`out-of-range-date`、`validateCsvRecord`、`ValidCsvRecord`、`CsvLine.fields?`）は、`types.ts`、`index.ts`、contract-summary.md の C1 で一致しています。
- NFR9.1 は、`package.json` の `engines`、`.nvmrc`、`.npmrc` の `engine-strict` で満たされています。
- 計画外の 2 点（`CsvLine.fields?` の追加、メモの型違い文言の追加）は、どちらも受け入れて問題ありません。理由は Findings の Minor の行に書きました。

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | src/data-contract/types.ts > CsvLine.fields、および inception/contract-design/contract-summary.md > C1 CsvLine | `fields` は任意項目ですが、`decodeCsv` は常に設定します。任意項目のままだと、使う側（U6）が未設定の場合の処理を書く必要があり、列数が 5 でない行の判定に必ず使う項目としては契約が弱くなります。生成するのは U1 だけなので、必須にしても非破壊です。追加自体は BR4.3 と U6 の `InvalidRow.raw` に必要で、受け入れて問題ありません。 | 必須（`fields: string[]`）にするか、任意のままにするなら「`decodeCsv` の戻り値では必ず設定される」と契約の注記に明記して、U6 側に未設定の分岐を作らないと決めてください。 | New |
| R-02 | Minor | src/data-contract/messages.ts > memoNotText、および src/data-contract/values.ts > validateMemo | メモに文字列以外が渡された場合、エラーコードは `required` ですが、文言は「メモ：文字で入力してください」で、メモは任意項目のため意味が合いません。文言は rules.md と functional-spec.md の文言表に載っていません。functional-spec の「想定外の型は該当項目の required」には沿っていますが、BR6.1 の文言の定義元が rules.md の violation であるため、定義元と実装がずれています。実害は小さく、型が守られていれば到達しません。 | 追加した文言を rules.md の BR1.4 の violation（または functional-spec の文言表）に反映して定義元と一致させてください。 | New |
| R-03 | Minor | src/data-contract/values.ts > isValidYearMonth、および contract-summary.md > C1 | 対象月（BR1.2）は真偽値を返す関数しかなく、BR1.2 の violation 文言（`MESSAGES.monthInvalid`）を返す公開関数がありません。`monthInvalid` は定義済みなのに使われておらず、`ValidationCode` の `invalid-month` と `FieldName` の `month` を作る箇所もありません。code-summary.md の「残る課題」にも挙がっています。U4 の予算設定や集計で文言が必要になると、契約の再変更になります。 | 対象月の検証を `Result<YearMonth, ValidationError[]>` で返す関数を C1 に追加するか、真偽値だけで足りる理由を U4 の設計に記録して、未使用の `monthInvalid` と `invalid-month` の扱いを決めてください。 | New |
