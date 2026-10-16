# ビルドと検証の流れ（app-screens）

- 出典: `aidlc/spaces/default/memory/team.md`（Way of Working、Testing Posture、Deployment）、`construction/app-screens/infrastructure-design/infrastructure-specification.md`、`construction/app-screens/nfr-design/security-design.md`（禁止の一覧、8章 テスト）、`construction/app-screens/nfr-requirements/tech-stack-decisions.md`
- 外部の CI サービスは使わない。デプロイ・環境の昇格はない。マージ前の検証はローカルの一括コマンド `npm run verify`（team.md Testing Posture）。

## 1. コード生成で追加する設定

| ファイル | 追加する内容 |
|----------|--------------|
| `vitest.config.ts` | プロジェクト `app`（jsdom、include `src/app/**/*.test.{ts,tsx}`、setup は U2 の test-setup を使う）と、しきい値 `"src/app/**": { lines: 80 }` |
| `eslint.config.js` | `scripts/**/*.mjs` に Node.js の globals（process、console）を許すブロックを加える（`scripts/check-dist.mjs` が `no-undef` で失敗しないため）。`src/app/**/*.{ts,tsx}`（テストを除く）のブロック。通信・保存先の直接参照と、import の規則（security-design 2章：公開窓口の index だけを許可、U3 と内部ファイルを禁止）、HTML 挿入の禁止 |
| `vite.config.ts`、`index.html` | ビルドの設定（infrastructure-specification 3章） |
| `package.json` | `dev`、`build`、`preview` のスクリプト、Vite の依存（正確なバージョン固定。プラグインは追加しない） |
| `tsconfig.json` | `include` に `vite.config.ts` を加え、typecheck の対象にする |
| `vite.config.ts` | `server.host` と `preview.host` を `127.0.0.1` に固定する |

## 2. 流れ（ローカル）

1. **取得**: `npm ci`（ロックファイルどおり。Node.js 24 以外では engine-strict により失敗する）
2. **整形の確認**: `npm run format:check`
3. **Lint**: `npm run lint`（警告もエラー。`src/app` のブロックの禁止を含む）
4. **型チェック**: `npm run typecheck`
5. **テストとカバレッジ**: `npm run test`（全体と `src/app/**` の行カバレッジ 80% 以上）
6. 2〜5 を `npm run verify` で一度に実行し、終了コード 0 であることをマージ前の条件とする
7. **ビルドの確認（Build and Test）**: `npm run build` と `npm run preview`。`dist/` の外部 URL と計測の印の検査

## 3. 段階と通過条件

| 段階 | 通過条件 | 失敗したとき |
|------|----------|--------------|
| 取得 | `npm ci` が成功 | 依存の取得の問題として止めて相談（有償サービス・認証変更・追加購入はしない） |
| 整形・Lint・型 | エラー0件、警告0件 | 修正してやり直す |
| テスト | 全件合格、全体と `src/app/**` の行カバレッジ 80% 以上 | 修正してやり直す。しきい値は下げない |
| ビルド（Unit の完了確認には含めない。Build and Test の最初の手順） | `npm run build` が成功、infrastructure-specification 4章の外部参照の検査と計測の印の検査を通る | Build and Test で修正してやり直す |
| Unit の完了確認 | `npm run verify` の終了コード 0 を AI-DLC が記録し、利用者が承認 | 利用者の Request Changes で修正 |
| 実ブラウザの確認（Build and Test） | 性能（500ms、2 秒、最悪ケース）、B1〜B5、主な操作、保存の保持、保存失敗の表示、他ブラウザの手動確認 | Build and Test で修正に戻る |

## 4. ブランチとマージ

- 作業ブランチは `setup/aidlc-d` から切り、`setup/aidlc-d` に squash マージする（team.md Way of Working）。コミットとマージは利用者の指示で行う。

## 5. 戻し方

- デプロイがないため、戻しはソースの戻しだけ。問題のある変更は git の revert で取り消し、`npm ci` と `npm run verify` でやり直す。

## 6. 秘密情報

- 使わない。アプリに鍵・資格情報・環境変数を必要とする処理がない（construction.md Security）。
