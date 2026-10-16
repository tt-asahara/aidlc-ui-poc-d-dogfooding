<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-10-16T09:50:00Z [unit data-contract] — 計画の外で契約 C1 に任意の項目 CsvLine.fields? を追加した（列数が5でない行の判定と、U6 の不正行表示に必要）。任意項目の追加なので変更ルール上は非破壊だが、承認済み計画にない変更として Unit の確認で示す。
- 2026-10-16T09:50:00Z [unit data-contract] — メモに文字列以外が渡された場合の文言「メモ：文字で入力してください」を rules.md にない形で追加した。W1 の「想定外の型は required」の方針に従った。

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
- 2026-10-16T10:48:00Z [unit ui-kit] — U1 の性能テストが別の vitest の同時実行で1回失敗した。単独・verify では合格。検証コマンドが負荷で揺れないか Build and Test で注意する（しきい値は変えない）。
- 2026-10-16T10:48:00Z [unit ui-kit] — 開発担当が eslint.config.js の最初の書き換えをシェル（python3）で行った（ファイル用道具を使う決まりへの違反）。結果は確認済みだが、次の Unit の指示で改めて強調する。
- 2026-10-16T11:55:00Z [unit storage] — U1・U2 のテストが初回実行（キャッシュなし）で1件だけ一度失敗し、どのテストか記録がない。U2 のときの U1 性能テストの揺れと同じ種類と見られる。2 Unit 続けて起きたため、Build and Test で原因を特定する必要がある（しきい値は変えない）。指示で強調した結果、設定ファイルのシェル編集は再発しなかった。
- 2026-10-16T12:55:00Z [unit bookkeeping-core] — 初回実行の揺れ（U1〜U3 の 2 件）の原因候補が見つかった。ESLint を使う lint-config テストの初回の読み込みが既定の 5 秒の待ち時間を超える。U4 では beforeAll で読み込みを済ませたが、U1〜U3 は同じ書き方のまま。Build and Test で確かめる。
- 2026-10-16T13:45:00Z [unit csv-exchange] — 不安定なテストが特定できた: U1 と U3 の lint-config テストが全体の並列実行で ESLint の初回読み込みの 5 秒を超える（単独 約 710ms）。eslint.config.js が大きくなるほど起きやすい可能性がある。今回の U6 は承認済みの計画と手順を指示の本文に貼る形に戻した。
- 2026-10-16T14:20:00Z [unit monthly-summary] — この Unit の開始時点で、オーケストレーターの使用モデルが claude-opus-5-5 から claude-sonnet-5-5 に変わっていた（利用者の依頼ではない）。U1〜U4・U6 までは Opus 5.5 の結果。以降は別のモデルでの結果として比較する。指示の貼り方は U4 と同じくファイルの場所を示す形にした。同じ不安定なテスト（U1・U3 の lint-config）が最初の全体実行でまた一度出た。
