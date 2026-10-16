# 安全性と信頼性の要件（bookkeeping-core）

- 出典: `inception/requirements-analysis/requirements.md`（NFR1、NFR4、NFR5、NFR8、FR8.3）、`construction/bookkeeping-core/functional-design/rules.md`（BR1.1〜BR6.4）、`inception/contract-design/contract-summary.md`（C2、C3）、`aidlc/spaces/default/memory/project.md`、Functional Design のレビュー（Minor 4件）
- U4 は家計簿のデータの持ち主で、すべての書き込みの入り口。認証・認可は対象外（単一利用者）。保存は U3 の窓口だけを使い、通信はしない。

## 1. 要件

| ID | 要件 | 確かめ方 | 出典 |
|----|------|----------|------|
| NFR1.1 | U4 はネットワークに一切アクセスせず、IndexedDB・localStorage・sessionStorage・Cookie を直接使わない（保存は U3 の窓口だけ） | ESLint で `src/bookkeeping-core/` の非テストファイルに fetch、XMLHttpRequest、WebSocket、EventSource、navigator.sendBeacon、indexedDB、localStorage、sessionStorage、document.cookie、eval、new Function を禁止する | NFR1、ADR-004 |
| NFR4.1 | 書き込み操作はすべて U3 の write の1回の処理で行い、規則違反・検証エラー・保存失敗のどれでも保存領域は変わらない | 各書き込み操作について、失敗の後に保存領域の中身が操作の前と同じであることのテスト | NFR4、BR6.2、AC8.3.2 |
| NFR4.2 | 部品をまたぐ規則（カテゴリの存在・種別・使用件数・最後の1件）は書き込み処理の中で読み直して判定する | 2つの Book を同じ保存領域で開き、片方の変更の後にもう片方の操作が規則違反になるテスト（本物の保存で行う） | AC3.4.4、BR6.3 |
| NFR4.3 | Book の操作は例外を投げず、失敗の種類（validation・rule・storage・newer-version）を区別して返す | 保存失敗の注入と、版上げを起こすテスト | FR8.3、BR6.1、BR6.2、Q1 |
| NFR4.4 | 書き込み処理の中では TxContext の操作だけを待つ（U3 の制約） | コードの確認と、全書き込み操作が実際の保存（fake-indexeddb）で成功するテスト | C2、BR6.4 |
| NFR5.1 | 金額は整数の円だけを扱い、予算の引き継ぎの計算で小数・丸めを使わない | 予算の計算のテストで、結果が保存した整数そのものであること | NFR5 |
| NFR8.1 | 利用者の入力（カテゴリ名・メモ）は U1 の検証を通した値だけを保存し、U4 は値を評価・組み立てしない | コードの確認（eval・new Function の禁止は NFR1.1 の Lint） | NFR8 |
| NFR8.2 | テストデータはすべて架空 | テストデータの目視確認 | project.md |
| NFR8.3 | U4 が作る検証エラーの文言（対象月・種別）は固定の日本語で、入力値を埋め込まない | 文言の定数を確かめるテスト | C1（ValidationError.message） |

## 2. 脅威と対策

| 脅威 | 対策 | 関連 |
|------|------|------|
| 別のタブでの削除や変更による、存在しないカテゴリへの参照 | 書き込み処理の中での読み直し（NFR4.2） | AC3.4.4 |
| 途中の失敗による半端なデータ | U3 の1回の書き込み処理（NFR4.1） | NFR4 |
| 古い版の画面での操作の継続 | newer-version を区別して返し、U7 が画面を切り替える（NFR4.3） | Q1 |
| 外部への意図しない送信 | 通信と保存先の直接の参照の禁止（NFR1.1） | NFR1 |

## 3. Functional Design のレビューの扱い

| 指摘（Minor） | この段階での扱い |
|---------------|------------------|
| 削除確認で予算の有無が分からない（AC3.4.2） | NFR Design で決める（C3 に読み取りを足すか、常に注意書きを出すか） |
| BR1.2 の件数の数え方 | 実装の注意として NFR Design に書く（`getAll("categories")` の長さ） |
| 対象月・種別のエラー文言の出どころ | NFR8.3 として要件化し、NFR Design で定数を決める |
| 取り込みの検証エラーで行番号が伝わらない | NFR Design で決める（U6 が検証済みの行だけを渡す前提の明記） |
