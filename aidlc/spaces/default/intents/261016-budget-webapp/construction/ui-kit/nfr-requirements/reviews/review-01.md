## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-16T10:02:24Z
**Iteration:** 1

### 概要

ADVISORY の単一パスです。ui-kit（U2、library）の security-requirements.md、tech-stack-decisions.md、traceability.json を、requirements.md の NFR1〜NFR9、functional-design の rules.md（BR1.1〜BR8.3）、U1 で決まった共通の道具（package.json、vitest.config.ts）と突き合わせました。NFR1、NFR2、NFR6〜NFR9 は ID が解決し、確かめ方もそろっています。NFR4、NFR5 の N/A も妥当です。ブロックする欠陥はありません。人間が承認前に確認すべき点は、U1 の共通テスト設定と U2 の想定の食い違い、および dialog の補いに頼るテストの限界です。

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261016-budget-webapp/construction/ui-kit/nfr-requirements/tech-stack-decisions.md > 第1章「テストの環境」「JSX の変換」「React の Lint」 | U1 の共通設定（vitest.config.ts）は include が `src/**/*.test.ts`、coverage の include が `src/**/*.ts` で、environment は node のみ。U2 のテストと部品は `.tsx` になり、このままではテストが実行されず、部品も行カバレッジ 80% の対象外になる。U2 だけ jsdom にする方法（projects や environmentMatchGlobs など）、`.tsx` を対象に加える設定、tsconfig の jsx と lib dom、eslint.config.js への tsx 対応と react-hooks の追加が書かれていない。 | 共通設定（vitest.config.ts、eslint.config.js、tsconfig.json）に加える変更を項目として明記する。その際、U1 のテストを node のまま保つこと、カバレッジ 80% の下限を `.tsx` を含めて U2 に実際にかけること、下限を下げないことも書く。 | New |
| R-02 | Major | aidlc/spaces/default/intents/261016-budget-webapp/construction/ui-kit/nfr-requirements/security-requirements.md > NFR7.1 と tech-stack-decisions.md > 「標準 dialog の補い」 | focus 閉じ込め（BR5.1〜BR5.5、AC9.2.1〜AC9.2.3）の自動テストは、jsdom 上の自前の補い（showModal、cancel）に対して通るだけで、実ブラウザの標準 dialog の動作は確かめない。実ブラウザでの確認は U7 の画面確認に委ねられているが、その確認が自動か手動か、何を見るかが NFR 側に書かれていない。補いが実物とずれると、全テストが通ってもフォーカス迷子（US9.2）が残る。 | NFR7.1 に、実ブラウザで確かめる最小の項目（開いた直後の初期フォーカス、Tab の循環、Esc、閉じた後の戻し先）と、確認を担う Unit と手段（手動のチェックリストか自動か）を書く。補いは「実物の仕様どおりの最小限」に限ると明記する。 | New |
| R-03 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/ui-kit/nfr-requirements/security-requirements.md > NFR1.1 の確かめ方 | 「`//` で始まる URL を検出するテスト」は、CSS やコードのコメント（`//`）、`http://www.w3.org/2000/svg` のような名前空間文字列で誤検出しうる。 | 検出の対象（コメントを除く、url() と import と属性値に限る）と許容リストの扱いを決めておく。 | New |
| R-04 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/ui-kit/nfr-requirements/security-requirements.md > NFR2.1 / NFR2.4 | jsdom の axe-core では color-contrast の規則が働かないため、NFR2.1 の「違反0件」はコントラストを含まない。NFR2.4 はトークンの値の組み合わせしか見ないので、実際の CSS で使われた色の組み合わせとはずれうる。BR1.2（動きの抑制）、BR2.3（44px 以上）、BR4.2（狭い幅のカード）も NFR 側の確かめ方がない。 | NFR2.1 に「jsdom の axe は color-contrast を除く」と書く。NFR2.4 の組み合わせの一覧を、tokens.css から読み取って生成する形にする。BR1.2、BR2.3、BR4.2 は確かめ方（CSS の静的検査か U7 の画面確認）を割り当てるか、対象外と明記する。 | New |
| R-05 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/ui-kit/nfr-requirements/tech-stack-decisions.md > 第1章 / NFR9.1 | NFR9.1 は「追加の依存を正確なバージョンで固定」とするが、React 19、@testing-library 3種、jsdom、axe-core、eslint-plugin-react-hooks の具体的なバージョンがない。axe-core を Vitest で使うための橋渡し（jest-axe か、axe-core を直接呼ぶか）も決まっていない。 | 候補のバージョンか、固定する時点（コード生成の最初）と責任者を明記する。axe-core の呼び出し方も決める。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| traceability.json の目視突き合わせ | NFR1〜NFR9 が requirements.md と一致。N/A は NFR4、NFR5 のみで理由あり | 上流 ID の取りこぼしなし |
| package.json、vitest.config.ts の確認 | U2 用の依存・jsdom・tsx 対象の設定なし | 上記 Major 1 の根拠 |

### Summary

ID の対応と要件の根拠は健全で、Critical はありません。Major は2件（共通テスト設定への変更の未記載、dialog の補いに頼るテストの限界と実ブラウザ確認の未定義）で、承認時に重みを見て判断してください。
