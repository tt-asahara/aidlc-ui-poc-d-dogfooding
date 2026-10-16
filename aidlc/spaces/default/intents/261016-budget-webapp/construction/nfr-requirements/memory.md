<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-10-16T09:33:00Z [unit data-contract] — CSV の符号化・復号はライブラリを使わず自前で書くことにした。数式対策の往復と「レコード開始行の番号」という独自規則を正確に満たすためで、代わりに境界値テストを厚くする。
- 2026-10-16T09:33:00Z [unit data-contract] — 最初の Unit なのでプロジェクト共通の開発道具（Vitest、ESLint、Prettier、npm）をここで決めた。後の Unit は追加分だけをその Unit で決める。
- 2026-10-16T11:05:00Z [unit storage] — 本物の保存の実装は fake-indexeddb でテストし（Q1 = A）、実ブラウザでの IndexedDB の確認は U7 の Build and Test に回す。fake-indexeddb と実ブラウザの細かな差（自動確定の時機、容量超過の起き方）は残るリスクとして扱う。

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
- 2026-10-16T10:12:00Z [unit ui-kit] — jsdom では標準 dialog のモーダル表示とコントラストの実測ができないため、テストは補いとトークン値の計算で代える。実ブラウザでの確認は U7 の画面確認（Build and Test）で行う必要がある。
