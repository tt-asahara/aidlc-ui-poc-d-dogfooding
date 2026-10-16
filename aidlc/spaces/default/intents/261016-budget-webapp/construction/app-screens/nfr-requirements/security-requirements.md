# 安全性と信頼性の要件（app-screens）

- 出典: `inception/requirements-analysis/requirements.md`（NFR1、NFR2、NFR3、NFR4、NFR5、NFR7、NFR8、NFR9、FR8.4、US1.3、US9.x）、`construction/app-screens/functional-design/rules.md`（BR1.1〜BR10.1）、`inception/contract-design/contract-summary.md`（C1〜C6）、`aidlc/spaces/default/memory/project.md`（Forbidden・Mandated）、`construction/ui-kit/nfr-design/security-design.md`（B1〜B5）、各 Unit の code-summary.md の引き継ぎ
- U7 は利用者が直接使う画面。外部への送信がなく、表示する値は利用者の入力と CSV 由来なので、エスケープとフォーカスの扱いが中心になる。

## 1. 要件

| ID | 要件 | 確かめ方 | 出典 |
|----|------|----------|------|
| NFR1.1 | アプリはアプリ自身の配信元以外へ一切通信しない（解析・フォント・CDN を含む）。利用者操作のシナリオ全体で外部への要求が0件 | 画面操作テストで fetch・XMLHttpRequest・WebSocket・EventSource・navigator.sendBeacon をすべて検出して0件を確かめる。ビルド成果物に外部 URL がないことを確かめる（U2 と同じ方式）。ESLint で `src/app/` に通信・保存先の直接参照を禁止 | NFR1、US1.3、project.md |
| NFR2.1 | 画面の操作はキーボードだけで行える。フォーカス順序と可視性を保つ | 主な操作（登録、一覧の編集・削除、予算、カテゴリ、CSV）をキーボードだけで行うテスト。実ブラウザで Tab 順を確認 | NFR2、US9.1 |
| NFR2.2 | 自動のアクセシビリティ検査で違反0件（画面ごとに、主な状態で） | axe-core による検査（U2 と同じ規則）。実ブラウザでの B1〜B5 | NFR2、U2 |
| NFR4.1 | 保存操作は U4 の1回の書き込みに任せ、画面は保存中に同じ操作を受け付けない | 二重押しのテスト（BR2.2）、保存失敗の表示で入力が残るテスト | NFR4、AC2.1.4、BR8.3 |
| NFR5.1 | 画面に出す金額は U4・U5 の整数をそのまま使い、表示だけ3桁区切りにする。小数の計算をしない | 表示の文字列のテスト（1,200、−200） | NFR5 |
| NFR8.1 | 利用者の入力と CSV 由来の値は、文字列としてだけ描画する。HTML を組み立てず、dangerouslySetInnerHTML・innerHTML 等を使わない（U2 の Lint と同じ禁止） | `<script>` を含む値の表示テストと、ESLint の禁止 | NFR8、AC2.3.3 |
| NFR8.2 | 書き出しは U6 の結果を変えずに保存する（数式対策は U1 の責務） | 書き出したファイルの内容が U6 の結果と同一であることのテスト | NFR8、FR6.3、BR6.2 |
| NFR9.1 | 画面はブラウザの一時的な URL（Blob）を作って保存に使い、すぐに解放する（残った URL を作らない） | テストで URL の作成と解放の対応を確かめる | NFR1、BR6.1 |

## 2. 脅威と対策

| 脅威 | 対策 | 関連 |
|------|------|------|
| CSV・メモ・カテゴリ名による画面の乗っ取り | 文字列としてだけ描画し、HTML を組み立てない（NFR8.1） | NFR8 |
| 外部への意図しない送信（解析、CDN、フォント） | 外部の参照を入れない。通信の検出テスト（NFR1.1） | NFR1 |
| 古い版のアプリでの上書き | newer-version で S0-b に切り替え、以後の操作を止める（BR1.6） | US1.2 |
| 操作の取りこぼしや二重送信による重複 | 保存中の無効化（BR2.2）と、保存は U4 の1回の処理（NFR4.1） | NFR4 |

## 3. Functional Design のレビューの扱い

| 指摘（Minor） | この段階での扱い |
|---------------|------------------|
| BR7.1 の文言（message の扱い） | 修正済み（rules.md）。再レビューは行っていない |
| 取り込みの確定時の validation、parseImportFile の storage | 修正済み（BR7.1、BR7.4） |
| D2 の確定時の失敗、not-found と category-type-mismatch の文言 | 修正済み（BR3.4、BR3.5） |
| 編集での月の移動 | 修正済み（BR2.4：共有の対象月は移さない） |
| 古い読み取りの競合、タブ切り替え時の入力 | 修正済み（BR1.4） |
| BR1.1 の項目名の説明 | 修正済み（U2 の FieldError に任せる） |
