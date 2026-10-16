<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

- 2026-10-16T07:51:33Z — 「初回は公式の直列実行」は恒久ルールではなく今回だけの進め方として扱った。discovered-rules.md に入れると project.md に昇格して以後の比較実行（D の並列化・Clef）まで縛ってしまうため、Way of Working の今回の運用として記載する。

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-10-16T07:51:33Z — org.md の既定（main をトランク、ステージングへ自動デプロイ）から外れた。リポジトリに main がなく比較用の起点を揃えるため setup/aidlc-d に集約し、運用フェーズ対象外かつ外部送信なしの条件からデプロイはローカル起動のみとした。

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-10-16T07:51:33Z — CI 構築ステージが計画外のため、classic の「マージ前 CI 実行」をローカル一括検証コマンド（lint・型・テスト・カバレッジ）で満たす方針にした。GitHub Actions 案は外部サービス依存になるため採らなかった。

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
