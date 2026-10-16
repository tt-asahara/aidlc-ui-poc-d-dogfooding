## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-16T13:36:34Z
**Iteration:** 1

### 概要

助言のみの1回のレビューです。`npm run verify` を実行し、47 ファイル・597 件がすべて合格しました。行カバレッジは全体 99.21%、`src/csv-exchange` は 100%（分岐 94%）で、80% の下限は維持されています。実装は src/csv-exchange/ の全ファイルを読んで、設計と突き合わせました。

### 検証内容

- 1MB の境界は `fileReader.ts` で `file.size > 1_048_576` を中身の読み込みの前に判定しています（ちょうどは読み込む）。
- 文字コードは `TextDecoder("utf-8", { fatal: true, ignoreBOM: true })` です。BOM は残して U1 の `decodeCsv` に任せており、不正なバイト列は read-failed になります。
- 件数は `decodeCsv` のレコード単位で数えるため、引用内の改行を物理行として数えません。5000 件は進み、5001 件で too-many-rows になります。
- 行の検証は、列数、U1 の `validateCsvRecord`、カテゴリ照合の順です。照合は完全に有効な行だけで行い、`normalizeCategoryNameForCompare` を種別ごとに使い、type-mismatch と not-found を分けています。
- 理由の文言は `messages.ts` の固定文字列と U1 の文言だけで、入力値を埋め込んでいません。`raw` はファイル上の全列の値で、数式対策の `'` を外す前です。
- `sameAsExisting` のキーは JSON 配列（日付・種別・categoryId・金額・メモ）で、メモは unescape 後の値です。
- 確定は validRows だけを渡し、0 件なら U4 を呼びません。
- 例外の変換は、ファイルの段階が read-failed、Book の段階が storage で、`index.ts` の `protect` で分かれています。
- 書き出しは U1 の `encodeCsv` に任せるため、BOM、CRLF、数式対策の二重化なしが保たれます。ファイル名は地方時の日付です。
- ESLint の csv-exchange 用ブロックは、security-design 第5章の禁止の一覧を書き切っています。U1〜U4 の設定は変わっていません。
- 契約 C5 の3関数と型の形は一致しています。

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/csv-exchange/code-generation/code-summary.md > 残る課題（不安定なテスト） | 全体を並列で実行すると、U1 と U3 の `lint-config.test.ts` の2件が ESLint の初回読み込みで 5,000ms を超えて時々失敗します（U4 の `performance.test.ts` も1度失敗）。eslint.config.js に U6 用のブロックが加わり、起きやすくなる懸念があります。今回の `npm run verify` は合格しました。マージ前検証コマンドが時々偽の失敗を出すと、運用に影響します。 | Build and Test で、U4 と同じ対処（`beforeAll` での事前読み込みと 60 秒の待ち時間）を U1・U3 のテストに入れるか、並列数の制限を `verify` に入れるかを決めて記録してください。 | New |
| R-02 | Minor | src/csv-exchange/export.ts > exportTransactions | 収支とカテゴリを別々に `Promise.all` で読むため、2回の読み取りの間に変更があると、同じ時点の状態になりません。名前を引けない収支は category-missing で失敗扱いにしており、壊れた CSV は出ません。 | 対応は不要です。U7 でこの失敗を「もう一度書き出す」操作として扱えるよう、U7 の引き継ぎに一文あると確実です。 | New |
| R-03 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/csv-exchange/code-generation/code-summary.md > テストの順序 | テストを先に書いて失敗を確認してから実装した、という記録は自己申告です。ソースが未コミットで、ファイルだけからは順序を裏づけられません。テスト自体は、境界値、固定文言、数式の unescape、例外の分岐などの具体的な値を検証しており、常に通るだけのテストは見当たりませんでした。 | 対応は不要です。Bolt を squash マージするときに、失敗を確認した実行の記録を残せるなら、残してください。 | New |
