# 技術の選定（app-screens）

- 出典: `construction/ui-kit/nfr-requirements/tech-stack-decisions.md`（React、jsdom、axe-core）、`construction/data-contract/nfr-requirements/tech-stack-decisions.md`（共通の道具）、`inception/requirements-analysis/requirements.md`（Q8 画面技術＝React ＋ Vite、NFR3、NFR6、NFR7、NFR9）、`construction/app-screens/functional-design/`、`nfr-requirements-questions.md`（質問0件）
- 承認済みの範囲（無償の公開パッケージのみ、有償サービス・認証変更・追加購入なし）で、Vite を追加する。その他の依存は既存のもの（React、Testing Library、axe-core、fake-indexeddb）を使う。

## 1. 選定

| 分類 | 選定 | 理由 | 採らなかった案 |
|------|------|------|----------------|
| ビルドと開発サーバー | Vite（正確なバージョンを追加時に固定。ロックファイルに記録） | Q8 の決定（React ＋ Vite）。ローカルでビルドし起動できる（team.md Deployment） | webpack（設定が重い）、Next.js（サーバーが要る） |
| 画面の起動点 | `index.html` と `src/app/main.tsx` | Vite の標準の形 | — |
| テスト環境 | jsdom（U2 と同じ）。保存は U3 の差し替え（createMemoryStorage）で主に行い、一部の確認だけ fake-indexeddb | 画面の操作を確かめる必要がある。保存の本物の振る舞いは U3 で確認済み | node（画面を動かせない） |
| 画面の状態の管理 | React の標準（useState、useReducer、useRef）。外部の状態管理ライブラリは使わない | 依存を増やさない。状態は画面のメモリだけ（entities.md） | Redux、Zustand（依存が増える） |
| スタイル | U2 の tokens.css と ui-kit.css をそのまま使う | 見た目の一貫性（U2 の設計） | Tailwind（依存が増える） |

## 2. 非機能の目標（このUnit分）

| ID | 目標 | 確かめ方 | 出典 |
|----|------|----------|------|
| NFR3.1 | 架空の収支 5,000 件・カテゴリ 30 件・予算 360 件で、月次集計の表示切り替え（getMonthlySummary ＋描画）が 500ms 以内 | 実ブラウザ（Chrome 最新版）で Build and Test に測る。jsdom では測らない | NFR3 |
| NFR3.2 | 架空の CSV 5,000 行の読み込みからプレビュー表示まで 2 秒以内 | 実ブラウザで Build and Test に測る | NFR3 |
| NFR6.1 | `src/app/**` の行カバレッジ 80% 以上（vitest.config.ts に app 用プロジェクト（jsdom）としきい値） | 検証コマンド | NFR6 |
| NFR6.2 | 画面の部品と操作は、実装の後にテストを書く（「その他のレイヤー」） | コード生成の計画の手順 | team.md |
| NFR6.3 | 必須のテスト観点（入力エラー、空データ、読み込み中、保存失敗、キーボード操作）を画面ごとのテストに含める | テストの一覧 | team.md |
| NFR7.1 | Chrome 最新版で全操作と B1〜B5 を確認。Edge・Firefox・Safari は同じ手順で手動確認し、結果を記録 | Build and Test | NFR7 |
| NFR9.1 | クリーンな取得から `npm ci`、`npm run verify`、`npm run dev`（起動）と `npm run build` で完了する。依存のバージョンは固定 | クリーンな環境での実行 | NFR9 |

## 3. ビルドのスクリプト（追加分）

| スクリプト | 内容 |
|------------|------|
| `dev` | Vite の開発サーバーを起動する（ローカルのみ） |
| `build` | `tsc --noEmit` のあとに Vite で `dist/` を作る |
| `preview` | `dist/` をローカルで配信して確かめる |

既存の `verify` は変えない（format・lint・typecheck・test。build は含めず、Build and Test で実行する）。
