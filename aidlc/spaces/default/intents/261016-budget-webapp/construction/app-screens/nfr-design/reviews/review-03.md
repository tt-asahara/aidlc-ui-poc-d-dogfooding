## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Iteration:** 3

### 概要

security-design.md、performance-design.md、logical-components.md、traceability.json を通読し、infrastructure-design（infrastructure-specification、monitoring-design）と nfr-requirements の記述と突き合わせた。前回の Major（本番ビルドでは perf.ts が空になるため、合否に使う値の取り方が未定義）は、performance-design 第3章で解消している。合否の測定は `npm run build` の成果物を `npm run preview` で配信したページに対し、外部から行うと定めている。手段は Chrome の開発者ツールのパフォーマンス記録、またはブラウザ操作の道具から測定時だけ注入する計時の処理で、dist には含めない。同じ操作を5回行い、中央値で判定して最悪値を併記し、実行環境とビルドの版を記録する。perf.ts は開発中の目安だけに使い、合否には使わないと明記されている。dist に `perf:` の印が残らないことの検査は、infrastructure-specification 4章と monitoring-design に同じ内容で書かれていて、注入式の測定とも両立する。logical-components の「計測」の行も開発用のみという記述で矛盾しない。traceability.json の参照先は実在する章を指している。新しい指摘はない。

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261016-budget-webapp/construction/app-screens/nfr-design/security-design.md > 第2章 通信と保存先 | 「画面は U4〜U6 を import しない」と書かれているが、logical-components.md の依存図と部品表では、reads.ts が U4・U5 を、CSV 画面が U6 を import している。このまま ESLint の no-restricted-imports に写すと、正しい実装がすべて違反になるか、規則が空になる。また、禁止する import のパスと、許可する公開窓口（../bookkeeping-core、../monthly-summary、../csv-exchange、../ui-kit、../data-contract の index だけ）が列挙されていない。 | 「U3 storage と各 Unit の内部ファイルの import を禁止し、公開窓口の index だけを許可する」と書き直す。src/app 用の no-restricted-imports の禁止パスと許可パスを、U5・U6 の既存の記述と同じ粒度で明記する。 | New |
| R-02 | Major | aidlc/spaces/default/intents/261016-budget-webapp/construction/app-screens/nfr-design/traceability.json > coverage の NFR2.2、NFR5.1、NFR6.1、NFR6.2、NFR8.2 | 対象に挙げた記述が実在しない。NFR2.2 は「security-design.md 第6章の axe-core の検査」だが、第6章に axe-core の言及がない。NFR5.1 は「logical-components.md 第1章: 金額は整数のまま表示」、NFR6.2 は「実装の後にテストを書く」だが、該当の記述がない。NFR6.1 は「しきい値」だが、第1章には「app 用プロジェクト」とあるだけで、src/app/** の行 80% のしきい値（vitest.config.ts の coverage.thresholds）を定めた記述がない。NFR8.2 は「内容の不変」だが、第3章は Blob の解放だけを述べている。結果として、これらの NFR は設計では未達なのに OK と記録されている。 | 各項目に対応する記述を設計書に足す（axe-core の検査を画面ごとの主な状態で行うこと、金額の3桁区切りの表示と小数計算の禁止、vitest.config.ts への app プロジェクト（jsdom）と thresholds の `src/app/**: { lines: 80 }`、U6 の結果を変えずに保存すること）。または、実在する記述に合わせて traceability の対象を直す。 | New |
| R-03 | Major | aidlc/spaces/default/intents/261016-budget-webapp/construction/app-screens/nfr-design/performance-design.md > 第2章 プレビューの表示 | 取り込める行を先頭 200 行までに絞り「ほか N 行」と表示する方針は、承認済みの Functional Design（rules.md BR7.2「取り込める行は行番号・日付・種別・カテゴリ・金額・メモを表示する」）やモックアップ（D3）にない、利用者に見える振る舞いの変更である。functional-spec・mockups にも「ほか N 行」の文言や受け入れ条件がない。さらに、取り込めない行は上限なしの全件表示のため、5,000 行がすべて不正なファイルでは DOM が 5,000 行になり、方針が主張する 2 秒の保護が効かない最悪のケースが残る。 | 200 行の上限を採るなら、BR7.2 とモックアップ D3 の更新（または人間の承認）を求め、「ほか N 行」の文言と受け入れ条件を Functional Design に反映する。取り込めない行にも表示の上限か、折りたたみ・段階表示の方針を定め、最悪ケース（全行不正）での描画の測定を Build and Test の項目に加える。 | New |
| R-04 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/app-screens/nfr-design/logical-components.md > 第1章 ビルドと検証 | 設計で参照している eslint.config.js への src/app ブロックの追加、vite.config.ts の設定（外部 URL を出さない、フォントや画像の同梱）、tsconfig の JSX 設定が、部品表の「予定のファイル」に含まれていない。コード生成の計画で漏れやすい。 | 部品表のビルドと検証の行に eslint.config.js、tsconfig.json、package.json のスクリプト（dev、build、preview）を加える。 | New |
| R-05 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/app-screens/nfr-design/security-design.md > 第3章 ファイルのダウンロード | 「保存の直後（同じ操作の中で）に revokeObjectURL を行う」は、ブラウザによってはダウンロード開始前に URL が無効になる可能性がある（アンカーの click 直後の同期的な解放）。NFR7.1 は Edge・Firefox・Safari を手動確認とするが、その確認項目にダウンロード成功が明記されていない。 | 解放のタイミング（click の直後か、次のタスクへの遅延か）を決めて明記し、Chrome 以外のブラウザでのダウンロードの成功を手動確認の項目に加える。 | New |
| R-06 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/app-screens/nfr-design/performance-design.md > 第3章 測り方と記録 | 計測の関数を「開発用のフラグでだけ動かす」とあるが、どの部品（reads.ts か status.tsx か）が持つか、フラグの種類（import.meta.env.DEV など）、本番ビルドで消えることの確認方法が論理部品に割り当てられていない。 | 計測の関数を部品表のどこに置くかと、フラグの方式を決める。ビルド成果物に計測コードが残らないことの確認（NFR9.1 の build 後の検査）を足す。 | New |
| R-00 | Major | aidlc/spaces/default/intents/261016-budget-webapp/construction/app-screens/nfr-design/security-design.md > review findings table | The reviewer's findings table could not be read, so its rows are not listed here: the findings report could not be read. Write the whole review again with the required Prior findings and New findings tables | Address the reviewer's findings as written below this table. | Unresolved |

**The reviewer's findings, as written:**

> **Prior findings**
>
> | ID | Now | Severity | Note |
> |---|---|---|---|
> | 1 | fixed | Minor | import の規則は security-design 第2章で、許可する公開窓口と禁止する内部ファイルが明記されている。 |
> | 2 | fixed | Minor | NFR の根拠の文言は上流の ID と一致している。 |
> | 3 | fixed | Minor | プレビューは全件表示（BR7.2）で、一覧はスクロール領域に入れると明記されている。 |
> | 4 | fixed | Minor | perf.ts と build / preview の行が logical-components 第1章に載っている。 |
> | 5 | fixed | Minor | ビルドと検証の行に vite.config.ts、tsconfig の jsx、package.json のスクリプトが含まれている。 |
> | 6 | fixed | Minor | Blob の解放は 1000ms 遅らせ、後片付けでも解放すると security-design 第3章に書かれている。 |
> | 7 | fixed | Minor | 合否は本番ビルドを外部から測り、perf.ts は開発の目安に限ると第3章に明記された。dist の検査とも両立している。 |
>
> **New findings**
>
> | Severity | Location | Finding | Required action |
> |---|---|---|---|
