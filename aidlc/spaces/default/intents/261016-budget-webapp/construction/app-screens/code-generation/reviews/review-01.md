## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-16T15:31:05Z
**Iteration:** 1

### 検証内容

この審査は助言（ADVISORY）の 1 回のみです。次の検証ツールを実行しました。結果は次のとおりです。

- `npm run verify`: 成功です。format、lint（警告 0）、typecheck、test がすべて通りました。72 ファイル、812 件が合格しました。行カバレッジは全体 96.31% でした。しきい値（全体と src/app/** の 80%）は vitest.config.ts に残っており、U1〜U6 の既存のしきい値も弱めていません。
- `npx tsc --noEmit`: エラーなしです。
- `node --test scripts/check-dist.test.mjs`: 10 件がすべて合格しました。
- `npm run build` と dist の検査は指示どおり実行していません（Build and Test の担当）。

ソースを U7 の規則に照らして確かめた結果です。

- import 規則: src/app の非テストファイルは、U1・U2・U4・U5・U6 の公開 index（`../../ui-kit`、`../../data-contract`、`../../bookkeeping-core`、`../../csv-exchange`、`../../monthly-summary`）だけを読み込んでいます。U3 の storage は `test-fixtures.ts`（テスト専用でカバレッジと lint から除外）だけが読み込みます。内部ファイルの import はありません。
- 通信・HTML 挿入: src/app に fetch、innerHTML、dangerouslySetInnerHTML、外部 URL はありません。no-external.test.ts が同じことを確かめています。
- BR1.6: `useLatestRead` と各画面の操作が newer-version を `onNewerVersion` に渡し、S0-b へ切り替えます。
- BR1.4 と BR1.5: 読み取りは要求の鍵で最新のものだけを反映します。書き込みの成功後は読み直します。
- BR2.2: 二重送信は ref（`savingRef`、`busyRef`）で防いでいます。
- BR2.4: 編集で月が変わっても共有の対象月は動かしません。移動の知らせと見出しへのフォーカスを実装しています。
- BR3.4 と BR3.5: D2 の確定失敗は D2 を閉じて行の下に理由を出します。not-found と category-type-mismatch の文言は、`STALE_SELECTION_TEXT` の 1 つにまとまっています。
- BR4.2: 空欄の保存は受け付けず、`emptyInput` の案内を出します。
- BR5.1: 読み込み中と失敗のときの合計は「—」です（`showTotals`）。
- BR6.1: Blob の URL は `DOWNLOAD_RELEASE_MS=1000` の後に解放します。アンマウント時にも解放します。
- BR7.1: malformed と read-failed は U6 の `error.message` をそのまま表示します。他の 4 種は固定の文言です。empty は status として失敗と区別しています。
- BR7.2 と BR7.4: D3 は取り込める行と取り込めない行を全件表示し、値は文字列として描画します。commitImport の各結果（成功、保存失敗、import-category-missing、validation）を区別しています。
- BR8.2: 失敗時に「まだありません」は出しません。
- BR10.1: 「※架空データ専用」をヘッダーに常に表示します。
- 契約 C1〜C6 は、記述どおりの使い方だけです。既存 Unit のソースを変更した形跡は見当たりませんでした。
- test-first の順序は UI 層には求められていません（team.md の Ordering は、契約と CSV 変換以外は実装後にテスト）。U7 は実装後のテストで足ります。
- 常に通るテスト: `expect` が 2 件以下のテストファイルは `renderScreen.test.tsx` だけでした。これは薄い配線の部品なので問題ありません。

code-summary.md の「計画との違い」は、いずれも妥当な範囲と判断します。format.ts や ConfirmDialog の部品化、Notice への id 追加、素の表の行は、設計意図の範囲です。不安定なテストの記録は、検証した範囲では再現しませんでした（私の実行 1 回は全件合格）。ただし原因は未調査です。下の Minor を参照してください。

主な懸念は 1 件です。BR8.1 と BR8.2 の「登録フォームの無効化」が実装されていません。これは計画との違いの表にも載っていません。

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | src/app/screens/TransactionsScreen.tsx と src/app/screens/TransactionForm.tsx の登録フォーム | BR8.1 は読み込み中に保存系の操作を無効にすると定め、BR8.2 は読み込み失敗のとき登録フォームを無効のままにすると定めています。TransactionForm には disabled を受け取る口がなく、収支一覧の読み込み中・失敗でも登録フォームは操作できます。カテゴリの読み込みが済んでいればフォームは出ます。この食い違いは code-summary.md の「計画との違い」にも載っていません。 | 収支一覧の読み取りが loading か failed のあいだは、TransactionForm の入力と送信を無効にします。その状態を確かめるテストを TransactionsScreen.test.tsx に足します。無効にしないと決めるなら、その理由を計画との違いに記録して、規則 BR8.1 と BR8.2 の側を直します。 | New |
| R-02 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/app-screens/code-generation/code-summary.md > 注意（既存の不安定なテストの可能性） | 設定変更後の最初の実行で、既存 Unit のテストが 640 件中 2 件失敗しました。失敗したテスト名が記録されていません。U7 の jsdom プロジェクト（25 ファイル）が追加されて並列の負荷が上がり、U4・U5 の性能系テストの時間判定が揺れた可能性があります。しきい値は弱めておらず、私の実行は全件合格でした。 | Build and Test で `npm run verify` を繰り返し実行し、失敗したテスト名を記録します。性能系テストが原因なら、しきい値を緩めずに、並列度の制限などで揺れを抑える方法を検討します。 | New |
| R-03 | Minor | src/app/screens/CategoriesScreen.tsx > requestDelete | BR3.4 は getCategoryUsage で使用件数を見ると定めます。実装は読み込み済みの使用件数（画面の状態）で判定します。別のタブで変更された後は古い値の可能性があります。確定時に U4 が最新の状態で確かめて失敗を行の下に出すため、データへの影響はありません。 | 現状の動作を許容するなら、その旨を残します。許容しないなら、削除の要求時に getCategoryUsage を呼び直します。 | New |
