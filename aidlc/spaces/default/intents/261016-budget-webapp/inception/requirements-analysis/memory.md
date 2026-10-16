<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-10-16T08:08:09Z — 「共通データ契約を先に定める」を独立した機能要件 FR1 として切り出した。Units Generation で契約を最初の Unit にしやすくするためで、エンティティ・検証関数・CSV 形式・保存スキーマ版を FR1.1〜FR1.6 に集約した。
- 2026-10-16T08:08:09Z — 「外部送信なし」を NFR1 として、外部ネットワーク要求0件を自動テストで確認できる形にした。禁止ルールを検証可能な要件に落とすため。

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-10-16T08:08:09Z — 金額上限・文字数・CSV サイズ上限・性能目標は質問せず想定値（A4、NFR3）として置いた。利用者の世界の事実ではなく妥当な既定で決められる隅のケースであり、質問数を Standard の範囲に収めるため。承認時に修正可能。

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
