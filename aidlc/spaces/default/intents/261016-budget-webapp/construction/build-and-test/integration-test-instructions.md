# 結合テストの手順（Standard の戦略）

- 出典: `aidlc/spaces/default/intents/261016-budget-webapp/aidlc-state.md`（Test Strategy: standard）、`construction/*/code-generation/unit-test-instructions.md`

## 1. 対象

- 境界ごとの結合（Standard の「重要な境界のテスト」）:
  1. 保存（U3）と家計簿（U4）: 書き込みの全か無か、別のタブでの変更、版上げ（fake-indexeddb）
  2. 家計簿（U4）と集計（U5）、CSV（U6）: 集計の食い違い、取り込みの全件か0件
  3. 画面（U7）と U4〜U6: 読み込み中・失敗・保存失敗の表示、登録フォームの無効化
  4. 配布（vite build）と検査（scripts/check-dist.mjs）

## 2. 実行

- 自動（既に `npm run verify` に含まれる）: `npx vitest run --project storage`、`--project bookkeeping-core`、`--project csv-exchange`、`--project monthly-summary`、`--project app`
- 配布の検査: `npm run build` の後に `node scripts/check-dist.mjs dist`

## 3. 実ブラウザの結合（この stage で未実施）

- 再読み込み後の保持（AC1.2.1）、保存失敗の表示（AC8.3.1）、別のタブでの変更（AC3.4.4）、CSV の取り込み全体（AC7.2.1〜AC7.2.4）を、Chrome で手動または自動で確かめる。
- 現在、ブラウザ拡張機能（Claude in Chrome）が接続されていないため未実施。結果は `test-results.md` の Unverified。
