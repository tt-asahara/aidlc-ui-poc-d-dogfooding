## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Iteration:** 2

### 概要

U7 app-screens の基盤設計を、再度、upstream と実際の設定ファイルに突き合わせて確認した。反復 1 の指摘は反映済みである。配布の検査は `scripts/check-dist.mjs` と許可リストファイル、終了コード、記録内容まで具体化された。`server.host` と `preview.host` の 127.0.0.1 固定は、vite.config.ts の項目と cicd-pipeline.md の第1章の両方に書かれた。tsconfig.json の include に vite.config.ts を加える記述も入り、JSX の設定は既存のままという表現に直った。プラグインを使わないことも明記された。ビルドの失敗は Build and Test の最初の手順で検出するという扱いも、第5章に書かれた。

確認した設定ファイルは package.json、eslint.config.js、vitest.config.ts、tsconfig.json、.npmrc、.nvmrc、.prettierignore である。`verify` の連結内容、Node 24 の固定、`dist/` と `coverage/` の除外は設計と一致する。vitest.config.ts と eslint.config.js に `src/app` の設定がまだ無いことは、コード生成で追加する前提と整合する。

新たに見つかったのは、実装時に拾えば済む Minor 3 件である。1 つ目は、新設する `scripts/check-dist.mjs` が eslint の node 用 globals の適用範囲（`files: ["*.js"]`）に入らないこと。lint が `process` や `console` を未定義として失敗する恐れがある。2 つ目は、検査の対象に CSS を挙げながら、CSS の `url()` と `@import` の検査項目が書かれていないこと。3 つ目は、`perf:` の印を本番ビルドから落とす具体的な方法が書かれていないこと。いずれも READY を妨げない。

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261016-budget-webapp/construction/app-screens/infrastructure-design/infrastructure-specification.md > 3. ビルドの設定（追加分）の tsconfig.json 行と index.html 行 | `src/app/perf.ts` は `import.meta.env.DEV` を使い、画面は `tokens.css` と `ui-kit.css` を import する。現在の tsconfig.json には `types` 指定が無く、Vite の型宣言（`vite/client`）を取り込む記述も設計に無い。`import.meta.env` と CSS の import は型エラーになり、`npm run verify` の typecheck と `build` の `tsc --noEmit` が失敗するおそれがある。 | tsconfig.json の変更に Vite のクライアント型の取り込みを加える。例として `src/vite-env.d.ts` に `/// <reference types="vite/client" />` を置く方法と、`types` に `vite/client` を加える方法がある。どちらにするかを決め、cicd-pipeline.md の追加設定の表にも反映する。 | New |
| R-02 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/app-screens/infrastructure-design/infrastructure-specification.md > 3. ビルドの設定（追加分）の package.json 行 | 「依存は Vite 本体だけを正確な版で固定する」とあるが、vitest 5.0.5 も内部で Vite に依存する。Vite の版が vitest の要求範囲とずれると、二重にインストールされるか、peer 依存の警告や失敗が起きる。`engine-strict` と `npm ci` を前提にした再現性の記述とも噛み合わない。 | 追加する Vite の版を、vitest 5.0.5 と Node 24 が対応する範囲から選ぶと明記する。Build and Test の最初に `npm ls vite` で二重インストールが無いことを確かめる手順を加える。 | New |
| R-03 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/app-screens/infrastructure-design/infrastructure-specification.md > 4. 配布の検査 | 外部参照と計測の印の検査は、NFR1.1 を成果物で守る要の手順である。しかし「検査の手段は Build and Test の記録に残す」とあるだけで、手順が決まっておらず、`verify` にも含まれない。実行者によって結果がぶれ、再実行もしにくい。 | 検査のコマンドか短いローカルスクリプト（例 `scripts/` 配下。ネットワークを使わないこと）の入力・出力・合否の基準を設計で決めておく。許可リストの記録先も 1 か所に決める。 | New |
| R-00 | Major | aidlc/spaces/default/intents/261016-budget-webapp/construction/app-screens/infrastructure-design/cicd-pipeline.md > review findings table | The reviewer's findings table could not be read, so its rows are not listed here: the findings report could not be read. Write the whole review again with the required Prior findings and New findings tables | Address the reviewer's findings as written below this table. | Unresolved |

**The reviewer's findings, as written:**

> **Prior findings**
>
> | ID | Now | Severity | Note |
> |---|---|---|---|
> | 1 | fixed | Major | dist の外部 URL 検査を、参照の形の定義、許可リスト、`scripts/check-dist.mjs` の手順、終了コードまで具体化した。名前空間 URL と React のエラー案内 URL の扱いも明記された。 |
> | 2 | fixed | Minor | `server.host` と `preview.host` を 127.0.0.1 に固定する指定を vite.config.ts の項目と cicd-pipeline.md の第1章に追加した。 |
> | 3 | fixed | Minor | tsconfig.json の include に vite.config.ts を加える記述を追加し、プラグインは使わないと明記した。JSX の設定は既存のままとする表現に直った。 |
>
> **New findings**
>
> | Severity | Location | Finding | Required action |
> |---|---|---|---|
> | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/app-screens/infrastructure-design/infrastructure-specification.md > 4. 配布の検査（検査の手順） と cicd-pipeline.md > 1. コード生成で追加する設定 | 新設する scripts/check-dist.mjs の eslint 上の扱いが書かれていない。現在の eslint.config.js で node の globals を与えるのは files が `*.js` のブロックだけで、scripts 配下の `.mjs` には当たらない。js.configs.recommended の no-undef により、process や console の参照で `npm run lint`（警告 0 件）が失敗する恐れがある。prettier の対象にもなる。 | cicd-pipeline.md の第1章の eslint.config.js の行に、scripts/**/*.mjs へ node の globals を与える指定を加える。あるいはスクリプトを lint の対象外とする方針を決めて明記する。prettier の整形対象であることも一言添える。 |
> | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/app-screens/infrastructure-design/infrastructure-specification.md > 4. 配布の検査（外部への参照） | 検査の対象に「HTML・JavaScript・CSS」を挙げているが、外部への参照の形の一覧は HTML の属性と JavaScript の `fetch(`・`import(`・`new URL(` だけである。CSS の `url(http...)` と `@import` が外部を指す場合が検査から漏れる。外部フォントや外部画像の混入は、まさに CSS から入りやすい。 | CSS の `url()` と `@import` の引数が `http://`、`https://`、`//` で始まる場合も違反とする項目を追加する。check-dist.mjs の検査対象にも含める。 |
> | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/app-screens/infrastructure-design/monitoring-design.md > 2. 開発時の計測 | `perf:` の印を開発ビルドだけに限る具体的な仕組みが書かれていない。例えば import.meta.env.DEV による分岐の削除のような方法である。検査は印の有無を確かめるだけで、混入した場合の直し方は実装者の推測になる。 | 計測を開発ビルド限定にする方法を一文で示す。例えば import.meta.env.DEV の条件下でのみ記録し、本番ビルドでは分岐ごと削除される形にする。 |

### Summary

反復 1 の Major と Minor 2 件は、いずれも解消した。ローカル完結の基盤設計として、実装者が迷わず進められる状態である。残るのは eslint のスクリプトの扱い、CSS の外部参照の検査、`perf:` の除去方法という Minor 3 件で、コード生成の段階で拾えば足りる。
