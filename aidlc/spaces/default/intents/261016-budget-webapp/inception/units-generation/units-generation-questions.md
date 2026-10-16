# Units Generation — 質問

Domain Design で決めた10部品（components.md）を、Construction で設計・実装・テストする単位（Unit）にまとめます。Unit ごとに Construction の工程（機能設計、非機能要件、非機能設計、基盤設計、コード生成）を順に行い、それぞれ承認をいただくため、Unit の数はそのまま作業量と承認回数に影響します。ここで決めるのは Unit の分け方と依存関係（どれがどれに依存するか）だけで、どれから作るかは Delivery Planning で決めます。

部品同士は同じアプリの中の TypeScript の関数呼び出しでつながる（ネットワークやイベントは使わない）ため、Unit 間のつながりは型と関数の約束（次の Contract Design で決める）だけです。

## Q1. Unit の粒度

A. 7 Unit にまとめる（おすすめ）
   - U1 共通データ契約（DataContract）
   - U2 画面部品（UiKit）
   - U3 保存（Storage）
   - U4 家計簿の中核（Ledger・CategoryCatalog・BudgetPlanner・BookkeepingService）
   - U5 月次集計（MonthlySummary）
   - U6 CSV 入出力（CsvExchange）
   - U7 画面（AppScreens）
   理由：共通データ契約と画面部品はどこにも依存せず並べて進められる。月次集計と CSV 入出力も中核の完成後に並べて進められる。互いに強く結びつく4部品（ADR-002 の調整役と3つの持ち主）は1 Unit にまとめ、Unit 間の約束を減らす。
B. 部品ごとに 10 Unit にする（独立性は最も高いが、Unit 間の約束と承認の回数が最も多い）
C. 4 Unit にまとめる（U1 共通データ契約、U2 保存＋中核、U3 集計＋CSV、U4 画面部品＋画面。承認の回数は最も少ないが、並べて進められる組み合わせが減る）
X. Other (please specify)

[Answer]: A

## Q2. コードの置き方と配布の形

すべての Unit は最終的に1つの Web アプリとしてローカルでビルド・起動します（team.md Deployment）。

A. 1つのパッケージの中に Unit ごとのフォルダを置き、Unit 間はフォルダの公開窓口（index.ts）だけを通して参照する。ビルド成果物は1つ（おすすめ：設定が単純で、マージ前の一括検証コマンドも1つで済むため）
B. Unit ごとに別パッケージ（ワークスペース）に分け、パッケージ間の依存として管理する
X. Other (please specify)

[Answer]: A

## Q3. Unit の種類の確認

Unit の種類によって、Construction で作る設計書の範囲が変わります（例：spec は性能設計を持たない）。Q1 で A を選んだ場合の案は次のとおりです。

- U1 共通データ契約：spec（ほかの Unit がそのまま使う型と規則の約束）
- U2 画面部品：library（単独では動かない再利用部品）
- U3 保存：library
- U4 家計簿の中核：library
- U5 月次集計：library
- U6 CSV 入出力：library
- U7 画面：ui（利用者が操作する画面）

A. この案でよい（おすすめ）
B. 変えたい（内容を記入してください）
X. Other (please specify)

[Answer]: A
