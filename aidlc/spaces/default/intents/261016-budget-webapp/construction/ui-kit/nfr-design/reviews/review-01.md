## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-16T10:05:15Z
**Iteration:** 1

### 概要

ui-kit（U2、library）の NFR Design について、security-design.md、logical-components.md、traceability.json を、上流の security-requirements.md・tech-stack-decisions.md と、共通設定（vitest.config.ts、eslint.config.js）に照らして確認した。NFR1.1、NFR2.1〜NFR2.4、NFR6.1、NFR6.2、NFR7.1、NFR8.1、NFR9.1 はすべて対策に対応づいており、traceability.json の上流 ID に抜けはない。NFR3.1 は N/A の理由が記録されている。U1 の設定を壊さずに拡張する方針も妥当である。重大な欠陥はなく、承認前に検討すべき点は Major 1 件と Minor 3 件である。

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261016-budget-webapp/construction/ui-kit/nfr-design/security-design.md > 3.1 実行時の設計（cancel イベント） | cancel で常に preventDefault して表示の開閉を open の値だけで決める設計だが、実ブラウザ（特に Chrome 系）では、利用者の操作を挟まずに Esc を続けて押すと cancel を止められず、dialog が閉じられる場合がある。このとき open の値は true のまま表示だけが閉じ、設計が防ごうとした食い違いが起きる。close イベントの扱いが設計になく、jsdom の補いでもこの挙動は再現できない（B1〜B4 にも該当項目がない）。 | dialog の `close` イベントを受け、open が true のまま閉じられた場合は onClose を呼ぶか showModal で再表示して状態を揃える規則を 3.1 に加える。あわせて、Esc の連続押下の確認項目を B1〜B5 に追加する。 | New |
| R-02 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/ui-kit/nfr-design/security-design.md > 3.3 実行するブラウザ | NFR7.1 は最新の Chrome、Edge、Firefox、Safari を対象にしているが、実ブラウザ確認は端末にある1種類だけでよいとしている。しかも確認は U7 の Build and Test に先送りされており、対応4種の検証範囲と未確認のブラウザの扱い（残る危険）が第6章に明記されていない。 | 第6章の残る危険に、未確認ブラウザは未検証として Build and Test の記録に明記する旨を加える。 | New |
| R-03 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/ui-kit/nfr-design/security-design.md > 2 設定の拡張（vitest.config.ts のカバレッジ対象）と 4 HTML の挿入禁止 | カバレッジ対象を `src/**/*.{ts,tsx}`（テストを除く）に広げると、テスト専用の test-setup.ts と型だけの index.ts が行 80% の分母に入り、数値が歪む。HTML の挿入禁止は dangerouslySetInnerHTML だけで、ref 経由の innerHTML・outerHTML・insertAdjacentHTML は NFR8.1 の趣旨に反するのに禁止されていない。 | カバレッジの exclude に `src/ui-kit/test-setup.ts` を加える。no-restricted-properties で innerHTML、outerHTML、insertAdjacentHTML も `src/ui-kit/` で禁止する。 | New |
| R-04 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/ui-kit/nfr-design/logical-components.md > 3 失敗の範囲 | 「時計は部品が画面から外れたときに必ず取り消す」としているが、security-design.md 第5章にこれを確かめるテストの手段（アンマウント後にタイマーが残らないこと）がなく、NFR との対応表（traceability.json）にも現れない。 | 第5章に、アンマウント後にタイマーが発火しないことを fake timers で確かめるテストを加える。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| なし（本ステージに検証ツールの指定なし） | 該当なし | 上流 ID と traceability.json の突き合わせは手作業で行い、不整合はなかった。 |
