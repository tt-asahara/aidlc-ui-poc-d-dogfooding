## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-16T13:47:44Z
**Iteration:** 1

### 検証内容

- 助言（ADVISORY）の1回だけのレビュー。U4 の実際の公開窓口（`src/bookkeeping-core/types.ts`、`index.ts`）、C4、`eslint.config.js`、`vitest.config.ts` と突き合わせた。
- U4 の `Book` の3つの読み取り（`listCategories`、`getEffectiveBudgets`、`listTransactions`）は設計の呼び出しと形が一致する。`OperationError` の `rule`・`storage` も実在し、`category-missing` は `RuleViolation` に実在する。C4 の型は変更されていない。
- `traceability.json` は JSON として正しく、上流の NFR1.1、NFR3.1、NFR3.2、NFR5.1、NFR5.2、NFR6.1〜NFR6.3、NFR8.1〜NFR8.3、NFR9.1 の12件をすべて OK にしている。参照先の第1・2・3・5章と5.1〜5.3節は security-design.md に存在する。
- mermaid は目視で確認し、構文は有効。依存の向きに循環はない。
- FD・NFR-R レビューの Minor（合計の定義、種別の不一致、読み取りの順と別タブの書き込み、予算だけの食い違い、エスケープの持ち主、性能しきい値）には、設計が実際に答えている。合計は行の actual の和に一本化されている。
- Critical と Major は見つからなかった。以下はいずれも実装前に押さえておくと手戻りを減らせる Minor。

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/monthly-summary/nfr-design/security-design.md > 第3章 外部に出さないこと（compute.ts への追加の禁止） | compute.ts の追加の禁止（Date、Math.random、setTimeout、setInterval）は「さらに」としか書かれていない。eslint.config.js はフラット設定で、同じ規則を指定した後のブロックが前のブロックを置き換える。実際、既存の Unit のブロックも「書き切る」と注記している。compute.ts 用に別ブロックを足すと、fetch・indexedDB・eval など第3章の表の禁止が compute.ts でだけ外れる。Math.random は no-restricted-properties 側の指定なので、そちらの一覧にも合流させる必要がある。 | 実装の指示として次のどちらかを書く。(a) compute.ts 用のブロックに、第3章の禁止の一覧（globals・properties・imports）に Date・setTimeout・setInterval・Math.random を足した完全な一覧を持たせる。(b) 共通の定数を作り、2つのブロックがそれを展開して使う。あわせて、compute.ts が U4 の値（openBook など）を import していないことを守る方法を決める。例えば `import type` だけに限る no-restricted-imports の指定を compute.ts に足す。 | New |
| R-02 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/monthly-summary/nfr-design/security-design.md > 第2章 読み取りと食い違い | 読み取りの順を categories → budgets → transactions と定めたが、その理由は書かれていない。FD の rules.md BR4.1 は transactions → categories → budgets の順で書かれており、設計は順を入れ替えた。どちらの順でも別タブの書き込みによる偽の category-missing は起きうる（categories を先に読むと、その後に別タブで作られたカテゴリの収支が一覧になく失敗になる）。順の選択は「どの食い違いを許すか」に直結するため、根拠がないと実装者が元の順に戻しかねない。また、3つのうち「最初の失敗」を返す規則（BR4.1）の最初が変わる。 | この順を選んだ理由（どの食い違いをどちらに倒すか）を1〜2行で追記する。BR4.1 の順との違いを意図的なものとして明記する。テストの観点には、どの読み取りが失敗したかで返る失敗が変わらないことを入れる。 | New |
| R-03 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/monthly-summary/nfr-design/security-design.md > 第2章 種別の不一致も category-missing にまとめる | U4 の `RuleViolation` には `category-type-mismatch` が実在するが、設計は種別の不一致にもあえて `category-missing` を返す。理由は「画面の対応が同じ」としか書かれておらず、U4 の既存コードを使わない理由（U7 が両方を扱う前提か）は示されていない。U7 が `category-type-mismatch` を別の文言にする場合、U5 だけが違うコードを返すことになる。 | `category-type-mismatch` を使わない決定と、U7 が U5 の失敗に対して `category-missing` だけを扱えばよいことを、U7 への引き継ぎに1行で明記する。 | New |
