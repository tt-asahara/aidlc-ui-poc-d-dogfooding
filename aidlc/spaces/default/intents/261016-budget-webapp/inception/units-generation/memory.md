<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-10-16T09:05:00Z — Unit 数は承認回数と作業量に直結するため、結びつきの強い4部品（調整役と3つの持ち主）を1 Unit にまとめた7 Unit とした。並べて進められる組（U1/U2、U5/U6）は残しており、後の D による並列化比較でも使える形になっている。

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
- 2026-10-16T09:05:00Z — 起動時の保存領域の状態を画面へ渡す経路（U7→U3 を直接か、U4 経由か）は Contract Design で決める。直接に決まれば依存一覧に U7→U3 を追加する必要がある。
