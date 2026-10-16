# 単体テストの手順（app-screens）

## テストの道具と設定

- テストランナー: Vitest（`vitest.config.ts` の app 用プロジェクト、環境 jsdom、準備ファイル `src/ui-kit/test-setup.ts`）
- 描画と操作: @testing-library/react、@testing-library/user-event、@testing-library/jest-dom（U2 と同じ）
- 自動のアクセシビリティ検査: axe-core（U2 と同じ規則。jsdom では color-contrast を除く）
- 保存: U3 の `createMemoryStorage`（主に使う。failWrites、failReads、delayMs で失敗と読み込み中を起こす）。別のタブと版上げの確認だけ U3 の `openStorage` と fake-indexeddb の新しい IDBFactory（テストごとに別の dbName）
- 日時と id: U4 の openBook に固定の now と newId を渡す
- カバレッジ: @vitest/coverage-v8（`src/app/**` 行 80% 以上）
- 前提: Node.js 24、`npm ci` 済み

## この Unit のテストの実行

```bash
npx vitest run --project app
```

準備確認（最初のテストを書く前）:

```bash
npx vitest run --project app --passWithNoTests
```

カバレッジ:

```bash
npx vitest run --project app --coverage --coverage.include='src/app/**/*.{ts,tsx}' --coverage.exclude='src/app/**/*.test.{ts,tsx}' --coverage.exclude='src/app/vite-env.d.ts'
```

配布の検査（Build and Test。`npm run build` の後に実行する）:

```bash
npm run build
node scripts/check-dist.mjs dist
```

## 目標

- `src/app/**` の行カバレッジ 80% 以上（NFR6.1）
- 画面ごとに 5〜8 件程度（起動、枠、収支、集計、予算、カテゴリ、CSV）。各画面に axe の違反0件
- 各部品で正常系1件以上、異常・境界2件以上（construction.md Testing Standards）
- 必須のテスト観点: 入力エラー、空データ、読み込み中、保存失敗、キーボード操作（画面ごと）、ダイアログのフォーカス、外部への通信のない検査

## テストを書く順序

UI の層なので、各部品（画面または部品のまとまり）を実装した後に、その部品のテストを書いて実行する（Testing Contract）。

## 差し替え・偽物

- 保存: createMemoryStorage。失敗は failWrites（保存失敗）、failReads（読み込みの失敗）、delayMs（読み込み中）。
- 食い違い（一覧にないカテゴリ、別のタブで消えたカテゴリ）: U4 の Book を差し替えた操作関数（テスト用の Book）で返す。
- 偽のタイマーは使わない。5秒を超えたときの追記は、待ちの時間を短くした StatusPanel（U2）の設定で確かめる。
- ファイル: `new File([文字列またはバイト列], "架空の家計簿.csv")`。大きさの境界は中身の長さで作る。
- Blob の URL: `URL.createObjectURL` と `URL.revokeObjectURL` をテストで置き換え、呼ばれた回数を確かめる。

## テストデータ

- 収支・カテゴリ・予算・メモ・ファイルの内容はすべて架空（例: 「架空の食費」「架空のランチ」、金額は整数の円）。実在の固有名詞・口座情報を使わない。
- `<script>alert(1)</script>` のような値を、表示の安全の確認に使う（文字として表示されることを確かめる）。
