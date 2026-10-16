# 基盤の仕様（app-screens）

- 出典: `construction/app-screens/nfr-design/logical-components.md`（ビルドと検証、計測）、`construction/app-screens/nfr-design/performance-design.md`（本番ビルドでの合否）、`construction/app-screens/nfr-requirements/tech-stack-decisions.md`（Vite、スクリプト）、`aidlc/spaces/default/memory/team.md`（Deployment）、`inception/requirements-analysis/requirements.md`（NFR1、NFR9、Q8）、Infrastructure Design のレビュー（反復 1：Major 1、Minor 3）

## 1. 配布の形

- デプロイはしない（team.md Deployment）。ローカルでビルドし、ローカルで起動して確認できることがゴール。
- 成果物は `dist/`（Vite のビルド結果）。静的な HTML・JavaScript・CSS だけで、サーバーは要らない。
- 起動は `npm run dev`（開発）または `npm run build` のあとに `npm run preview`（本番ビルドの確認）。どちらも待ち受けは 127.0.0.1 に固定する（vite.config.ts の `server.host` と `preview.host`）。外部には公開しない。

## 2. 環境

| 項目 | 内容 |
|------|------|
| Node.js | 24 系（`.nvmrc` と `engines` で固定。`engine-strict` で他の版は失敗する） |
| ブラウザ | 検証は Chrome 最新版（主）。Edge・Firefox・Safari は手動確認（Build and Test） |
| 保存先 | 利用者のブラウザの IndexedDB（サーバーの保存はない） |
| 秘密情報 | 使わない。環境変数も要らない（アプリに鍵・資格情報の処理がない） |

## 3. ビルドの設定（追加分）

| ファイル | 内容 |
|----------|------|
| `vite.config.ts` | ルートは `index.html`、出力は `dist/`。`server.host` と `preview.host` を `127.0.0.1` に固定する。外部の参照を入れない（CDN や外部フォントを使わない）。React 用のプラグインは使わない（JSX は tsconfig の `react-jsx` を Vite の標準の変換で扱う。Fast Refresh は要件外） |
| `index.html` | 起動点 `src/app/main.tsx` を読み込む。文字コードは UTF-8、言語は ja |
| `tsconfig.json` | `include` に `vite.config.ts` を加え、`npm run typecheck` の対象にする。JSX の設定（`react-jsx`）は既存のまま |
| `src/app/vite-env.d.ts` | `/// <reference types="vite/client" />` の1行だけを置く。`import.meta.env` と CSS の import の型を、Vite のクライアント型から取り込む（tsconfig の `types` は変えない） |
| `package.json` | `dev`、`build`（型チェック → ビルド）、`preview` を追加。Vite は vitest 5.0.5 が要求する範囲の版を選び、正確な版で固定する。追加の後に `npm ls vite` で重複のないことを確かめる。プラグインは追加しない。`verify` は変えない |

## 4. 配布の検査（Build and Test で行う）

検査の対象は `dist/` の HTML・JavaScript・CSS とする。次の2つを、ビルドの後に確かめる。

1. **外部への参照**: 次の形の参照が1つもないこと。
   - HTML の `src`・`href` 属性、`<link>`・`<script>`・`<img>` の参照先が `http://`、`https://`、`//` で始まる。
   - JavaScript の `fetch(`、`import(`、`new URL(` の引数が外部の URL になる。
   - CSS の `url(` の引数、または `@import` の対象が外部の URL（`http://`、`https://`、`//`）になる。
   - 検査の対象外（許可リストに限る）: ライブラリに含まれる名前空間の識別子（例 `http://www.w3.org/2000/svg`、`http://www.w3.org/1999/xhtml`、`http://www.w3.org/1998/Math/MathML`）と、ライブラリのエラー案内の URL（React の `https://react.dev/errors/` で始まる文字列）。許可リストは Build and Test の最初のビルドで見つかったものだけを記録し、それ以外は失敗とする。
   - 正規表現やコメントの中の `//` は、上の参照の形でないかぎり失敗としない（ただし、判定の結果は記録する）。
2. **計測の印**: `dist/` に `perf:` が残らないこと（performance-design 3章）。計測の記録は `if (import.meta.env.DEV) { ... }` の中だけに書く。Vite は本番ビルドで `import.meta.env.DEV` を `false` に置き換え、その分岐は圧縮の段階で消えるため、印は本番の成果物に残らない。

**検査の手順（決定）**:
- 検査は `scripts/check-dist.mjs`（Node.js の標準機能だけを使う、ネットワークを使わない小さなスクリプト）で行う。入力は `dist/` の中身、出力は違反の一覧（ファイル名、行番号、見つかった文字列）と終了コード。違反が0件なら終了コード 0、1件でもあれば 1。
- 許可リストは `scripts/check-dist-allowlist.txt` に1行1件で置く。最初のビルドで見つかった名前空間の識別子とエラー案内の URL だけを書き、その理由を末尾のコメントに書く。許可リストに無いものは違反とする。
- 検査は Build and Test で `npm run build` の直後に実行し、結果（違反の数、許可リストの件数）を記録に残す。`npm run verify` には含めない（ビルドを含まないため）。
- スクリプトと許可リストは Code Generation の成果物として作る（コード生成の計画で手順に入れる）。

## 5. ビルドの完了確認

- Unit の完了確認は `npm run verify` の終了コードで行う（team.md の既存の決め）。`npm run build` は含めないため、ビルドの失敗（vite.config.ts や index.html の不備）は Build and Test の最初の手順で検出する。この扱いを Build and Test の入口で明記する。
