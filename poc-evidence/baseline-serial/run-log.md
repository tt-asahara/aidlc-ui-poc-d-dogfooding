# ベースライン実行記録（公式・直列実行）

比較の基準となる初回実行の記録です。Clef と D の並列実行（read-only fanout / design wave / swarm）は使っていません。

## 開始状態

| 項目 | 値 |
|------|----|
| 開始時刻（ローカル） | 2026-10-16T16:44:15+0900 |
| ワークフロー開始（state の Start Date） | 2026-10-16T07:44:27Z |
| 作業先 | /Users/cb-329/work-andy/aidlc-ui-poc-d-dogfooding |
| 作業先ブランチ / コミット | setup/aidlc-d / ae11a064f4493c46006b1131574605213b69f5a6（作業ツリー clean） |
| D参照元 | /Users/cb-329/Documents/Codex/2026-10-16/task-4/aidlc-ui-poc-d |
| D参照元ブランチ / コミット | feature/aidlc-setup-skill / 86f1ec7f9fe4bdb062e2414411c3431ac764beb5 |
| 最初に読んだ手順書 | poc/d-acceleration/verification.md |
| AI-DLC スコープ | classic（17ステージ、Depth: Standard、Test Strategy: Standard） |
| Intent | aidlc/spaces/default/intents/261016-budget-webapp |
| Construction Execution | serial（公式直列） |
| Construction Iteration | unit-major |
| Guard Policy | off（classic スコープ由来） |
| Collaborators | off（classic スコープ由来、リードエージェントのみ） |
| bun | 1.3.14 |
| セッション | 5f729697-dd82-4901-a486-267e99731025 |

## 使用モデル

| 区分 | 要求値 | ランタイム報告値 |
|------|--------|------------------|
| オーケストレーター（このセッション） | 既定（変更なし） | claude-opus-5-5（セッション環境が報告） |
| 委譲エージェント | エージェント定義の既定（変更なし） | unverified（Agent ツールは実モデルIDを返さない） |
| オーケストレーター（app-screens の Functional Design 以降） | 利用者は変更を依頼していない（環境側の変更） | claude-haiku-5-5（セッション環境が報告）。monthly-summary の承認後に切り替わった。U7 と Build and Test は、Opus 5.5・Sonnet 5.5 とは別の条件として扱う |
| オーケストレーター（monthly-summary のコード生成の開始以降） | 利用者は変更を依頼していない（環境側の変更） | claude-sonnet-5-5（セッション環境が報告）。記録の時点で、この会話の使用モデルが claude-opus-5-5 から切り替わっていた。比較の条件が揺れるため、monthly-summary 以降（U7 と Build and Test を含む）は別の使用モデルでの結果として扱う |

## 実施前の変更

- `.claude/settings.local.json` を新規作成し `"disableAllHooks": false` を設定（AI-DLC のフック有効化のため。ワークフロー指示に従ったもの）。

## ステージ記録

| ステージ | 開始 | 承認 | やり直し回数 | 備考 |
|----------|------|------|--------------|------|
| practices-discovery | 2026-10-16T07:44Z | 2026-10-16T08:01Z | 0 | リード単独（release engineer サブエージェント 2回：初稿 141.7s / 統合 89.5s）。質問7問 |
| requirements-analysis | 2026-10-16T08:01Z | 承認済み | 0 | 質問8問。プロダクトリード advisory レビュー 1回（READY、Major 2・Minor 4、受け入れたリスク、48.8s） |
| user-stories | requirements 承認後 | 承認済み | 0 | 質問4問。リード単独（mob の共同作業者なし）。レビュー 1回（READY、Major 1・Minor 5、49.3s） |
| refined-mockups | user-stories 承認後 | 承認済み | 0 | 質問6問（追加1問を含む）。レビュー 1回（READY、Major 1・Minor 6、54.6s） |
| domain-design | refined-mockups 承認後 | 承認済み | 0 | 質問4問。アーキテクチャレビュー 1回（READY、Major 1・Minor 2、35.0s） |
| units-generation | domain-design 承認後 | 承認済み | 0 | 質問3問＋分割計画の承認。レビュー 1回（READY、Minor 3、40.7s） |
| contract-design | units-generation 承認後 | 承認済み | 0（レビュー再実行 1回） | 質問5問。レビュー1回目は形式不備で記録できず、同じ依頼で1回再実行（68.8s＋93.7s）。READY、Major 2・Minor 7 |
| delivery-planning | contract-design 承認後 | 2026-10-16T09:16:55Z | 0 | 質問4問＋検証コマンド（`npm run verify`）承認＋体制（このセッション）。レビュー担当なし |

Inception 完了: 2026-10-16T18:16:55+0900（開始から約1時間33分）。

### Construction（Unit ごと・直列、完了確認は毎回人の承認）

| Unit（Bolt） | 開始 | 承認 | やり直し回数 | 備考 |
|--------------|------|------|--------------|------|
| data-contract（B1） | 2026-10-16T18:18:50+0900 | 2026-10-16T18:55:32+0900 | 0 | FD 質問3・NFR-R 質問1・NFR-D 質問0・Infra 対象外。計画承認1回。開発担当 843.8s（ツール 109 回）。テスト 212 件合格、行カバレッジ 100%、`npm run verify` 終了コード 0。レビュー4回すべて READY |

