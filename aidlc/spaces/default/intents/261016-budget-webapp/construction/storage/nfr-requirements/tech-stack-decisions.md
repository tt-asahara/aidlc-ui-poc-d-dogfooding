# 技術の選定（storage）

- 出典: `construction/data-contract/nfr-requirements/tech-stack-decisions.md`（共通の道具）、`construction/storage/functional-design/`、`inception/domain-design/decisions.md`（ADR-004）、`inception/requirements-analysis/requirements.md`（NFR3、NFR6、NFR9）、`nfr-requirements-questions.md`（Q1 = A）
- 共通の道具（TypeScript strict、Vitest、ESLint、Prettier、Node.js 24、npm、正確なバージョンでの固定）は U1 で決定済み。U3 で追加するものだけを決める。

## 1. 追加する選定

| 分類 | 選定 | 理由 | 採らなかった案 |
|------|------|------|----------------|
| 保存先（実行時） | ブラウザ組み込みの IndexedDB を直接使う（補助ライブラリなし） | 依存を増やさない。窓口は U3 に閉じ込めるため、直接使っても他の Unit に影響しない（ADR-004）。要件 OQ3 の決定 | idb などの補助ライブラリ（便利だが依存が増え、自動確定の扱いを結局自分で守る必要がある） |
| テストでの IndexedDB の代わり | fake-indexeddb（開発時） | 仕様どおりの取り消し・自動確定・版の更新を Node.js 上で再現できる（Q1 = A） | 実ブラウザでのテスト（Q1 で B を選ばず） |
| テスト環境 | node（U1 と同じ）。fake-indexeddb をテストごとに新しく用意して、テスト間でデータを共有しない | jsdom は不要 | — |
| 時計の差し込み | `openStorage` の任意の引数で現在時刻を返す関数を受け取る（既定は実際の時計）。初期化日時をテストで固定するため | テストの再現性 | — |
| データベース名 | 既定 `budget-webapp`、任意の引数で変更可能（テストではテストごとに別名） | テストの分離 | — |

## 2. 非機能の目標（このUnit分）

| ID | 目標 | 確かめ方 | 出典 |
|----|------|----------|------|
| NFR3.1 | 架空の収支 5,000 件を1回の書き込み処理で保存し、対象月の索引で1か月分を読み出す処理が、fake-indexeddb 上で 2 秒以内に終わる（画面での集計 500ms の目標は U5・U7 で扱い、ここでは保存の層が足を引っ張らないことを確かめる） | 時間を測るテスト（合格条件 2,000ms、測定値を記録） | NFR3 |
| NFR6.1 | `src/storage/**` の行カバレッジ 80% 以上（ディレクトリ単位のしきい値を設ける）。テストは正常系と2つ以上の異常・境界の例 | 検証コマンドのカバレッジ結果 | NFR6、construction.md |
| NFR6.2 | U3 は「その他のレイヤー」なので、実装の後にテストを書く（team.md Testing Posture の Ordering） | コード生成の計画の手順の順序 | NFR6、team.md |
| NFR9.1 | 追加の依存（fake-indexeddb）を正確なバージョンで固定し、`npm ci` と `npm run verify` だけで検証できる | クリーンな状態での実行 | NFR9 |

## 3. 対象外の分類

| 分類 | 理由 |
|------|------|
| 拡張性・監視 | 単一利用者のブラウザ内の保存で、稼働するサービスではない（種類 library） |
| 信頼性（可用性の目標） | サーバーがないため可用性の目標は置かない。データの整合は NFR4.1〜NFR4.4 で扱う |
