<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-10-16T08:55:00Z — 持ち主の部品同士を直接つなぐとカテゴリ↔予算・収支で循環するため、書き込みの調整役 BookkeepingService を置いた（ADR-002）。部品が1つ増える代わりに、依存が一方向になり、別タブ対策の「数えてから消す」を1回の書き込み処理に収められる。
- 2026-10-16T08:55:00Z — モックアップのレビュー指摘（日付入力）を Domain Design の質問 Q4 で決め、ADR-005 に記録した。上流の成果物は直さず、下流の Functional Design で部品仕様を読み替える方針にした（承認済み成果物を書き換えないため）。

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
