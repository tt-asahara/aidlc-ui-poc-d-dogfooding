## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-16T11:55:26Z
**Iteration:** 1

### 概要

この Review は助言（ADVISORY）の 1 回限りの確認です。U4 は library で、外部 CI もデプロイもありません。cicd-pipeline.md は、ローカルの `npm run verify` をマージ前の条件とする流れを、team.md（Way of Working、Testing Posture、Deployment）と整合する形で記述しています。記述された npm スクリプト（format:check、lint、typecheck、test、verify）は package.json と一致します。traceability.json は JSON として正しく読み込めます。NFR1.1、NFR3.1、NFR6.1、NFR9.1 の 4 件は、すべて cicd-pipeline.md の章に対応づけられています。一方で、記述が現在の設定ファイルの状態より先に進んでいる点があります。人間が判断する際は、次の指摘を考慮してください。

### 検証内容

- package.json のスクリプトと engines（node >=24 <25）を確認しました。取得、整形、Lint、型、テストの各段階は、記述どおりに存在します。
- vitest.config.ts を確認しました。プロジェクトは data-contract、ui-kit、storage の 3 つだけです。bookkeeping-core のプロジェクトも、`src/bookkeeping-core/**` の行カバレッジしきい値もありません。
- eslint.config.js を確認しました。bookkeeping-core 用のブロックはありません。fake-indexeddb のテスト外 import を禁止する規則も、どのブロックにもありません。
- security-design.md の該当箇所は、「eslint に加える」「vitest に加える」という Code Generation 側の追加作業として書かれています（63 行目、79 行目）。

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261016-budget-webapp/construction/bookkeeping-core/infrastructure-design/cicd-pipeline.md > 第1章 3 と 5、第2章 テスト行 | 第1章と第2章は、bookkeeping-core 用の Lint ブロックと、`src/bookkeeping-core/**` のカバレッジしきい値を、すでにある仕組みのように書いている。実際の eslint.config.js と vitest.config.ts にはどちらもなく、`npm run verify` は設定を足さなければ U4 のコードに対して禁止規則とカバレッジ下限を強制せずに成功する。NFR1.1 と NFR6.1 の「OK」は、設定の追加を前提にして成り立っている。 | 「Code Generation で追加する構成変更」の一覧を足す。eslint の bookkeeping-core ブロック、vitest の `bookkeeping-core` プロジェクト（node、include `src/bookkeeping-core/**/*.test.ts`）、`src/bookkeeping-core/**` の行 80% しきい値を挙げる。Unit の完了確認の条件に、これらが入っていることの確認を含める。 | New |
| R-02 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/bookkeeping-core/infrastructure-design/cicd-pipeline.md > 第2章 テスト行（性能の目安） | 性能の目安（1 か月の一覧取得 200ms、5,000 行の取り込み 3,000ms）は、時間に依存する判定を `npm run verify` の通過条件に入れている。マシンの負荷しだいで不安定になりうる。「不安定なら記録して原因を調べる」とあるが、再試行や許容の方針はない。 | 時間の判定が不安定なときの扱いを決めて記す。例として、再実行の回数、測定回数の増加、しきい値には余裕を持たせて固定することを挙げる。しきい値を下げない方針と矛盾しないように書く。 | New |
| R-03 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/bookkeeping-core/infrastructure-design/cicd-pipeline.md > 第1章 3 | 禁止規則のうち、保存先の直接参照は他の Unit との境界を守るための規則である。ブロックの対象が `src/bookkeeping-core/**/*.ts` のテスト以外に限られるかどうかは、この文書からは読み取れない。他の Unit のブロックの書き方と揃っているかも、確認できない。 | 対象のファイルパターンと、除外するテスト・テスト補助ファイルの範囲を明記する。既存の storage ブロックの書き方（test の ignores）に合わせる。 | New |
