<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-10-16T09:36:00Z [unit data-contract] — 数式対策の対象にタブ・CR を加えなかった。保存される値は前後の空白除去後で、タブ・CR で始まる値が存在し得ないため。上流の規則（BR4.5）を変えずに、NFR レビューの指摘に理由で答えた。
- 2026-10-16T09:36:00Z [unit data-contract] — 新たな判断が要らなかったため、質問は0件とし、質問ファイルにその理由を残した（Construction では質問は例外的なもの、という方針）。

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-10-16T10:18:00Z [unit ui-kit] — 標準 dialog の cancel では既定動作を必ず止め、開閉を open の値だけで決める設計にした。FD レビューの「open が真のまま dialog だけ閉じる」食い違いを防ぐため。jsdom の補いで通るテストは実ブラウザの証明にならないので、確認項目 B1〜B5 を U7 の Build and Test に送った。
- 2026-10-16T11:10:00Z [unit storage] — put・delete を溜めて work の成功後にまとめて保存する方式にした（Q1 = A）。自動確定で一部だけ保存されることを仕組みで防げる代わりに、読み取りへの重ね方の実装とテストが増え、C2 の write の説明と openStorage の引数を更新する。
- 2026-10-16T12:20:00Z [unit bookkeeping-core] — 削除確認のため getCategoryUsage を収支と予算の件数を返す形に広げた（Q1 = A）。C3 の戻り値の型の変更だが利用者の Unit はまだない。性能の目安は NFR3 と同じ件数（カテゴリ30・予算360）にそろえ、fake-indexeddb の値は目安、本物のブラウザの確認は U7 に回した。
- 2026-10-16T13:00:00Z [unit csv-exchange] — FD の BR3.3 の最後の文（検証に失敗した行でも照合する）を NFR Design で置き換えた（Q1 = A：検証をすべて通った行だけ照合）。U1 の窓口を変えないためで、FD の文書は書き換えず、置き換えを security-design.md 第1章に明記した。理由の文言は U1 のもの（Q2 = A）。

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
