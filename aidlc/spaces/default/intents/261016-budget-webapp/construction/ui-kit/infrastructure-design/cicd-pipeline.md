# ビルドと検証の流れ（ui-kit）

- 出典: `aidlc/spaces/default/memory/team.md`（Way of Working、Testing Posture、Deployment）、`construction/ui-kit/nfr-design/security-design.md`（共通設定の拡張、実ブラウザ確認 B1〜B5）、`construction/ui-kit/nfr-design/logical-components.md`、`construction/ui-kit/functional-design/functional-spec.md`、`inception/contract-design/contract-summary.md`（C6）
- 外部の CI サービスは使わない。デプロイ・環境の昇格はない。U2 は U7 に組み込まれる部品で、単独で配布しない。

## 1. 流れ（ローカル）

1. **取得**: `npm ci`（ロックファイルどおりに依存を入れる。Node.js 24 以外では engine-strict により失敗する）
2. **整形の確認**: `npm run format:check`
3. **Lint**: `npm run lint`（警告もエラー。U2 用の通信・保存の参照禁止と `dangerouslySetInnerHTML` の禁止を含む）
4. **型チェック**: `npm run typecheck`（`.tsx` を含む）
5. **テストとカバレッジ**: `npm run test`（U1 は node、U2 は jsdom で実行。行カバレッジ 80% 以上）
6. 2〜5 を `npm run verify` で一度に実行し、終了コード 0 であることをマージ前の条件とする

## 2. 段階と通過条件

| 段階 | 通過条件 | 失敗したとき |
|------|----------|--------------|
| 取得 | `npm ci` が成功 | 依存の取得の問題として止めて相談（有償サービス・認証変更・追加購入はしない） |
| 整形・Lint・型 | エラー0件、警告0件 | 修正してやり直す |
| テスト | 全件合格、行カバレッジ 80% 以上 | 修正してやり直す。しきい値は下げない |
| Unit の完了確認 | `npm run verify` の終了コード 0 を AI-DLC が記録し、利用者が承認 | 利用者の Request Changes で修正 |
| 実ブラウザ確認 | security-design.md 3.3 の B1〜B5（U7 の Build and Test で実施） | Build and Test で修正に戻る |

## 3. ブランチとマージ

- 作業ブランチは `setup/aidlc-d` から切り、`setup/aidlc-d` に squash マージする（team.md Way of Working）。コミットとマージは利用者の指示で行う。

## 4. 戻し方

- デプロイがないため、戻しはソースの戻しだけ。問題のある変更は git の revert で取り消し、`npm ci` と `npm run verify` でやり直す。

## 5. 秘密情報

- 使わない。U2 には鍵・資格情報・環境変数を必要とする処理がない（construction.md Security）。
