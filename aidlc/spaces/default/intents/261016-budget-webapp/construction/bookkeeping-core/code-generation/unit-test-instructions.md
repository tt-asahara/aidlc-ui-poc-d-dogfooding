# 単体テストの手順（bookkeeping-core）

## テストの道具と設定

- テストランナー: Vitest（`vitest.config.ts` の bookkeeping-core 用プロジェクト、環境 node）
- 保存の差し替え: U3 の `createMemoryStorage`（主なテスト。failOpen・failReads・failWrites・delayMs で失敗と読み込み中を起こす）
- 本物の保存: U3 の `openStorage` に fake-indexeddb の IDBFactory を渡す（別のタブ・版上げ・性能のテスト。テストごとに新しい IDBFactory と別の dbName を作り、テスト間でデータを共有しない）
- カバレッジ: @vitest/coverage-v8（全体と `src/bookkeeping-core/**` それぞれ行 80% 以上）
- 前提: Node.js 24、`npm ci` 済み。追加の依存はない

## この Unit のテストの実行

この Unit のテストだけを実行する:

```bash
npx vitest run --project bookkeeping-core
```

最初のテストを書く前の準備確認:

```bash
npx vitest run --project bookkeeping-core --passWithNoTests
```

この Unit のカバレッジを確かめる:

```bash
npx vitest run --project bookkeeping-core --coverage --coverage.include='src/bookkeeping-core/**/*.ts' --coverage.exclude='src/bookkeeping-core/**/*.test.ts' --coverage.exclude='src/bookkeeping-core/test-fixtures.ts'
```

性能の測定値を見る（合格したテストの出力は通常の実行では隠れることがある）:

```bash
npx vitest run --project bookkeeping-core src/bookkeeping-core/performance.test.ts --reporter=verbose
```

## 目標

- `src/bookkeeping-core/**` の行カバレッジ 80% 以上（NFR6.1）
- 部品（categoryCatalog、ledger、budgetPlanner、errors、ids、messages）ごとに 5〜8 件程度と、Book の結合テスト（差し替えと fake-indexeddb）、性能の目安、Lint の確認。全体で約70件
- 各操作で正常系1件以上、異常・境界2件以上（construction.md Testing Standards）
- 必須のテスト観点: 入力エラー（各書き込みの検証エラー、不正な月・種別）、空データ（収支のない月、予算なし、初回のカテゴリ）、読み込み中（delayMs の間は未完了）、保存失敗（failWrites・failReads と、失敗の後に保存領域が変わらないこと）。キーボード操作は画面のない U4 には該当しない

## テストを書く順序

U4 は「その他のレイヤー」なので、各部品を実装した後にその部品のテストを書いて実行する（Testing Contract）。

## 差し替え・偽物

- 日時と id: openBook の `now` と `newId` に固定の関数を渡し、結果を比べられるようにする。
- 別のタブ: 1つのテストの中で IDBFactory と dbName を1組だけ作り、`() => openStorage({ indexedDB: factory, dbName })` を2つの openBook の storage 引数に渡す。
- 版上げ: 同じ組で、版を上げた接続を別に開いて（versionchange を起こして）から、元の Book の操作を呼ぶ。
- 偽のタイマーは使わない（U3 の差し替えの自動確定の再現が実際のタイマーに依存するため）。

## テストデータ

- 収支・カテゴリ・予算はすべて架空（例: 「架空の食費」「架空のランチ」、金額は整数の円）。実在の固有名詞・口座情報を使わない。
- 性能の目安には、決まった規則で作った架空のデータ（収支 5,000 件を12か月に均等、カテゴリ 30 件（支出 24・収入 6）、予算 360 件（支出 24 件 × 15 か月））を使う（乱数を使わず再現できるようにする）。
