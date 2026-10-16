# 単体テストの手順（data-contract）

## テストの道具と設定

- テストランナー: Vitest（`vitest.config.ts`、環境 node）
- カバレッジ: @vitest/coverage-v8（行カバレッジのしきい値 80%）
- 前提: Node.js 24（`.nvmrc`）、`npm ci` 済み

## この Unit のテストの実行

この Unit のテストだけを実行する（プロジェクト全体ではない）:

```bash
npx vitest run src/data-contract
```

最初のテストを書く前の準備確認（テストファイルがまだないとき）:

```bash
npx vitest run src/data-contract --passWithNoTests
```

この Unit のカバレッジを確かめる:

```bash
npx vitest run src/data-contract --coverage --coverage.include='src/data-contract/**/*.ts' --coverage.exclude='src/data-contract/**/*.test.ts'
```

## 目標

- 行カバレッジ 80% 以上（NFR6.1）
- 部品（values、category、budget、csv、formula、index、lint-config）ごとに 5〜8 件程度、全体で約45件
- 各規則につき正常系1件以上、異常・境界2件以上（construction.md Testing Standards）
- 時間測定（csv.perf.test.ts）: 5,000 レコードの復号が 1,000ms 以内で合格。300ms を超えたら警告を出す（NFR3.1）

## テストを書く順序

この Unit はテストを先に書き、失敗を確かめてから実装する（Testing Contract）。各組で「テストを書く → `npx vitest run src/data-contract` で失敗を確かめる → 実装する → 通ることを確かめる」の順に進める。

## 差し替え・偽物

- U1 は純粋な関数だけなので、差し替えは使わない。
- 時計・乱数・ネットワーク・保存領域に依存しないため、それらの偽物も不要。

## テストデータ

- すべて架空の値を使う（例: 「架空のランチ」「架空の定期代」）。実在の固有名詞・口座・取引に由来する値を使わない（NFR8.5）。
- 大きな CSV（5,000 レコード、1行 1MB）はテストの中で生成し、ファイルとして保存しない。
- テストデータの生成関数は `src/data-contract/test-fixtures.ts` にまとめる（テスト専用。公開窓口からは公開しない）。
