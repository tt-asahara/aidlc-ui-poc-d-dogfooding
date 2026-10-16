# コード生成のまとめ（app-screens）

## 作成・変更したファイル

| 区分 | ファイル |
|------|----------|
| 配布の設定（新規・変更） | vite.config.ts（新規、host を 127.0.0.1 に固定）、index.html（新規）、package.json（dev・build・preview を追加。Vite 8.3.4 を正確な版で固定）、tsconfig.json（include に vite.config.ts を追加）、vitest.config.ts（app 用プロジェクト、しきい値 src/app/** 80%）、eslint.config.js（src/app のブロックと scripts のブロック）、README.md |
| 実装（新規） | src/app/ の main.tsx、App.tsx、TabNav.tsx、MonthNavigator.tsx、appState.ts、reads.ts、status.tsx、types.ts、messages.ts、format.ts、perf.ts、app.css、vite-env.d.ts、screens/（renderScreen.tsx、ConfirmDialog.tsx、TransactionsScreen.tsx、TransactionForm.tsx、TransactionList.tsx、SummaryScreen.tsx、BudgetScreen.tsx、CategoriesScreen.tsx、CsvScreen.tsx、CsvExportPanel.tsx、CsvImportPanel.tsx、ImportPreviewDialog.tsx） |
| テスト（新規） | src/app/ の各 .test.ts(x)、test-fixtures.ts（テスト専用）、no-external.test.ts、lint-config.test.ts |
| 配布の検査（新規） | scripts/check-dist.mjs（Node.js の標準機能だけ）、scripts/check-dist.test.mjs、scripts/check-dist-allowlist.txt（見出しだけ。項目は最初のビルドで記録する） |

- 既存の Unit（U1〜U6）のソースは変更していない。契約 C1〜C6 は変えていない。追加の依存は vite（8.3.4）だけ。

## テストとカバレッジ

- `npm run verify`: 成功（終了コード 0）。オーケストレーターの再実行で、72 ファイル・812 件（既存 640 件、U7 172 件）がすべて合格した。`npx tsc --noEmit` も終了コード 0。
- U7 の内訳: 25 のテストファイル、172 件。配布の検査の Node テスト（scripts/check-dist.test.mjs）は 10 件（`node --test` で別に実行する）。
- 行カバレッジ: 全体 96.31%、src/app/** 94.9%（分岐 84.84%）。しきい値は下げていない。
- 必須のテスト観点: 入力エラー、空データ、読み込み中、保存失敗、キーボード操作、ダイアログのフォーカス、axe の違反0件（画面ごとの主な状態）、外部への通信のない検査。
- 準備確認: `npx vitest run --project app --passWithNoTests` は終了コード 0。
- 注意（既存の不安定なテストの可能性）: 設定を変えた後の最初の実行で、既存の Unit のテストが 640 件中 2 件失敗した（名前は記録なし）。その後の 4 回の実行（6 プロジェクト）と verify 2 回では全件合格。Build and Test で再発を見る。

## 主な実装上の判断

- 画面の状態は React の状態だけ。対象月は ShellContext で共有。読み取りは最新の要求だけを反映する（reads.ts）。
- 任意の操作で newer-version が返ったら S0-b に切り替え、以後の操作を止める（BR1.6）。
- 成功の知らせは 5 秒で消え、失敗の知らせは消えない。知らせには id を持たせ、同じ文言を続けて出せるようにした。
- フォーカス: 送信で最初の入力エラーへ移す。D1・D2・D3 は U2 の Dialog を使い、戻し先は画面の ref に保持する。
- CSV の書き出しは Blob の URL を作ってアンカーで保存させ、1000ms 後に解放する（アンマウント時も解放）。
- 文言は U1・U4・U6 が返したものをそのまま表示する（書き換えない）。
- 全角スペースは String.fromCharCode で作る（不規則な空白の Lint を避けるため）。
- 保存失敗・入力の保持・D2 の確定失敗・import-category-missing は、計画どおりの文言と動きで実装した。

## 計画との違い

| 違い | 理由 |
|------|------|
| 計画外のファイル: format.ts、app.css、test-fixtures.ts、screens/renderScreen.tsx、screens/ConfirmDialog.tsx、appState と renderScreen のテスト | 表示の整形、スタイルの読み込み（index.html が参照）、テストの共通部分、画面の描画の共通部分、D1・D2 の確認ダイアログの部品化 |
| main.tsx は画面の後に作り、Step 3 のチェックは後で付けた | main.tsx が renderScreen を import するため |
| AsyncView に slow を持たない | 5 秒の追記は StatusPanel（U2）が担う |
| Notice に id を追加、AppBoot は判別可能な共用体、DialogState に returnFocusRef を持たない | 同じ文言の再表示、起動状態の表現、戻し先は画面の ref で持つため |
| 予算とカテゴリの行を DataTable ではなく素の表の行で描画 | 行ごとに下書きの状態を持つため |
| data-testid は使わない | 既存の Unit と同じ方針 |
| Lint: src/app/test-fixtures.ts を テストと同じく除外 | U4・U6 と同じ形 |

## 引き継ぎ

- **Build and Test へ**:
  1. `npm run build` の後に `node scripts/check-dist.mjs dist` を実行する。最初のビルドで見つかった名前空間の識別子とエラー案内の URL を、理由つきで scripts/check-dist-allowlist.txt に記録する（それまでは違反として出るのが想定どおり）。
  2. `npm run preview` で性能を測る（月次集計の切り替え 500ms、CSV 5,000 行からプレビューまで 2 秒。各 5 回の中央値と最悪値）。
  3. B1〜B5、キーボードだけの操作、開発者ツールでの通信 0 件、ダイアログのフォーカスと Esc（テストは cancel イベントを手で送っているため実ブラウザで確認する）、Chrome でのダウンロード、Edge・Firefox・Safari の手動確認。
  4. `npm run verify` を再実行し、上の不安定なテストの再発を見る。
- **スクリプトの権限**: npm の install で fsevents@2.3.3 について「allow-scripts」の警告が出た（環境のもの。承認していない）。

## 残る課題

- 上の不安定なテストの可能性（既存の Unit）。
- Edge・Firefox・Safari と実ブラウザの確認は未実施（Build and Test）。

## コードレビューの指摘への対応

- レビュー（READY、Major 1、Minor 2）の Major: 収支一覧の読み込み中・失敗のとき、登録フォームが操作できた（BR8.1、BR8.2）。TransactionForm に `disabled` を追加し（fieldset で囲む。ui-kit の部品に disabled の入力がないため）、TransactionsScreen が読み込み中か失敗のとき無効にする。テストを3件追加（テストは 172 件から 175 件）。`npm run verify` は成功（72 ファイル、815 件）。
- 修正はレビューの後に行った。コードレビューの反復上限は 1 回のため、修正後の再レビューは行っていない（判定は READY のまま記録）。修正の確認は verify と追加のテストで行った。
- Minor（テストの揺れ）: Build and Test で `npm run verify` を繰り返し、失敗したテスト名を記録する。
- Minor（カテゴリ削除の事前判定）: 使用件数は読み込み済みの値で判定する。確定時に U4 が最新の状態で確かめ、失敗を行の下に出すため、データへの影響はない。現状を許容する。
- 注意（未確認）: 読み直しのたびに一覧が loading になるため、保存後や月の切り替えの間はフォームが一時的に無効になる（BR8.1 のとおり）。登録成功後に金額欄のフォーカスが外れるかは、実ブラウザで確認する（Build and Test）。
