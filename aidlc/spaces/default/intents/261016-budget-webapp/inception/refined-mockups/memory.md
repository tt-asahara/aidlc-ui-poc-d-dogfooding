<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-10-16T08:40:00Z — 収支・月次集計・予算の3タブで対象月を共有する設計にした。月を行き来するたびに各タブで選び直す手間をなくすためで、要件 FR5.1 の「初期値は今月」と矛盾しない。
- 2026-10-16T08:40:00Z — 使用中カテゴリの「削除」ボタンは無効化せず、押したときに理由を表示する形にした。無効なボタンはキーボード利用者が理由を知れないため（P2 の困りごと）。

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-10-16T08:40:00Z — 入力のラフモックアップ（wireframes、user-flow）は classic スコープでは作られないため、ストーリーと要件から直接設計した（ステージ定義が認める扱い）。質問 Q6（成功時の知らせ方）は回答後の追加質問として後から記録した。

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
