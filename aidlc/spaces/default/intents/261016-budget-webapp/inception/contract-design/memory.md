<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-10-16T09:15:00Z — ステージ定義が例示する OpenAPI / AsyncAPI ではなく、TypeScript の型（shared-schema）で約束を書いた。境界がすべて同じパッケージ内の関数呼び出しで、外部公開 API もネットワークもないため。

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-10-16T09:15:00Z — 失敗の種類（kind/code）の列挙への値の追加を破壊的変更として扱うことにした。追加項目は非破壊という一般則より厳しいが、画面が種類ごとに表示を分岐しているため、漏れを型チェックで検出できる方を優先した。

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
