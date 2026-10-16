# NFR Requirements（data-contract）— 質問

U1 は最初に作る Unit で、プロジェクト全体の開発道具（テストの道具、型チェック、Lint、整形）もここで決まります。性能・安全性の目標は要件（NFR1〜NFR9）でほぼ決まっているため、決まっていない道具の選定だけを1問にしました。

## Q1. テストと開発の道具

マージ前の一括検証コマンド `npm run verify`（承認済み）で、整形・Lint・型チェック・テスト・行カバレッジ 80% を確かめます。すべて無償の公開パッケージです（Delivery Planning Q3 で取得を許可済み）。

A. TypeScript（strict）＋ Vitest（テストとカバレッジ計測）＋ ESLint（typescript-eslint）＋ Prettier。実行環境は手元の Node.js 24 と npm。文字数の数え方や全角→半角の変換は、ブラウザ・Node.js 標準の機能（Intl.Segmenter、Unicode 正規化）を使い、追加のライブラリを入れない（おすすめ：Vite と同じ仕組みで動き、画面の Unit まで同じ道具でテストできるため）
B. TypeScript（strict）＋ Jest ＋ ESLint ＋ Prettier（Vite とは別の仕組みでテストする）
X. Other (please specify)

[Answer]: A
