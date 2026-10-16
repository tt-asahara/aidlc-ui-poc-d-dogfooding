# ビルドと検証の流れ（bookkeeping-core）

- 出典: `aidlc/spaces/default/memory/team.md`（Way of Working、Testing Posture、Deployment）、`construction/bookkeeping-core/nfr-design/security-design.md`（第7章 禁止規則、第8章 テストの設計）、`construction/bookkeeping-core/nfr-design/logical-components.md`、`construction/bookkeeping-core/functional-design/functional-spec.md`、`inception/domain-design/components.md`、`inception/contract-design/contract-summary.md`（C3）
- 外部の CI サービスは使わない。デプロイ・環境の昇格はない。U4 は U5〜U7 から使われる部品で、単独で配布しない。

## 1. 流れ（ローカル）

1. **取得**: `npm ci`（ロックファイルどおり。U4 で追加する依存はない。Node.js 24 以外では engine-strict により失敗する）
2. **整形の確認**: `npm run format:check`
3. **Lint**: `npm run lint`（警告もエラー。bookkeeping-core 用のブロックで通信・保存先の直接の参照・eval・new Function・テスト以外での fake-indexeddb の import を禁止する。フラット設定では別のブロックの指定が合成されないため、禁止の一覧をこのブロックに書き切る）
4. **型チェック**: `npm run typecheck`
5. **テストとカバレッジ**: `npm run test`（U4 は node。主に U3 の差し替え、別のタブと版上げは fake-indexeddb。全体と `src/bookkeeping-core/**` の行カバレッジ 80% 以上）
6. 2〜5 を `npm run verify` で一度に実行し、終了コード 0 であることをマージ前の条件とする

## 2. 段階と通過条件

| 段階 | 通過条件 | 失敗したとき |
|------|----------|--------------|
| 取得 | `npm ci` が成功 | 依存の取得の問題として止めて相談（有償サービス・認証変更・追加購入はしない） |
| 整形・Lint・型 | エラー0件、警告0件 | 修正してやり直す |
| テスト | 全件合格、全体と `src/bookkeeping-core/**` の行カバレッジ 80% 以上、性能の目安（security-design.md 8.3）を満たす | 修正してやり直す。しきい値は下げない。時間の判定が不安定なら記録して原因を調べる |
| Unit の完了確認 | `npm run verify` の終了コード 0 を AI-DLC が記録し、利用者が承認 | 利用者の Request Changes で修正 |
| 本物のブラウザでの確認 | 画面の切り替え 500ms（NFR3）と、別のタブでの操作の表示を U7 の Build and Test で確認する | Build and Test で修正に戻る |

## 3. ブランチとマージ

- 作業ブランチは `setup/aidlc-d` から切り、`setup/aidlc-d` に squash マージする（team.md Way of Working）。コミットとマージは利用者の指示で行う。

## 4. 戻し方

- デプロイがないため、戻しはソースの戻しだけ。問題のある変更は git の revert で取り消し、`npm ci` と `npm run verify` でやり直す。
- 契約 C3 の変更を戻す場合は、C3 を使う U5〜U7 の変更も同時に戻す（契約の変更ルール）。

## 5. 秘密情報

- 使わない。U4 には鍵・資格情報・環境変数を必要とする処理がない（construction.md Security）。
