## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Iteration:** 1

### 概要

U7 app-screens の基盤設計（ローカルでビルドして起動する静的 React アプリ。デプロイ・クラウド・外部 CI・監視サービスなし）を確認した。team.md の Deployment、Testing Posture、上流の NFR 設計（NFR1.1、NFR3.1、NFR3.2、NFR6.1、NFR7.1、NFR9.1）との整合を見た。ワークスペースの package.json、tsconfig.json、vitest.config.ts、eslint.config.js、.prettierignore、.npmrc、.nvmrc も実際のファイルと突き合わせた。

「デプロイ・監視・外部 CI なし」という割り切りは team.md と矛盾せず、追跡 JSON の ID も上流に解決できる。`dist/` は prettier と eslint の無視対象に入っており、`npm run verify` が `dist/` に影響されないことも確認した。Major が 1 件、Minor が 2 件あり、Major は 2 件以下のため READY とする。ただし Major は、コード生成で最初の `typecheck` が失敗する原因になるので、承認前に設計へ反映するのが望ましい。

### 検証内容

- 追跡 JSON の upstream_ids と coverage が、上流の NFR ID と一致していることを確認した。
- package.json に Vite と `dev`、`build`、`preview` がまだ無いことは、コード生成で追加する前提の設計と整合している。
- vitest.config.ts には app プロジェクトがまだ無い。cicd-pipeline.md の「追加する内容」で定義されている。
- tsconfig.json は `types` 指定が無く、`include` が `src` と `vitest.config.ts` だけである。

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261016-budget-webapp/construction/app-screens/infrastructure-design/infrastructure-specification.md > 3. ビルドの設定（追加分）の tsconfig.json 行と index.html 行 | `src/app/perf.ts` は `import.meta.env.DEV` を使い、画面は `tokens.css` と `ui-kit.css` を import する。現在の tsconfig.json には `types` 指定が無く、Vite の型宣言（`vite/client`）を取り込む記述も設計に無い。`import.meta.env` と CSS の import は型エラーになり、`npm run verify` の typecheck と `build` の `tsc --noEmit` が失敗するおそれがある。 | tsconfig.json の変更に Vite のクライアント型の取り込みを加える。例として `src/vite-env.d.ts` に `/// <reference types="vite/client" />` を置く方法と、`types` に `vite/client` を加える方法がある。どちらにするかを決め、cicd-pipeline.md の追加設定の表にも反映する。 | New |
| R-02 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/app-screens/infrastructure-design/infrastructure-specification.md > 3. ビルドの設定（追加分）の package.json 行 | 「依存は Vite 本体だけを正確な版で固定する」とあるが、vitest 5.0.5 も内部で Vite に依存する。Vite の版が vitest の要求範囲とずれると、二重にインストールされるか、peer 依存の警告や失敗が起きる。`engine-strict` と `npm ci` を前提にした再現性の記述とも噛み合わない。 | 追加する Vite の版を、vitest 5.0.5 と Node 24 が対応する範囲から選ぶと明記する。Build and Test の最初に `npm ls vite` で二重インストールが無いことを確かめる手順を加える。 | New |
| R-03 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/app-screens/infrastructure-design/infrastructure-specification.md > 4. 配布の検査 | 外部参照と計測の印の検査は、NFR1.1 を成果物で守る要の手順である。しかし「検査の手段は Build and Test の記録に残す」とあるだけで、手順が決まっておらず、`verify` にも含まれない。実行者によって結果がぶれ、再実行もしにくい。 | 検査のコマンドか短いローカルスクリプト（例 `scripts/` 配下。ネットワークを使わないこと）の入力・出力・合否の基準を設計で決めておく。許可リストの記録先も 1 か所に決める。 | New |
