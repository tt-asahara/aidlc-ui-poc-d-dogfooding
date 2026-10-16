# 単体テストの手順（csv-exchange）

## テストの道具と設定

- テストランナー: Vitest（`vitest.config.ts` の csv-exchange 用プロジェクト、環境 node）
- Book: U4 の `openBook` に U3 の `createMemoryStorage` を渡して作る（failWrites・failReads・delayMs で失敗と読み込み中を起こす）。日時と id は固定の now・newId を渡す
- File・Blob・TextDecoder: Node.js 24 の組み込み
- カバレッジ: @vitest/coverage-v8（全体と `src/csv-exchange/**` それぞれ行 80% 以上）
- 前提: Node.js 24、`npm ci` 済み。追加の依存はない

## この Unit のテストの実行

この Unit のテストだけを実行する:

```bash
npx vitest run --project csv-exchange
```

最初のテストを書く前の準備確認:

```bash
npx vitest run --project csv-exchange --passWithNoTests
```

この Unit のカバレッジを確かめる:

```bash
npx vitest run --project csv-exchange --coverage --coverage.include='src/csv-exchange/**/*.ts' --coverage.exclude='src/csv-exchange/**/*.test.ts' --coverage.exclude='src/csv-exchange/test-fixtures.ts'
```

性能の測定値を見る:

```bash
npx vitest run --project csv-exchange src/csv-exchange/performance.test.ts --reporter=verbose
```

## 目標

- `src/csv-exchange/**` の行カバレッジ 80% 以上（NFR6.1）
- 部品（fileReader、categoryMatcher、export、preview、commit、index）ごとに 5〜8 件程度と、性能の目安、Lint の確認。全体で約60件
- 各部品で正常系1件以上、異常・境界2件以上（construction.md Testing Standards）
- 必須のテスト観点: 入力エラー（不正な行、ファイル全体の6つの理由）、空データ（0件の書き出し、空・見出しのみのファイル、取り込める行0件、確定0件）、読み込み中（delayMs の間はプレビューが未完了）、保存失敗（確定の failWrites、プレビュー後のカテゴリの削除）。キーボード操作は画面のない U6 には該当しない（ファイル選択は U7）

## テストを書く順序

U6 は「CSV 変換のレイヤー」なので、各部品のテストを先に書いて実行し、失敗することを確かめてから実装する（Testing Contract）。失敗の確認には、実装のファイルがまだないことによる読み込みの失敗も含む。

## 差し替え・偽物

- ファイル: `new File([文字列またはバイト列], "架空の家計簿.csv")`。大きさの境界は中身の長さで作る。UTF-8 として正しくないバイト列は `new Uint8Array([0xff, 0xfe, ...])` で作る。arrayBuffer の失敗は、arrayBuffer が reject する File を test-fixtures.ts で作る。
- 別のタブでのカテゴリの削除: 同じ Book でプレビューを作った後に deleteCategory（収支から使われていないカテゴリ）を呼んでから確定する。
- 例外を投げる Book: 呼ぶと例外を投げる関数を持つ差し替えを test-fixtures.ts で作る。
- 偽のタイマーは使わない。

## テストデータ

- 収支・カテゴリはすべて架空（例: 「架空の食費」「架空のランチ」、金額は整数の円）。実在の固有名詞・口座情報を使わない。
- 性能の目安には、決まった規則で作った架空のデータ（収支 5,000 件を12か月に均等、カテゴリ 30 件（支出 24・収入 6））を使う（乱数を使わず再現できるようにする）。
