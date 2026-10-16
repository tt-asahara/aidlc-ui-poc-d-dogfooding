# ビルド手順（全体）

- 出典: `construction/app-screens/infrastructure-design/cicd-pipeline.md`、`construction/app-screens/infrastructure-design/infrastructure-specification.md`、`aidlc/spaces/default/memory/team.md`（Deployment：ローカルでビルド・起動できること）

## 1. 前提

- Node.js 24 系（`.nvmrc` と `engines`、`.npmrc` の `engine-strict`）
- `npm ci` でロックファイルどおりに依存を入れる（Vite 8.3.4 を含む）
- 外部の CI サービス、デプロイ、秘密情報、環境変数は使わない

## 2. 手順

1. 取得: `npm ci`
2. 整形・Lint・型・テスト・カバレッジ（一括）: `npm run verify`
3. 本番ビルド: `npm run build`（`tsc --noEmit` のあと `vite build`、出力は `dist/`）
4. 配布の検査（外部参照と計測の印）: `node scripts/check-dist.mjs dist`（許可リストは `scripts/check-dist-allowlist.txt`）
5. 検査スクリプトの単体テスト: `node --test scripts/check-dist.test.mjs`
6. 配信（確認用）: `npm run preview`（127.0.0.1:4173）。性能と実ブラウザの確認は Build and Test の `test-results.md` を参照

## 3. 起動（ローカル）

- 開発: `npm run dev`（127.0.0.1）
- 本番ビルドの確認: `npm run build` のあとに `npm run preview`

## 4. 既知の注意

- `dist/` は `npm run build` で作られる。`verify` の対象ではない。
- 配布の検査の許可リストは、最初のビルドで見つかった 5 件（名前空間の識別子 4 件、React のエラー案内 URL 1 件）だけ。新しい違反が出た場合は、理由を確かめてから記録する（許可の追加は利用者の判断に含める）。
- 既存の Unit の lint-config テストは、全体の並列実行で時々時間切れになる既知の揺れがある（U1・U3、code-summary の記録）。失敗したら単独で再実行して、判定の内容が変わっていないことを確かめる。
