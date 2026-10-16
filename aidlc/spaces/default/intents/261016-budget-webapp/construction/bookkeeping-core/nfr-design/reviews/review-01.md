## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-16T11:53:40Z
**Iteration:** 1

### 概要

助言型レビュー（1回のみ）。U3 の実際の API（`src/storage/types.ts` の `TxContext`・`write`・`WriteError`）、U1 の `messages.ts`、既存の `eslint.config.js` と `vitest.config.ts` に照らして実現可能性を確かめた。Critical と Major はない。

- getCategoryUsage の拡張（Q1 = A）は U3 の API だけで実現できる。収支は `tx.count("transactions","byCategory",id)`、予算は `tx.getAllByIndex("budgets","byCategory",id)` で数えられる。`deleteCategory` が既に `deletedBudgets` を返すため、確認画面の件数と整合する。
- U4 が持つ月・種別の文言は U1 の `messages.ts` の `monthInvalid`・`typeInvalid` と一字一句同じで、一致テストの前提が成り立つ。
- 14件の NFRx.y（NFR1.1、3.1、4.1〜4.4、5.1、6.1〜6.3、8.1〜8.3、9.1）は traceability.json で漏れなく対応づけられ、参照先の章も存在する。mermaid は構文上問題なく、依存は非循環。
- ESLint の禁止一覧は、既存の storage ブロックと同じ「ブロックごとに書き切る」方式で、フラット設定の合成の制約を踏まえている。vitest のプロジェクトとしきい値も既存の書き方で足せる。

以下は人が承認前に考慮するとよい Minor のみ。

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/bookkeeping-core/nfr-design/security-design.md > 1章 件数の数え方 | 「カテゴリの件数は `tx.getAll("categories")` の長さ」とあるが、BR3.4 の last-category-of-type は同じ種別の件数で判定する。文面どおり全件の長さで実装すると、収入と支出の合計で判定して誤る。 | 「同じ種別のカテゴリ件数（`getAll` の結果を type で絞った長さ）」と書き直す。BR1.2 の 0 件判定だけが全件の長さであることも区別して書く。 | New |
| R-02 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/bookkeeping-core/nfr-design/security-design.md > 3章 削除確認のための使用件数 | getCategoryUsage の budgets は保存されている予算の行数（設定した月の数）であり、引き継ぎで効く月数ではない。「予算（N件）」の表示は利用者に月数と読まれるおそれがある。また、確認で表示した件数と deleteCategory の deletedBudgets が一致する保証がテスト観点に書かれていない。 | 件数が「設定済みの月の数」であることを U7 向けに明記する（文言は U7 が決める）。テストに「getCategoryUsage の budgets と deleteCategory の deletedBudgets が同じ状態で一致する」を加える。 | New |
| R-03 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/bookkeeping-core/nfr-design/security-design.md > 8.1 構成 | 「別のタブ」のテストで2つの Book を作る方法が曖昧。同じ保存領域を共有するには、2つの Book が同じ IDBFactory と dbName を使う必要がある（「新しい IDBFactory、テストごとに別の dbName」だけでは別々の保存領域になりうる）。openBook の `storage` 引数で同じ factory を渡すことも書かれていない。 | 「1つのテスト内で factory と dbName を1組だけ作り、2つの openBook の storage 引数に同じ組で openStorage を渡す」と明記する。 | New |
| R-04 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/bookkeeping-core/nfr-design/security-design.md > 8.3 性能の確かめ方 | 性能テストは listTransactions・getEffectiveBudgets と import だけが対象。今回広げた getCategoryUsage（30 カテゴリ × 収支・予算の索引の読み取り）と deleteCategory は測られず、U7 の削除確認の表示が遅くなっても U4 の層では気づけない。 | getCategoryUsage（NFR3 の前提件数）を同じ中央値方式で測る行を加える（合格条件は例えば 200ms 以内）。 | New |
| R-05 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/bookkeeping-core/nfr-design/logical-components.md > 4章 他の Unit との境界（C3 の更新） | C3 の更新が5項目あるが、`openBook` の `options` 型の現行定義（`storage` のみ）に対する具体的な変更後の型が書かれておらず、コード生成で型の食い違いが起きうる。また validation の `line?` は `errors: ValidationError[]` と同じオブジェクトに付くことが明示されていない。 | 変更後の `openBook` の options 型と、`OperationError` の validation 型（`{ kind: "validation"; errors: ValidationError[]; line?: number }`）を、そのまま書き写せる形で載せる。 | New |
