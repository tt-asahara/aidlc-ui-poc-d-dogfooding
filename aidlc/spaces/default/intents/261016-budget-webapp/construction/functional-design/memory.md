<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-10-16T09:30:00Z [unit data-contract] — 数式対策の往復（R-01 由来）を、書き出し・読み込みとも「先頭が ' でその後ろが = + - @ ' で始まる」場合に ' を1つ付け外しする対称な規則（BR4.5・BR4.6）として定めた。'abc・'=1・''=1 がすべて往復で一致することを境界値表に入れた。
- 2026-10-16T09:30:00Z [unit data-contract] — 日付範囲（Q2）の追加に伴い、検証エラーの種類に out-of-range-date を加えた。契約の変更ルールに従い、コード生成で契約文書とテストを同時に更新する。

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-10-16T10:05:00Z [unit ui-kit] — エンジンが依存関係の順で ui-kit を2番目に選んだため、Bolt 計画（storage が2番目）と実際の順序が異なった。依存関係は守られているため成果物への影響はなく、比較記録に実際の順序を残す。
- 2026-10-16T10:05:00Z [unit ui-kit] — U2 は業務データを持たないため、entities.md には部品の設定（props）と内部状態を書いた。契約 C6 に DOM 参照の公開と onClose の理由を追加する差分を明記した。

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-10-16T10:50:00Z [unit storage] — 別タブの版上げ（Q1）に備えて StorageError に newer-version を加えた。列挙の追加は契約上の破壊的変更だが、利用者の U4 がまだないため影響はなく、コード生成で C2 を同時に更新する。
- 2026-10-16T10:50:00Z [unit storage] — 本物の IndexedDB とテスト用の差し替えを同じ契約テストで確かめる方針（BR5.2）にした。U4・U7 のテストが差し替えに頼るため、差し替えのずれを防ぐ。
- 2026-10-16T11:55:00Z [unit bookkeeping-core] — 操作の結果に newer-version を加えた（Q1 = A）。C3 の列挙の追加だが、利用者の U5〜U7 がまだないため影響はない。初期カテゴリの二重作成は、IndexedDB が同じ保存領域の書き込み処理を1つずつ順に実行することに頼り、処理の中で件数を数え直す形で防ぐ（別の仕組みは足さない）。
- 2026-10-16T12:35:00Z [unit csv-exchange] — AC7.1.1 の例文「金額が数値ではありません」は表示の形の例と解釈し、理由は U1 の承認済みの文言を使うことにした（画面入力と CSV で同じ検証関数・同じ文言、FR1.4）。カテゴリ名の照合は重複判定と同じ比べ方（Q1 = A）。

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