| ui-kit（B6 → 実際は2番目） | 2026-10-16T18:56:20+0900 | 2026-10-16T19:40:08+0900 | 0 | FD 質問1・NFR-R 質問1・NFR-D 0・Infra 0。計画承認1回。開発担当 1318.1s（ツール 156 回）。テスト累計 325 件合格、行カバレッジ 100%。レビュー5回すべて READY。開発担当が一度シェルで設定を書き換えた（手順違反、結果は確認済み） |
| storage（B2 → 実際は3番目） | 2026-10-16T19:41:07+0900 | 2026-10-16T20:40:54+0900 | 0 | FD 質問1・NFR-R 質問1・NFR-D 質問1（NFR-R レビューの Major を受けた追加の判断）・Infra 0。計画承認1回。開発担当 1263.1s（ツール 154 回）。テスト累計 417 件合格（U3 92 件）、行カバレッジ 全体 98.91%・storage 98.18%。fake-indexeddb 6.2.5 追加。レビュー5回（NFR-R のみ NOT-READY、advisory のため停止なし、他4回 READY）。U1・U2 のテストが初回実行で1件だけ一度失敗（再現なし、Build and Test で調査） |
| bookkeeping-core（B3 → 実際は4番目） | 2026-10-16T20:41頃+0900（storage 承認の直後） | 2026-10-16T21:28:00+0900 | 0 | FD 質問1・NFR-R 質問0・NFR-D 質問1・Infra 0。計画承認1回。開発担当 1203.5s（ツール 174 回）。テスト累計 531 件合格（U4 114 件）、行カバレッジ 全体 99.14%・bookkeeping-core 100%。追加の依存なし。レビュー5回すべて READY（Major は NFR-R・Infra で各1件、advisory のため停止なし）。初回実行の揺れの原因候補（ESLint を使うテストの初回読み込みが5秒を超える）を特定 |
| monthly-summary（計画の U5、実際は6番目。使用モデル切替後） | 2026-10-16T22:40+0900（csv-exchange 承認の直後） | 2026-10-16T23:08:55+0900 | 0 | FD 質問0・NFR-R 質問0・NFR-D 質問0・Infra 0。計画承認1回。開発担当（Sonnet 5.5 のセッション）。テスト累計 640 件合格（U5 43 件）、行カバレッジ 全体 99.24%・monthly-summary 100%。性能: 集計の取得 3.2ms（目安 250ms）、計算単独 0.2ms（目安 20ms）。レビュー5回すべて READY。既知の不安定なテスト（U1・U3 の lint-config 2件）が最初の全体実行で再発、再実行で合格 |
| csv-exchange（B5 → 実際は5番目、計画の U5 より先） | 2026-10-16T21:28頃+0900（bookkeeping-core 承認の直後） | 2026-10-16T22:39:45+0900 | 0 | FD 質問1・NFR-R 質問0・NFR-D 質問2（FD・NFR-R レビューの Major を受けた判断）・Infra 0。計画承認1回。テストを先に書く順序。開発担当 1553.6s（ツール 144 回）。テスト累計 597 件合格（U6 66 件）、行カバレッジ 全体 99.21%・csv-exchange 100%。追加の依存なし。レビュー5回すべて READY。不安定なテスト（U1・U3 の lint-config 2件、並列実行で ESLint 初回読み込み 5 秒超）を特定、未対処 |

- 実際の順序の差: Bolt 計画では storage が2番目だったが、エンジンは依存のない ui-kit を2番目に選んだ（unit-of-work-dependency.md の並び順による）。
- 実際の Unit の順序はエンジンが依存関係から決める（計画の順序と違う場合は記録する）。
- コミットはしていない（利用者の指示がないため）。
- 手順の誤り（app-screens の Functional Design）: `engine state unit complete` を、FD のレビューを実行する前に呼んだ。エンジンはその時点で FD を完了として次の NFR Requirements に進んだ。その後レビュー（READY、指摘 Minor 6）を実行して判定を記録した。レビューは省略していないが、完了の記録の順序が逆になった。監査の記録は取り消せないため、そのまま残す。レビュー後、指摘のうち規則の誤り（BR7.1 の文言、D2 の失敗、月の移動、古い読み取りの競合、BR1.1 の説明）を文書で直した。直した版の再レビューは行っていない（判断は利用者に委ねる）。
- 手順の誤り（app-screens の NFR Requirements）: 次の段階へ案内されたとき、`engine state unit start` を呼ばずにレビューを記録した（エンジンが「開始していない unit」として拒否した）。レビュー（READY、指摘 Minor 4）は記録済み。その後に開始と完了を記録した。順序の誤りは監査に残る。
- 手順の誤り（app-screens の NFR Design）: 反復 2 のレビューの記録が「指摘の表を読めない」として一度拒否された（拒否の時点でレビューのファイルは消えた）。その前に `engine state unit complete` を実行していたため、監査では UNIT_COMPLETED が REVIEW_COMPLETED（反復 2 の READY）より前に残る。反復 1（NOT-READY、Major 3件）の指摘は文書で直し、反復 2 で READY を得た。
- 手順の違い（monthly-summary のコード生成）: 開発担当への指示で、承認済みの計画とテストの手順を本文に貼らず、ファイルの場所を示して読ませた（内容は承認済みのファイルそのもの）。
- 手順の違い（bookkeeping-core のコード生成）: 開発担当への指示で、承認済みの計画とテストの手順を本文に貼らず、ファイルの場所を示して読ませた（内容は承認済みのファイルそのもの）。他の Unit は本文に貼っている。

## テスト結果

（Build and Test 実行後に記入）

## やり直し回数の合計

（ワークフロー終了時に記入。各ゲートの Request Changes 回数は aidlc-state.md の Revision Count と監査ログで確認できる）
