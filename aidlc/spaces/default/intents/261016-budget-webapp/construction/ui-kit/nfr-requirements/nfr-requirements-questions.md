# NFR Requirements（ui-kit）— 質問

画面部品（U2）は React で作る最初の Unit です。部品のテストの仕方を決める必要があるため、1問にしました。共通の道具（TypeScript、Vitest、ESLint、Prettier、npm）は U1 で決定済みです。

## Q1. 画面部品のテスト環境

キーボード操作・フォーカスの移り方・読み上げ用の属性と、自動のアクセシビリティ検査（違反0件、NFR2）を部品ごとに確かめます。すべて無償の公開パッケージです。

A. React 19 ＋ React Testing Library ＋ user-event（キーボード操作の再現）＋ jsdom（ブラウザの代わりの軽い環境）＋ axe-core（自動のアクセシビリティ検査）。jsdom が対応していない標準 dialog のモーダル表示などは、テスト用に最小限の補い（ポリフィル）を入れる（おすすめ：追加のブラウザの取得が不要で、検証コマンドが速いため）
B. A と同じだが、jsdom の代わりに happy-dom を使う
C. Vitest のブラウザ実行（Playwright で実際の Chromium を動かす）。Chromium の取得（約150MB）が必要で、検証コマンドが遅くなるが、標準 dialog などを実物で確かめられる
X. Other (please specify)

[Answer]: A
