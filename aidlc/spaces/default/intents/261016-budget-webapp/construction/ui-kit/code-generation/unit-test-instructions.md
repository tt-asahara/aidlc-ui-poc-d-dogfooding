# 単体テストの手順（ui-kit）

## テストの道具と設定

- テストランナー: Vitest（`vitest.config.ts` の U2 用プロジェクト、環境 jsdom、準備ファイル `src/ui-kit/test-setup.ts`）
- 描画と操作: @testing-library/react、@testing-library/user-event、@testing-library/jest-dom
- 自動のアクセシビリティ検査: axe-core（`wcag2a`、`wcag2aa`、`wcag21a`、`wcag21aa`。jsdom では `color-contrast` を除く）
- カバレッジ: @vitest/coverage-v8（全体と `src/ui-kit/**` それぞれ行 80% 以上）
- 前提: Node.js 24、`npm ci` 済み

## この Unit のテストの実行

この Unit のテストだけを実行する:

```bash
npx vitest run src/ui-kit
```

最初のテストを書く前の準備確認:

```bash
npx vitest run src/ui-kit --passWithNoTests
```

この Unit のカバレッジを確かめる:

```bash
npx vitest run src/ui-kit --coverage --coverage.include='src/ui-kit/**/*.{ts,tsx}' --coverage.exclude='src/ui-kit/**/*.test.{ts,tsx}' --coverage.exclude='src/ui-kit/test-setup.ts'
```

## 目標

- `src/ui-kit/**` の行カバレッジ 80% 以上（NFR6.1）
- 部品（Button、fields、DataTable、Dialog、Tabs、FileInput、StatusPanel、InlineMessage）ごとに 5〜8 件程度と、横断のテスト（index、no-external、tokens）。全体で約50件
- 各部品で正常系1件以上、異常・境界2件以上（construction.md Testing Standards）
- 各部品の代表的な状態で axe 違反0件（NFR2.1）

## テストを書く順序

U2 は画面の層なので、各部品を実装した後にその部品のテストを書いて実行する（Testing Contract）。

## 差し替え・偽物

- 時間: StatusPanel・InlineMessage のテストは Vitest の偽のタイマーで時間を進める。
- 標準 dialog: jsdom の未対応部分（`showModal`・`close`）だけを `test-setup.ts` で補う。Esc はテストで `cancel` イベントを送って再現する。補いで通ることは実ブラウザでの証明ではないため、実ブラウザ確認（B1〜B5）は U7 の Build and Test で行う。
- ネットワーク・保存領域: U2 は使わないため偽物は不要。

## テストデータ

- 部品に渡す文言はすべて架空（例: 「架空の食費」「架空のランチ」）。実在の固有名詞を使わない。
- 安全な表示の確認には `<script>alert(1)</script>` のような文字列を使う（実行されないことを確かめる）。
