# ビルドと検証の流れ（storage）

- 出典: `aidlc/spaces/default/memory/team.md`（Way of Working、Testing Posture、Deployment）、`construction/storage/nfr-design/security-design.md`（第3章 禁止規則、第4章 テストの設計）、`construction/storage/nfr-design/logical-components.md`、`construction/storage/functional-design/functional-spec.md`、`inception/domain-design/components.md`、`inception/contract-design/contract-summary.md`（C2）
- 外部の CI サービスは使わない。デプロイ・環境の昇格はない。U3 は U4 から使われる部品で、単独で配布しない。保存先は利用者のブラウザ内の IndexedDB だけ。

## 1. 流れ（ローカル）

1. **取得**: `npm ci`（ロックファイルどおりに依存を入れる。開発時の依存 fake-indexeddb を含む。Node.js 24 以外では engine-strict により失敗する）
2. **整形の確認**: `npm run format:check`
3. **Lint**: `npm run lint`（警告もエラー。storage 用のブロックで通信・他の保存先・eval・new Function を禁止する。フラット設定では同じ規則の指定が別ブロックで合成されないため、storage 用のブロックに禁止の一覧をすべて書き切る）
4. **型チェック**: `npm run typecheck`
5. **テストとカバレッジ**: `npm run test`（U1・U3 は node、U2 は jsdom。U3 は fake-indexeddb を使う本物と差し替えに同じ契約テストを流す。全体と `src/storage/**` の行カバレッジ 80% 以上）
6. 2〜5 を `npm run verify` で一度に実行し、終了コード 0 であることをマージ前の条件とする

## 2. 段階と通過条件

| 段階 | 通過条件 | 失敗したとき |
|------|----------|--------------|
| 取得 | `npm ci` が成功 | 依存の取得の問題として止めて相談（有償サービス・認証変更・追加購入はしない） |
| 整形・Lint・型 | エラー0件、警告0件 | 修正してやり直す |
| テスト | 全件合格、全体と `src/storage/**` の行カバレッジ 80% 以上、性能の目安（security-design.md 4.3）を満たす | 修正してやり直す。しきい値は下げない。時間の判定が不安定なら記録して原因を調べる |
| Unit の完了確認 | `npm run verify` の終了コード 0 を AI-DLC が記録し、利用者が承認 | 利用者の Request Changes で修正 |
| 実ブラウザ確認 | 本物の IndexedDB での再読み込み後の保持（AC1.2.1）と保存失敗の表示を、U7 の Build and Test で確認する | Build and Test で修正に戻る |

## 3. ブランチとマージ

- 作業ブランチは `setup/aidlc-d` から切り、`setup/aidlc-d` に squash マージする（team.md Way of Working）。コミットとマージは利用者の指示で行う。

## 4. 戻し方

- デプロイがないため、戻しはソースの戻しだけ。問題のある変更は git の revert で取り消し、`npm ci` と `npm run verify` でやり直す。
- 利用者のブラウザに保存されたデータの版（SCHEMA_VERSION）を上げる変更は、古い版のアプリでは開けなくなる（newer-version）。版を上げる変更を戻す場合は、版を戻すのではなく、移行を含めた新しい版で直す。

## 5. 秘密情報

- 使わない。U3 には鍵・資格情報・環境変数を必要とする処理がない（construction.md Security）。
