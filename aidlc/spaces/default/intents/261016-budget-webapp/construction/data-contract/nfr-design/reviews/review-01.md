## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Iteration:** 1

### 概要

U1（kind: spec）の NFR Design として security-design.md と traceability.json を確認しました。traceability.json は上流の NFR1.1、NFR3.1、NFR5.1、NFR6.1、NFR6.2、NFR8.1〜NFR8.5、NFR9.1 の11件すべてを網羅し、各項目の参照先章も security-design.md に実在します。設計は実装者が推測なしで進められる水準です。ブロックする欠陥は見つかりませんでした。人間が承認前に確認しておくとよい点を、重要度順に以下へ挙げます。

### 検証内容

- security-requirements.md と tech-stack-decisions.md の NFR ID 11件と traceability.json の突き合わせ（欠落・余分なし）。
- 第2章の Lint 禁止対象を、NFR1.1 の要件（`fetch`、`XMLHttpRequest`、`WebSocket`、`navigator.sendBeacon`、`indexedDB`、`localStorage`）と比較。設計は要件を包含して拡張しています。
- 第4章の数式対策の範囲（先頭文字 `=` `+` `-` `@`、対象列はカテゴリ名とメモ）と NFR8.1、BR4.5、BR4.6 の整合。
- 第5章の各手段と tech-stack-decisions.md の目標値（NFR3.1 は 300ms、NFR6.1 は行 80%、NFR9.1 は npm ci と verify）の整合。

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261016-budget-webapp/construction/data-contract/nfr-design/security-design.md > 第2章 Lint で禁止する参照 と 4.2 時間の上限 | 禁止リストには `Date`、`setTimeout`、`node:` import、`globalThis` 経由の参照が含まれます。一方で 4.2 の時間測定テストと「Lint 設定のテスト」（ESLint を Node 上で起動する）は、時計やクロックの参照や `node:` 組み込みモジュールを必要とします。この禁止が適用される範囲（`src/data-contract/` 配下のテストファイルを含むか）と、テスト用の除外設定が書かれていません。テストを同じフォルダに置くと、時間測定テストや Lint 設定のテストが verify の Lint で自己矛盾して失敗します。 | 禁止の適用範囲を本番コードに限ると明記し、`*.test.ts` を対象外にする ESLint 設定の方針か、テストの置き場所を決めます。あわせて、禁止リストに `performance` を含めるかどうかも決めます。 | New |
| R-02 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/data-contract/nfr-design/security-design.md > 4.2 時間の上限（NFR3.1、NFR8.4） | NFR3.1 の目標は 300ms ですが、テストの合格条件は 1,000ms で、300ms 超過は警告のみです。そのため 300ms の目標は検証コマンドで強制されません。余裕を持たせる意図は tech-stack-decisions.md に明記されていますが、目標を満たしたことの証明にはなりません。 | 「合格 1,000ms は暴走の検出用、300ms は参考値」と位置づけを明記するか、記録した測定値を Build and Test の報告に含めます。 | New |
| R-03 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/data-contract/nfr-design/security-design.md > 第3章 例外を投げない | 「想定外の例外が起きた場合でも、内部の判定は例外の捕捉で包まない」とあります。この場合、公開窓口から例外が漏れ、NFR8.2（例外を投げない）に反します。想定外の例外が起きたときの扱い（そのまま伝播させ、呼び出し側の U2 以降の境界で扱う、など）が書かれていません。 | 想定外の例外は握りつぶさず伝播させる前提と、呼び出し側が担う境界を一文で明記します。または、NFR8.2 の範囲を「想定した入力の型」に限ると書きます。 | New |
| R-04 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/data-contract/nfr-design/security-design.md > 4.1 数式対策の範囲 | 先頭のタブと CR を対象外とする理由は、保存される値が BR1.4・BR2.1 で前後の空白を取り除いた後の値であることに依存します。この前提が崩れた場合（たとえば将来メモの正規化規則が変わった場合）に、数式対策が黙って抜けます。この依存を検出するテストは第4.3の往復テストの値の集合にありません。 | 往復の性質テストの値の集合に、先頭がタブ・CR の入力を加えます。検証で取り除かれて保存されないことを確かめ、前提を回帰テストで固定します。 | New |
