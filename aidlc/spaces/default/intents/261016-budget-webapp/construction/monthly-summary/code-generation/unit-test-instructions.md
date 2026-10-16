# 単体テストの手順（monthly-summary）

## テストの道具と設定

- テストランナー: Vitest（`vitest.config.ts` の monthly-summary 用プロジェクト、環境 node）
- 計算のテスト: 配列の入力だけ（保存は使わない）
- 取得のテスト: U4 の `openBook` に U3 の `createMemoryStorage` を渡した Book（failReads・delayMs で失敗と読み込み中を起こす）と、メソッドを差し替えた Book（食い違い・例外の再現）
- 性能のテスト: U3 の `openStorage` に fake-indexeddb の新しい IDBFactory と別の dbName を渡した Book
- カバレッジ: @vitest/coverage-v8（全体と `src/monthly-summary/**` それぞれ行 80% 以上）
- 前提: Node.js 24、`npm ci` 済み。追加の依存はない

## この Unit のテストの実行

この Unit のテストだけを実行する:

```bash
npx vitest run --project monthly-summary
```

最初のテストを書く前の準備確認:

```bash
npx vitest run --project monthly-summary --passWithNoTests
```

この Unit のカバレッジを確かめる:

```bash
npx vitest run --project monthly-summary --coverage --coverage.include='src/monthly-summary/**/*.ts' --coverage.exclude='src/monthly-summary/**/*.test.ts' --coverage.exclude='src/monthly-summary/test-fixtures.ts'
```

性能の測定値を見る:

```bash
npx vitest run --project monthly-summary src/monthly-summary/performance.test.ts --reporter=verbose
```

## 目標

- `src/monthly-summary/**` の行カバレッジ 80% 以上（NFR6.1）
- 部品（compute、getMonthlySummary、index）ごとに 5〜8 件以上と、性能の目安、Lint の確認。全体で約40件
- 各部品で正常系1件以上、異常・境界2件以上（construction.md Testing Standards）
- 必須のテスト観点: 入力エラー（不正な月）、空データ（収支のない月、予算なしのカテゴリ）、読み込み中（delayMs の間は未完了）、保存失敗に当たる読み込みの失敗（failReads と3つの読み取りそれぞれの失敗）。キーボード操作は画面のない U5 には該当しない

## テストを書く順序

U5 は「その他のレイヤー」なので、各部品を実装した後にその部品のテストを書いて実行する（Testing Contract）。

## 差し替え・偽物

- 食い違い: listCategories・getEffectiveBudgets・listTransactions を差し替えた Book で、一覧にないカテゴリや種別の違う収支を返す。
- 例外: 呼ぶと例外を投げるメソッドを持つ Book。
- 偽のタイマーは使わない。

## テストデータ

- 収支・カテゴリ・予算はすべて架空（例: 「架空の食費」「架空の給与」、金額は整数の円）。実在の固有名詞・口座情報を使わない。
- 性能の目安には、決まった規則で作った架空のデータ（収支 5,000 件を12か月に均等、カテゴリ 30 件（支出 24・収入 6）、予算 360 件（支出 24 件 × 15 か月））を使う（乱数を使わず再現できるようにする）。
