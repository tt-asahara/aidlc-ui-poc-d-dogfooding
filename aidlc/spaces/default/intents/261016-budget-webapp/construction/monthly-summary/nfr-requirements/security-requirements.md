# 安全性と信頼性の要件（monthly-summary）

- 出典: `inception/requirements-analysis/requirements.md`（NFR1、NFR5、NFR8、FR5.4、FR8.2）、`construction/monthly-summary/functional-design/rules.md`（BR1.1〜BR4.2）、`inception/contract-design/contract-summary.md`（C3、C4）、`inception/domain-design/decisions.md`（ADR-003）、`aidlc/spaces/default/memory/project.md`、Functional Design のレビュー（Minor 4件）
- U5 は保存も通信もしない計算の部品。U4 から読んだ値だけを入力にする。

## 1. 要件

| ID | 要件 | 確かめ方 | 出典 |
|----|------|----------|------|
| NFR1.1 | U5 はネットワークに一切アクセスせず、保存先（IndexedDB・localStorage・sessionStorage・Cookie）も使わない。computeMonthlySummary は時計・乱数・タイマーにも触れない | ESLint で `src/monthly-summary/` の非テストファイルに、U4・U6 と同じ形の禁止の一覧（通信、保存先、window・globalThis・self 経由、navigator.sendBeacon、document.cookie、eval、new Function）と、U3 と U1・U4 の内部ファイルの import の禁止を書き切る。計算の部品には Date・Math.random・setTimeout・setInterval も禁止する | NFR1、ADR-003 |
| NFR5.1 | 金額の計算は整数の足し算・引き算だけで、小数・丸めを使わない。合計と行の和は必ず一致する | 例の表のテストと、行の和と合計の一致を全件で確かめるテスト | NFR5、FR5.4、BR1.2、BR1.3 |
| NFR5.2 | 合計の最大値（5,000 件 × 99,999,999 円）でも安全な整数の範囲を超えない | 最大の金額の収支 5,000 件で合計が正しいこと（Number.isSafeInteger）のテスト | NFR5 |
| NFR8.1 | 一部が抜けた集計を見せない。収支のカテゴリが一覧にない、または種別が違う場合は、計算の結果を返さずに失敗にする | 食い違う入力を渡した Book でのテスト | FR5.4、BR4.2 |
| NFR8.2 | getMonthlySummary は例外を投げず、U4 の失敗の種類をそのまま返す | 失敗を注入した Book でのテスト | FR8.2、BR4.1、BR4.2 |
| NFR8.3 | テストデータはすべて架空 | テストデータの目視確認 | project.md |

## 2. 脅威と対策

| 脅威 | 対策 | 関連 |
|------|------|------|
| 誤った合計の表示（一部の収支の抜け、小数の誤差） | 整数だけの計算、行の和で合計を求める、食い違いは失敗にする（NFR5.1、NFR8.1） | NFR5、FR5.4 |
| 外部への意図しない送信 | 通信と保存先の参照の禁止（NFR1.1） | NFR1 |

## 3. Functional Design のレビューの扱い

| 指摘（Minor） | この段階での扱い |
|---------------|------------------|
| 合計の定義の揺れ（BR1.2 と BR1.3） | 合計は行の actual の和に一本化する（NFR5.1）。NFR Design で明記する |
| 種別の不一致も category-missing にまとめる理由 | NFR Design で決める（U7 の表示の扱いと合わせて） |
| 3回の読み取りの順と、その間の別タブの書き込み | NFR Design で決める |
| 500ms の割り当て | tech-stack-decisions.md の NFR3.1 で、getMonthlySummary 全体の目安として定める |
