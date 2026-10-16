## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-16T10:36:06Z
**Iteration:** 1

### 概要

助言型（ADVISORY）の1回限りのレビューです。`npm run verify`（整形・lint・型チェック・テスト）は成功しました（20 ファイル・325 件合格、行カバレッジ 100%、src/ui-kit/** も行 80% 超）。C6 の型は src/ui-kit の実装および index.ts の公開と一致しています。ui-kit の lint 制限は NFR1.1・NFR8.1 に沿って働き、eslint-disable もありません。U1 側の lint 設定とカバレッジのしきい値は弱められていません。Dialog の cancel/close 同期・フォーカストラップ・フォーカスの戻し、Tabs のキーボード操作、Button の busy は BR の記述どおりに実装されています。計画との違い（code-summary.md の一覧）はいずれも妥当と判断します。以下はブロックしない所見です。

### 検証内容

- 実行: `npm run verify` 成功。
- 読んだもの: Dialog.tsx、Tabs.tsx、Button.tsx、FileInput.tsx、index.ts、eslint.config.js、vitest.config.ts、contract-summary.md の C6、code-summary.md。
- C6 と実装の突き合わせ: Button・Dialog・Tabs・FileInput の props と型は一致。残りの部品は公開名が index.ts にあることを確認。
- src/data-contract は git 上すべて未追跡のため差分では比較できません。U1 の lint 規則は変更前の形のまま残り、verify で U1 の 212 件が合格していることで確認しました。

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | src/ui-kit/Tabs.tsx > Tabs 本体（activeId と renderPanel） | `selectedId` が `tabs` に存在しないとき、タブ列とパネルの aria-labelledby は先頭のタブ（activeId）に合わせているが、パネルの中身は `renderPanel(selectedId)` で描画される。見出しと中身が食い違う。 | `renderPanel(activeId)` に揃えるか、不一致を呼び出し側の誤りとして扱う方針を決めてテストに残す。 | New |
| R-02 | Minor | src/ui-kit/Dialog.tsx > 開閉の useEffect とクリーンアップ | 副作用の依存配列に `initialFocusRef`・`returnFocusRef` が入っている。呼び出し側が毎回新しい ref オブジェクトを渡すと、再描画のたびにダイアログを閉じて開き直し、フォーカスの戻しも走る。`close` イベントは非同期のため、閉じてすぐ開き直した場合に前の `close` が `isOpenRef=true` の状態で届き、誤って `onClose("escape")` を呼ぶ余地もある。 | 利用者（U7）には `useRef` で安定した ref を渡すことを C6 の注記か README に書く。必要なら ref の最新値を ref に保持して依存配列から外す。 | New |
| R-03 | Minor | src/ui-kit/tokens.css・code-summary.md 残る課題 | `--color-border` が白背景で 3.04:1、surface 上で 2.81:1 と、入力欄の枠の非テキスト 3:1 を下回る場合がある。「入力欄を surface の上に置かない」前提に頼っており、U7 側で守られる保証がない。 | 枠色を濃くして 3:1 を満たすか、U7 の Build and Test の確認項目に必ず入れる。 | New |
| R-04 | Minor | eslint.config.js > UI_KIT_RESTRICTED_GLOBALS・UI_KIT_RESTRICTED_PROPERTIES | 通信・保存の禁止は直接参照と `window.`・`globalThis.`・`self.` 経由に限られる。別名への代入（`const w = window; w.fetch`）、動的 import、`new Image().src` などは検出されない。NFR1.1 の機械的な担保としては網羅ではない。 | 限界を security-design.md か README に明記する。no-external.test.ts の走査が補えているかを U7 の Build and Test で再確認する。 | New |
| R-05 | Minor | vitest.config.ts > coverage.thresholds・code-summary.md 残る課題 | `src/ui-kit/**` の行 80% しきい値が実際に失敗として働くかを確認していない。U1 の性能テスト（csv.perf.test.ts）は並行実行時に一度失敗しており、負荷による揺れがマージ前検証の不安定要因になりうる。 | しきい値を一時的に上げて失敗することを確認する。性能テストの許容を Build and Test で見直す。 | New |
