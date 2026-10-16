# 技術の選定（monthly-summary）

- 出典: `construction/data-contract/nfr-requirements/tech-stack-decisions.md`（共通の道具）、`construction/monthly-summary/functional-design/`、`inception/requirements-analysis/requirements.md`（NFR3、NFR5、NFR6、NFR9）、`nfr-requirements-questions.md`（質問0件）
- 共通の道具（TypeScript strict、Vitest、ESLint、Prettier、Node.js 24、npm、正確なバージョンでの固定）と fake-indexeddb は決定済み。U5 で追加する依存はない。

## 1. 選定

| 分類 | 選定 | 理由 | 採らなかった案 |
|------|------|------|----------------|
| 計算 | 依存のない純粋な関数（computeMonthlySummary） | ADR-003。単独でテストでき、保存や時計に依存しない | — |
| テスト環境 | node（U1・U3・U4・U6 と同じ）。getMonthlySummary は U4 の openBook に U3 の差し替え、性能は fake-indexeddb の本物の保存も使う | 画面を持たない。NFR3 は本物の保存の読み取りを含めて測る | jsdom |

## 2. 非機能の目標（このUnit分）

| ID | 目標 | 確かめ方 | 出典 |
|----|------|----------|------|
| NFR3.1 | 要件 NFR3 の件数（収支 5,000 件を12か月に均等、カテゴリ 30 件、予算 360 件）で、getMonthlySummary 全体（U4 の読み取り3回を含む）が fake-indexeddb 上で 250ms 以内。表示の切り替え 500ms のうち、残りを U7 の表示に残す | 空回し1回の後に5回測った中央値（測定値と実行環境を記録） | NFR3、FD レビュー Minor |
| NFR3.2 | 同じ件数で、computeMonthlySummary 単独が 20ms 以内 | 同上 | NFR3 |
| NFR6.1 | `src/monthly-summary/**` の行カバレッジ 80% 以上（vitest.config.ts に monthly-summary 用のプロジェクト（node）とディレクトリ単位のしきい値を足す）。各関数で正常系と2つ以上の異常・境界の例 | 検証コマンドのカバレッジ結果 | NFR6、construction.md |
| NFR6.2 | U5 は「その他のレイヤー」なので、実装の後にテストを書く | コード生成の計画の手順の順序 | team.md |
| NFR6.3 | 必須のテスト観点のうち、空データ（収支のない月、予算なしのカテゴリ）、読み込み中（差し替えの delayMs の間は結果が未完了）、保存失敗に当たる読み込みの失敗（failReads）を含める。入力エラーは不正な月（U4 の validation をそのまま返す）。キーボード操作は画面のない U5 には該当しない | テストの一覧 | team.md Testing Posture |
| NFR9.1 | 追加の依存なし。`npm ci` と `npm run verify` だけで検証できる | クリーンな状態での実行 | NFR9 |

## 3. 対象外の分類

| 分類 | 理由 |
|------|------|
| 拡張性・監視・可用性 | 単一利用者のブラウザ内の計算の部品で、稼働するサービスではない（種類 library） |
