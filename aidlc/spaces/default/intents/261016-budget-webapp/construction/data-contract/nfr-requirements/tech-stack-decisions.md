# 技術の選定（data-contract とプロジェクト共通の開発道具）

- 出典: `inception/requirements-analysis/requirements.md`（C1、C6、C7、NFR3、NFR5、NFR6、NFR9）、`aidlc/spaces/default/memory/team.md`（Testing Posture、Code Style、Deployment）、`inception/units-generation/unit-of-work.md`（1パッケージ・Unit 別フォルダ）、`nfr-requirements-questions.md`（Q1 = A）
- U1 が最初の Unit のため、ここでプロジェクト共通の開発道具を決める。ほかの Unit は同じ道具を使い、追加が必要な場合はその Unit の NFR Requirements で決める。

## 1. 選定

| 分類 | 選定 | 理由 | 採らなかった案 |
|------|------|------|----------------|
| 言語 | TypeScript（`strict: true`、`noUncheckedIndexedAccess: true`） | 要件 C1・team.md Code Style | — |
| 実行環境（開発時） | Node.js 24（手元にある v24.18.0）＋ npm（v11） | 承認済みの検証コマンドが `npm run verify`。新たな導入が不要 | Bun（検証コマンドと合わない） |
| テストとカバレッジ | Vitest ＋ `@vitest/coverage-v8` | Vite と同じ仕組みで、画面の Unit まで同じ道具でテストできる（Q1 = A） | Jest（Vite と別の変換設定が必要） |
| Lint | ESLint（フラット設定）＋ typescript-eslint | team.md Code Style | — |
| 整形 | Prettier（チェックのみを検証コマンドに含める） | team.md Code Style | — |
| 文字数の数え方 | `Intl.Segmenter`（書記素単位）。Node.js・対応ブラウザ（NFR7）の標準機能 | 追加の依存なし（Q1 = A） | 文字コード単位で数える（絵文字・結合文字で数が合わない） |
| 全角→半角・比較キー | `String.prototype.normalize("NFKC")` | 標準機能。追加の依存なし | 独自の変換表（漏れが出やすい） |
| CSV の符号化・復号 | 自前の実装（BR4.1〜BR4.6 に従う小さな関数） | 規則（数式対策の往復、行番号）を正確に満たすため。依存を減らす | CSV ライブラリ（数式対策・行番号の規則を別途かぶせる必要がある） |
| 実行時の依存 | なし（U1 は標準機能だけを使う） | NFR1.1（外部に依存しない）、NFR9（再現性） | — |
| バージョンの固定 | `package-lock.json` をコミットする。依存は正確なバージョンで指定する | NFR9 | — |

- 画面の Unit で使う React・Vite、保存の Unit のテストで使う IndexedDB の代替実装は、それぞれの Unit の NFR Requirements で決める。

## 2. 検証コマンドの中身

`npm run verify` は次を順に実行し、1つでも失敗すれば失敗とする（team.md Testing Posture）。

| 順 | 内容 | 失敗の条件 |
|----|------|------------|
| 1 | 整形のチェック（Prettier `--check`） | 整形されていないファイルがある |
| 2 | Lint（ESLint、警告もエラーとして扱う） | 違反がある |
| 3 | 型チェック（`tsc --noEmit`） | 型エラーがある |
| 4 | テストとカバレッジ（Vitest、行カバレッジのしきい値 80%） | テストの失敗、または行カバレッジ 80% 未満 |

- カバレッジは、その時点で存在するすべての Unit の `src/` 配下を対象にする（テストファイル自体は除く）。

## 3. 非機能の目標（このUnit分）

| ID | 目標 | 確かめ方 | 出典 |
|----|------|----------|------|
| NFR3.1 | `decodeCsv` は 5,000 レコード（1MB 以内）の CSV を、開発用 PC の Node.js 上で 300ms 以内に復号する（画面でのプレビュー 2 秒以内の目標の内訳） | 5,000 行の架空 CSV を生成して時間を測るテスト（時間の上限は余裕を持たせて判定し、結果を記録する） | NFR3 |
| NFR5.1 | 金額・予算額の検証結果は常に安全な整数（`Number.isSafeInteger`）で、浮動小数点の値を返さない | 境界値テスト（1、99,999,999、1.5、1e8） | NFR5 |
| NFR6.1 | U1 の行カバレッジは 80% 以上。テストは正常系と、各規則につき2つ以上の異常・境界の例を含む（construction.md Testing Standards） | 検証コマンドのカバレッジ結果 | NFR6、team.md |
| NFR6.2 | U1 はテストを先に書く（team.md Testing Posture の Ordering） | コード生成の計画で、テストを先に書く手順になっていること | NFR6、team.md |
| NFR9.1 | 依存のバージョンをロックファイルで固定し、クリーンな取得状態から `npm ci` と `npm run verify` だけで検証できる | クリーンな状態での実行 | NFR9 |

## 4. 対象外の分類

| 分類 | 理由 |
|------|------|
| 性能（画面の応答） | U1 は種類 spec で画面を持たない。CSV 復号の時間だけを NFR3.1 で扱う |
| 拡張性・信頼性・監視 | U1 は状態・保存・通信を持たない純粋な関数で、稼働するサービスではない |
