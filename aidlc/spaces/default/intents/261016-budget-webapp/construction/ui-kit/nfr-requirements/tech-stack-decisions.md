# 技術の選定（ui-kit）

- 出典: `inception/requirements-analysis/requirements.md`（C7 React ＋ Vite、NFR2、NFR6、NFR9）、`construction/data-contract/nfr-requirements/tech-stack-decisions.md`（共通の道具）、`nfr-requirements-questions.md`（Q1 = A）
- 共通の道具（TypeScript strict、Vitest、ESLint、Prettier、Node.js 24、npm、正確なバージョンでの固定）は U1 で決定済み。ここでは U2 で追加するものだけを決める。

## 1. 追加する選定

| 分類 | 選定 | 理由 | 採らなかった案 |
|------|------|------|----------------|
| 画面の部品 | React 19 ＋ react-dom 19（実行時の依存） | 要件 C7（React ＋ Vite） | — |
| 型定義 | @types/react、@types/react-dom（開発時） | TypeScript strict での型チェック | — |
| JSX の変換 | TypeScript の `jsx: react-jsx`（tsconfig）。テストでは Vitest の変換を使う | 追加の変換道具を入れない | Babel（不要な依存） |
| テストの描画 | @testing-library/react ＋ @testing-library/user-event ＋ @testing-library/jest-dom（開発時） | キーボード操作とフォーカスを利用者に近い形で確かめる（Q1 = A） | Enzyme（保守されていない） |
| テストの環境 | jsdom（開発時）。`src/ui-kit/` のテストだけ jsdom、U1 のテストは node のまま | ブラウザの取得が不要で速い（Q1 = A） | happy-dom（Q1 で B を選ばず）、実ブラウザ（Q1 で C を選ばず） |
| 標準 dialog の補い | テスト用の最小限の補い（`showModal`・`close`・`open` 属性・`cancel` イベント）をテストの準備ファイルに書く（jsdom が対応していない部分だけ） | jsdom の未対応部分を補う。実行時のコードには入れない | dialog のポリフィルのパッケージ（実行時に不要な依存） |
| 自動のアクセシビリティ検査 | axe-core（開発時）。WCAG 2.1 A・AA のタグで検査 | NFR2 | — |
| React の Lint | eslint-plugin-react-hooks（開発時）。`dangerouslySetInnerHTML` の禁止は ESLint の `no-restricted-syntax` で行う | フックの規則とNFR8.1 | eslint-plugin-react 全体（必要な規則が少ない） |
| CSS | 1つの CSS ファイル（`src/ui-kit/tokens.css` にトークン、`src/ui-kit/ui-kit.css` に部品の見た目）。CSS の道具は入れない | 依存を増やさない（refined-mockups Q4） | CSS-in-JS（実行時の依存が増える） |
| Vite | U7 で導入する（U2 は Vite なしでテストできる） | U2 は単独で動かない部品のため | — |

## 2. 非機能の目標（このUnit分）

| ID | 目標 | 確かめ方 | 出典 |
|----|------|----------|------|
| NFR6.1 | U2 の行カバレッジ 80% 以上。部品ごとに正常系と2つ以上の異常・境界の例 | 検証コマンドのカバレッジ結果 | NFR6、construction.md |
| NFR6.2 | U2 は画面の層なので、実装の後にテストを書く（team.md Testing Posture の Ordering） | コード生成の計画の手順の順序 | NFR6、team.md |
| NFR9.1 | 追加の依存を正確なバージョンで固定し、`npm ci` と `npm run verify` だけで検証できる | クリーンな状態での実行 | NFR9 |
| NFR3.1 | U2 の部品は 5,000 行の表を描画する用途を想定しない（大量行の表示方針は U6・U7 で決める）。部品単体の性能目標は置かない | — | NFR3 |

## 3. 対象外の分類

| 分類 | 理由 |
|------|------|
| 拡張性・信頼性・監視 | U2 は種類 library で、稼働するサービスではない |
| 性能（部品単体） | 部品は軽い表示のみ。画面全体の応答は U7 で扱う |
