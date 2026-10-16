# ビルドとテストの要約（全体）

- 出典: `construction/build-and-test/build-instructions.md`、`construction/build-and-test/integration-test-instructions.md`、`construction/*/code-generation/code-summary.md`（全 7 Unit）、各 Unit の traceability.json、`inception/refined-mockups/interaction-spec.md`、`nfr-requirements/performance-requirements.md`（app-screens）

## 1. 全体の状態

| 項目 | 結果 |
|------|------|
| ビルド（`npm run build`） | 成功（終了コード 0） |
| 一括検証（`npm run verify`） | 成功（72 ファイル、815 件合格、行カバレッジ 全体 96.31%、各 Unit 80% 以上） |
| 配布の検査（`check-dist.mjs`、許可リスト 5 件） | 成功（終了コード 0） |
| 検査スクリプトの単体テスト | 10 件合格 |
| クリーンな `npm ci` からの再現 | 成功。その後の verify・build・検査も成功 |
| 実ブラウザの確認（Chrome） | 実施（性能、B1〜B5、キーボード、通信、ダウンロード、再読み込み後の保持） |
| 他ブラウザ（Edge、Firefox、Safari） | 利用者の手動確認で合格 |

- 準備状態（build-ready）: はい。
- テスト準備（test-ready）: はい。Chrome での確認は通る。他ブラウザの手動確認だけが残る。
- 配布準備（deployment-ready）: 対象外（デプロイしない。team.md）。ローカルでの起動と確認は Chrome で通る。

## 2. テストの種類（Standard）

- 単体（各 Unit）: unit-test-instructions に従い、`npm run verify` に含まれる（815 件）
- 結合（境界）: integration-test-instructions.md。自動の部分は verify に含まれ、実ブラウザの部分（保持、保存失敗の表示、ダウンロード）は Chrome で確認した
- 性能: NFR3 は Chrome の実 IndexedDB で測った（下の BT-09 から BT-11）

## 3. Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|-----------|--------|----------|--------|----------|--------------|---------|
| BT-01 ビルド | infrastructure-specification 2章、cicd-pipeline 2章 | `npm run build` が成功 | 成功（終了コード 0） | build の出力（dist の 3 ファイル） | Build and Test | Met |
| BT-02 外部参照の検査 | security-design 2章、infrastructure-specification 4章（NFR1.1） | 違反 0（許可リスト 5 件は理由つき） | 違反 0（許可 5 件） | `node scripts/check-dist.mjs dist` の終了コード 0 | Build and Test | Met |
| BT-03 計測の印 | performance-design 3章 | `dist/` に `perf:` が残らない | 0 件 | `grep -c "perf:" dist/assets/*.js` が 0 | Build and Test | Met |
| BT-04 一括検証 | NFR6.1、team.md Testing Posture | 全体と各 Unit の行 80% 以上、全テスト合格 | 全体 96.31%、815 件合格、Unit は全て 80% 以上 | `npm run verify` の終了コード 0 | Build and Test | Met |
| BT-05 検査スクリプトの単体 | infrastructure-specification 4章 | 10 件合格 | 10 件合格 | `node --test scripts/check-dist.test.mjs` | Build and Test | Met |
| BT-06 アクセシビリティの自動検査 | NFR2.2 | 画面ごとの主な状態で違反 0 | 違反 0（jsdom の axe 検査） | src/app の axe テスト（合格） | Build and Test | Met |
| BT-07 整数の金額と 3 桁区切り | NFR5.1、BR5.1 | 整数のみ、差額のマイナスは「−」と「（赤字）」 | 単体テストで確認。Chrome の集計表示でも「−1,115,444円（赤字）」を確認 | src/app と monthly-summary のテスト、Chrome の画面 | Build and Test | Met |
| BT-08 保存の全か無か | NFR4.1 | 失敗で保存領域が変わらない | 単体・結合テストで確認 | storage、bookkeeping-core、csv-exchange のテスト | Build and Test | Met |
| BT-09 月次集計の切り替え 500ms | NFR3.1、performance-requirements | Chrome・実 IndexedDB で中央値 500ms 以内 | 中央値 21.1ms、最悪 24.0ms（前面のタブ、5 回。慣らし 1 回を除く） | Chrome 上の計測（ページ内の計時、DOM の更新と 2 フレーム後まで） | Build and Test | Met |
| BT-10 CSV 5,000 行の読み込みからプレビューまで 2 秒 | NFR3.2 | Chrome で中央値 2 秒以内 | 中央値 156.8ms、最悪 164.3ms（5 回。有効な 5,000 行） | Chrome 上の計測（ファイル選択の change からダイアログの表示まで） | Build and Test | Met |
| BT-11 最悪ケース（5,000 行が全て取り込めない） | performance-design 2章 | 描画の時間を記録する（合格条件は利用者と確認） | 中央値 59.5ms、最悪 108.9ms（5 回。全 5,000 行が取り込めない行） | 同上 | Build and Test | Met |
| BT-12 通信 0 件（操作中） | NFR1.1、US1.3 | 利用者操作の全体で外部への要求 0 件 | 読み込み時はアプリ自身のファイル 3 件のみ。月の切り替えと登録・削除の後も増えず | read_network_requests（127.0.0.1 の 3 件のみ） | Build and Test | Met |
| BT-13 B1〜B5 | U2 の引き継ぎ、ui-kit security-design 3.3 | 実ブラウザで確認 | B1 初期フォーカスは「キャンセル」（1 秒後）、Tab と Shift+Tab はダイアログ内で循環。B2 Esc で「削除」へ戻る。B3 取り込みプレビューの Esc で「ファイルを選ぶ」へ戻る。B4 背後の「予算」タブを押しても反応しない。B5 主な文字の組は 4.5:1 以上（15.8、6.67、抽出した要素） | Chrome の操作と JavaScript の計算 | Build and Test | Met |
| BT-14 キーボードだけの主な操作 | NFR2.1、US9.1 | Tab と Enter だけで主な操作を完了 | 収支の登録（金額、メモ、Tab、Enter）と削除（Enter、Tab、Enter）を、キーボードだけで完了。タブの切り替えは単体テスト | Chrome の操作（「✓ 登録しました」「✓ 削除しました」） | Build and Test | Met |
| BT-15 再読み込み後の保持 | AC1.2.1 | 実ブラウザで同じ収支と予算が残る | 再読み込みの後も、収支（416〜417 件）と予算が残っていた | Chrome の再読み込み後の画面 | Build and Test | Met |
| BT-16 CSV のダウンロード（Blob の解放） | BR6.1、NFR9.1 | 書き出しでダウンロードが始まり、URL が解放される | Blob の作成 2、アンカーのクリック 2、解放 2 を確認。ブラウザの保存ダイアログは確かめていない | ページ内の記録（件数のみ） | Build and Test | Met |
| BT-17 他ブラウザ（Edge、Firefox、Safari） | NFR7.1 | 同じ手順で手動確認し結果を記録 | 利用者の手動確認で合格（詳細の記録は利用者から受け取っていない） | 利用者の報告（チャット）。配信は http://127.0.0.1:4173/ | Build and Test | Met |
| BT-18 クリーンな取得から再現 | NFR9.1 | `npm ci` から build と verify まで | クリーンな `npm ci` が成功し、その後の verify（815 件）、build、配布の検査が成功 | 実行の記録 | Build and Test | Met |

## 4. 読み方

- Unverified は 0 件。BT-17 は利用者の手動確認で合格（Met）。
- 修正の方針（weakening、しきい値を下げる、確認を省く）は行わない。
