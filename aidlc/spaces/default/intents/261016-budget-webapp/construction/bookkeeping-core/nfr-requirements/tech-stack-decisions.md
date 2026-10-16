# 技術の選定（bookkeeping-core）

- 出典: `construction/data-contract/nfr-requirements/tech-stack-decisions.md`（共通の道具）、`construction/storage/nfr-requirements/tech-stack-decisions.md`（fake-indexeddb）、`construction/bookkeeping-core/functional-design/`、`inception/requirements-analysis/requirements.md`（NFR3、NFR6、NFR9）、`nfr-requirements-questions.md`（質問0件）
- 共通の道具（TypeScript strict、Vitest、ESLint、Prettier、Node.js 24、npm、正確なバージョンでの固定）と fake-indexeddb は U1・U3 で決定済み。U4 で追加する依存はない。

## 1. 選定

| 分類 | 選定 | 理由 | 採らなかった案 |
|------|------|------|----------------|
| id の生成 | `crypto.randomUUID()`（既定）。openBook の任意の引数 newId で差し込める | 追加の依存なし。localhost とテスト環境（Node.js 24）で使える | 連番（別のタブと衝突する）、ulid などのパッケージ（依存が増える） |
| 日時 | `new Date().toISOString()`（既定）。任意の引数 now で差し込める | テストで日時を固定するため | — |
| テストの保存 | U3 の createMemoryStorage を主に使い、別のタブでの操作と版上げは openStorage（fake-indexeddb）で確かめる | 差し替えは U3 の契約テストで本物と同じ振る舞いを確かめ済み。差し替えにない「実行中の版上げ」だけ本物で確かめる | すべて本物で行う（遅くなり、失敗の注入がしにくい） |
| テスト環境 | node（U1・U3 と同じ） | 画面を持たない | — |
| 偽のタイマー | 使わない | U3 の差し替えの自動確定の再現が実際のタイマーに依存するため（U3 のレビュー Minor） | — |

## 2. 非機能の目標（このUnit分）

| ID | 目標 | 確かめ方 | 出典 |
|----|------|----------|------|
| NFR3.1 | 架空の収支 5,000 件（12か月に均等）と支出カテゴリ7件・予算 84 件があるとき、listTransactions（1か月分）と getEffectiveBudgets の合計が、fake-indexeddb 上で 200ms 以内（画面の切り替え 500ms のうち U4 の取り分の目安。U5 の計算と U7 の表示に残りを残す） | 時間を測るテスト（測定値を記録） | NFR3 |
| NFR6.1 | `src/bookkeeping-core/**` の行カバレッジ 80% 以上（ディレクトリ単位のしきい値）。各操作で正常系と2つ以上の異常・境界の例 | 検証コマンドのカバレッジ結果 | NFR6、construction.md |
| NFR6.2 | U4 は「その他のレイヤー」なので、実装の後にテストを書く | コード生成の計画の手順の順序 | team.md |
| NFR6.3 | team.md の必須のテスト観点のうち、入力エラー（各操作の検証エラー）、空データ（収支のない月、予算のないカテゴリ）、読み込み中（差し替えの delayMs の間は結果が未完了）、保存失敗（failWrites・failReads）を含める。キーボード操作は画面のない U4 には該当しない | テストの一覧 | team.md Testing Posture |
| NFR9.1 | 追加の依存なし。`npm ci` と `npm run verify` だけで検証できる | クリーンな状態での実行 | NFR9 |

## 3. 対象外の分類

| 分類 | 理由 |
|------|------|
| 拡張性・監視・可用性 | 単一利用者のブラウザ内の部品で、稼働するサービスではない（種類 library） |
