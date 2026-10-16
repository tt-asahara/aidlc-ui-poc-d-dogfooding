# Practices Discovery エビデンス

リード（`aidlc-pipeline-deploy-agent`）単独で実施しました。この実行は `Collaborators: off`（`classic` スコープ）のため、サポートエージェントの寄稿はありません。

## 実行コンテキスト

- プロジェクト種別: Greenfield（ワークスペーススキャンによる判定）
- スコープ: `classic`（Depth: Standard、Test Strategy: Standard、`skeleton: off`、Collaborators: off）
- 実行方式: Construction Checkpoints 有効、Construction Iteration `unit-major`、Construction Execution `serial`
- スキップされるステージ: Ideation 全体、CI Pipeline（3.7）、Operation 全体、Reverse Engineering（2.1、グリーンフィールドのため）
- 既存の確定済みプラクティス: なし（`team.md`・`project.md` の 5 セクションはいずれも空）

## リードが調査・推論した内容

| 対象 | 調べたこと | 得られた事実 / 推論 |
|---|---|---|
| `org.md` の 5 セクション | Way of Working、Walking Skeleton、Testing Posture、Deployment、Code Style | 既定値（トランクベース + squash、スコープ依存のスケルトン、test-after + classic の 80% カバレッジ・マージ前 CI、マージ時ステージングデプロイ + 本番手動承認、プロジェクト設定のリンター／フォーマッターに従う）をヒアリングの「おすすめ」の出発点として使用。 |
| `team.md` / `project.md` | 既存の確定プラクティスの有無 | すべて空。再実行ベースラインは存在しない。 |
| 依頼文 | 機能・技術・制約の明示 | 機能 4 つ（収支登録、カテゴリ別予算、月次集計、CSV 入出力）、TypeScript 実装、架空データのみ、実口座連携・外部送信なし、考慮すべき状態（入力エラー、空データ、読み込み中、保存失敗、キーボード操作）、共通データ契約を先に定義、承認・レビュー・テストを省略しない、初回は直列実行。 |
| スコープ定義 `aidlc-classic.md` | スケルトン既定、CI / Operation の扱い | `skeleton: off`。CI Pipeline と Operation はスキップ。 |
| ワークスペース | アプリケーションコード、CI / デプロイ設定、リンター設定 | アプリケーションコード、`package.json`、`tsconfig.json`、`.prettierrc`、ESLint 設定、CI 設定はいずれも存在しない。存在するのは `.claude/`、`aidlc/`、`.gitignore`、`poc-evidence/` のみ。 |
| Git | ブランチ・コミット | コミットは 1 件（`ae11a06`）。ローカルブランチは `setup/aidlc-d` のみで、`main` はローカルにもリモート追跡ブランチにも存在しない。 |

## ヒアリングでの決定

| 質問 | 選択 | 決定内容 |
|---|---|---|
| Q1. 作業ブランチの扱い | A | `setup/aidlc-d` から作業ブランチを切り、成果は `setup/aidlc-d` にまとめる。`main` には触れない。トランク（ワークツリーのベース・マージ先）= `setup/aidlc-d`、squash マージは維持。 |
| Q2. ウォーキングスケルトン | B | 作らない（スコープ既定どおり）。共通データ契約を最初の Unit とし、依存順に進める。 |
| Q3. テストを書く順序 | C | 混合（`custom`）。共通データ契約と CSV 変換はテスト先行、UI などその他のレイヤーは実装後にテスト。 |
| Q4. マージ前のテスト実行方法 | A | lint・型チェック・テスト・カバレッジ（行 80% 下限）を一括実行するローカル単一コマンドをマージ前に必ず実行し、結果を記録する。外部 CI サービスは使わない。 |
| Q5. 公開・デプロイ | A | デプロイしない。ローカルでビルド・起動して確認できる状態をゴールとする。 |
| Q6. コードの書式と静的チェック | A | Prettier ＋ ESLint（TypeScript 対応）＋ TypeScript `strict`。失敗時はマージしない。 |
| Q7. ハードルールの確認 | A | `discovered-rules.md` の 6 件（Mandated 3、Forbidden 3）をそのまま記録する。 |

## 統合時の判断

1. **「初回は直列実行」の扱い**: 今回の実行に限った指示のため、ハードルール（`discovered-rules.md`）には入れず、`## Way of Working` に「今回の進め方（恒久ルールではない）」として記載した。
2. **計測記録の扱い**: 依頼文の「開始状態、作業時間、使用モデル、テスト結果、やり直し回数を記録」は PoC の計測要件であり、チームプラクティスには含めていない（オーケストレーター側で扱う想定）。
3. **ツール選定の保留**: テストランナー、UI フレームワーク、ビルドツールは後続の要件・設計ステージで決めるため、本ステージでは方針のみ記載した。

## 解決済み・残る不確実性

- 解決済み: ドラフトで挙げた 7 件の未決事項（トランクブランチ、スケルトン、テスト手法と順序、マージ前検証の方法、デプロイ先、コードスタイル、ハードルール）はすべて Q1〜Q7 で解決した。
- 残る不確実性（注意点）: `org.md` の `## Way of Working` はベース・マージ先を `main` と記載しているが、本チームの確定内容はトランクを `setup/aidlc-d` とする。トランクベース + squash という方式は同じで、ブランチ名だけを具体化したものだが、昇格時のアドミッションチェックでブランチ名の差が矛盾と判定される可能性がある。その場合は人間の判断を仰ぐ。
- 残る不確実性: マージ前検証コマンドの具体的なコマンド名・構成は、ツール選定後（設計・コード生成段階）に確定する。

## Sources

- `aidlc/spaces/default/memory/org.md` — 5 セクションの既定値
- `aidlc/spaces/default/memory/team.md` — 空（確定済みプラクティスなし）
- `aidlc/spaces/default/memory/project.md` — 空（確定済みプラクティスなし）
- `aidlc/spaces/default/intents/261016-budget-webapp/aidlc-state.md` — プロジェクト種別、スコープ設定、Runtime State
- `aidlc/spaces/default/intents/261016-budget-webapp/project-description.json` の依頼文（オーケストレーターのブリーフに引用された原文）
- `aidlc/spaces/default/intents/261016-budget-webapp/inception/practices-discovery/practices-discovery-questions.md` — Q1〜Q7 の回答
- `.claude/scopes/aidlc-classic.md` — `skeleton: off`、CI Pipeline / Operation のスキップ
- `.claude/aidlc-common/stages/inception/practices-discovery.md` — ステージ定義（Step 5）
- `.claude/knowledge/aidlc-pipeline-deploy-agent/branching-strategies.md`、`cicd-patterns.md`、`deployment-strategies.md` — ブランチ戦略・品質ゲート・デプロイ戦略の参照
- `.claude/knowledge/aidlc-shared/rules-reading.md` — ルール層のフォールバック規則
- ワークスペースのディレクトリ一覧、`git branch -a -v`、`git rev-parse HEAD`、`bun .claude/tools/aidlc.ts engine now` の結果
