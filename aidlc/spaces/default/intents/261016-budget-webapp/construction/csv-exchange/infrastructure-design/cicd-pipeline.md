# ビルドと検証の流れ（csv-exchange）

- 出典: `aidlc/spaces/default/memory/team.md`（Way of Working、Testing Posture、Deployment）、`construction/csv-exchange/nfr-design/security-design.md`（第5章 禁止規則、第6章 テストの設計）、`construction/csv-exchange/nfr-design/logical-components.md`、`construction/csv-exchange/functional-design/functional-spec.md`、`inception/domain-design/components.md`、`inception/contract-design/contract-summary.md`（C5）
- 外部の CI サービスは使わない。デプロイ・環境の昇格はない。U6 は U7 から使われる部品で、単独で配布しない。

## 1. コード生成で追加する設定（この Unit の検証の前提）

| ファイル | 追加する内容 |
|----------|--------------|
| vitest.config.ts | プロジェクト `csv-exchange`（環境 node、include `src/csv-exchange/**/*.test.ts`）と、しきい値 `"src/csv-exchange/**": { lines: 80 }` |
| eslint.config.js | `src/csv-exchange/**/*.ts`（`*.test.ts` と `test-fixtures.ts` を除く）のブロック。security-design.md 第5章の禁止の一覧をこのブロックに書き切る（フラット設定では別のブロックの指定は合成されない） |

Unit の完了確認では、これらが入っていることと、Lint の禁止が効くことのテストが通ることを確かめる。

## 2. 流れ（ローカル）

1. **取得**: `npm ci`（ロックファイルどおり。U6 で追加する依存はない。Node.js 24 以外では engine-strict により失敗する）
2. **整形の確認**: `npm run format:check`
3. **Lint**: `npm run lint`（警告もエラー。csv-exchange 用のブロックの禁止を含む）
4. **型チェック**: `npm run typecheck`
5. **テストとカバレッジ**: `npm run test`（U6 は node。Book は U4 に U3 の差し替えを渡して作る。全体と `src/csv-exchange/**` の行カバレッジ 80% 以上）
6. 2〜5 を `npm run verify` で一度に実行し、終了コード 0 であることをマージ前の条件とする

## 3. 段階と通過条件

| 段階 | 通過条件 | 失敗したとき |
|------|----------|--------------|
| 取得 | `npm ci` が成功 | 依存の取得の問題として止めて相談（有償サービス・認証変更・追加購入はしない） |
| 整形・Lint・型 | エラー0件、警告0件 | 修正してやり直す |
| テスト | 全件合格、全体と `src/csv-exchange/**` の行カバレッジ 80% 以上、性能の目安（security-design.md 6.3）を満たす | 修正してやり直す。しきい値は下げない。時間の判定は中央値と余裕のある固定のしきい値で行い、不安定なら測定値と環境を記録して原因を調べる（再実行で通ったことを合格としない） |
| Unit の完了確認 | `npm run verify` の終了コード 0 を AI-DLC が記録し、利用者が承認 | 利用者の Request Changes で修正 |
| 本物のブラウザでの確認 | ファイル選択のキーボード操作、読み込みからプレビューまで 2 秒（NFR3）、書き出したファイルのダウンロードと表計算ソフトでの表示を U7 の Build and Test で確認する | Build and Test で修正に戻る |

## 4. ブランチとマージ

- 作業ブランチは `setup/aidlc-d` から切り、`setup/aidlc-d` に squash マージする（team.md Way of Working）。コミットとマージは利用者の指示で行う。

## 5. 戻し方

- デプロイがないため、戻しはソースの戻しだけ。問題のある変更は git の revert で取り消し、`npm ci` と `npm run verify` でやり直す。

## 6. 秘密情報

- 使わない。U6 には鍵・資格情報・環境変数を必要とする処理がない（construction.md Security）。
