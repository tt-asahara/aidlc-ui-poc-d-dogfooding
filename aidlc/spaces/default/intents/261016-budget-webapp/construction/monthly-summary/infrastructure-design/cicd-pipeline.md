# ビルドと検証の流れ（monthly-summary）

- 出典: `aidlc/spaces/default/memory/team.md`（Way of Working、Testing Posture、Deployment）、`construction/monthly-summary/nfr-design/security-design.md`（第3章 禁止規則、第5章 テストの設計）、`construction/monthly-summary/nfr-design/logical-components.md`、`construction/monthly-summary/functional-design/functional-spec.md`、`inception/domain-design/components.md`、`inception/contract-design/contract-summary.md`（C4）
- 外部の CI サービスは使わない。デプロイ・環境の昇格はない。U5 は U7 から使われる部品で、単独で配布しない。

## 1. コード生成で追加する設定（この Unit の検証の前提）

| ファイル | 追加する内容 |
|----------|--------------|
| vitest.config.ts | プロジェクト `monthly-summary`（環境 node、include `src/monthly-summary/**/*.test.ts`）と、しきい値 `"src/monthly-summary/**": { lines: 80 }` |
| eslint.config.js | `src/monthly-summary/**/*.ts`（`*.test.ts` と `test-fixtures.ts` を除く）のブロック。security-design.md 第3章の禁止の一覧をこのブロックに書き切る。compute.ts 用のブロックは、同じ一覧に Date・Math.random・setTimeout・setInterval の禁止を足した完全な一覧を持たせる（共通の定数を展開して書く。フラット設定では後のブロックが前の指定を置き換えるため） |

Unit の完了確認では、これらが入っていることと、Lint の禁止が効くことのテスト（ESLint の Node API を使う。U4・U6 と同じ方式）が通ることを確かめる。

## 2. 流れ（ローカル）

1. **取得**: `npm ci`（ロックファイルどおり。U5 で追加する依存はない。Node.js 24 以外では engine-strict により失敗する）
2. **整形の確認**: `npm run format:check`
3. **Lint**: `npm run lint`（警告もエラー。monthly-summary 用のブロックの禁止を含む）
4. **型チェック**: `npm run typecheck`
5. **テストとカバレッジ**: `npm run test`（U5 は node。全体と `src/monthly-summary/**` の行カバレッジ 80% 以上）
6. 2〜5 を `npm run verify` で一度に実行し、終了コード 0 であることをマージ前の条件とする

## 3. 段階と通過条件

| 段階 | 通過条件 | 失敗したとき |
|------|----------|--------------|
| 取得 | `npm ci` が成功 | 依存の取得の問題として止めて相談（有償サービス・認証変更・追加購入はしない） |
| 整形・Lint・型 | エラー0件、警告0件 | 修正してやり直す |
| テスト | 全件合格、全体と `src/monthly-summary/**` の行カバレッジ 80% 以上、性能の目安（security-design.md 5.3。しきい値と測定回数は performance.test.ts の先頭の定数）を満たす | 修正してやり直す。しきい値は下げない。不安定なら測定値と環境を記録して原因を調べる（再実行で通ったことを合格としない） |
| Unit の完了確認 | `npm run verify` の終了コード 0 を AI-DLC が記録し、利用者が承認 | 利用者の Request Changes で修正 |
| 本物のブラウザでの確認 | 表示の切り替え 500ms（NFR3）を U7 の Build and Test で確認する | Build and Test で修正に戻る |

## 4. ブランチとマージ

- 作業ブランチは `setup/aidlc-d` から切り、`setup/aidlc-d` に squash マージする（team.md Way of Working）。コミットとマージは利用者の指示で行う。

## 5. 戻し方

- デプロイがないため、戻しはソースの戻しだけ。問題のある変更は git の revert で取り消し、`npm ci` と `npm run verify` でやり直す。

## 6. 秘密情報

- 使わない。U5 には鍵・資格情報・環境変数を必要とする処理がない（construction.md Security）。
