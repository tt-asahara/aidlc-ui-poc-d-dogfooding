# コード生成のまとめ（data-contract）

## 作成・変更したファイル

| 区分 | ファイル |
|------|----------|
| 設定（新規） | package.json、package-lock.json、.nvmrc、.npmrc、tsconfig.json、.prettierrc.json、.prettierignore、vitest.config.ts、eslint.config.js、README.md |
| 設定（変更） | .gitignore（AI-DLC の区画の外に node_modules/・coverage/・dist/ を追記） |
| 実装 | src/data-contract/ の types.ts、messages.ts、text.ts、values.ts、category.ts、budget.ts、formula.ts、csv.ts、schema.ts、index.ts |
| テスト | src/data-contract/ の values.test.ts、category.test.ts、budget.test.ts、csv.test.ts、formula.test.ts、csv.perf.test.ts、index.test.ts、lint-config.test.ts、test-fixtures.ts（テスト専用の架空データ生成） |
| 設計文書（契約の更新） | inception/contract-design/contract-summary.md の C1 |

## テストとカバレッジ

- `npm run verify`: 成功（終了コード 0）。整形・Lint（警告 0）・型チェック・テスト・カバレッジがすべて通った。クリーンな状態からの `npm ci` の後でも通ることを開発担当が確認し、オーケストレーター側でも再実行して同じ結果を確認した（2026-10-16T09:49Z）。
- テスト: 8 ファイル・212 件がすべて合格（計画の「約45件」は観点の数。境界値の表を1件ずつ数えると 212 件）。
- 行カバレッジ: 100%（226/226）。文 99.61%、分岐 98%、関数 100%。しきい値（行 80%）は変更していない。
- decodeCsv の測定値（合格 1,000ms、目標 300ms）: 5,000 レコード 2.9ms、1行 1MB の引用付きの値 18.6ms、閉じていない引用 1MB 4.6ms。
- テスト先行の記録（実装前の失敗）:
  - Step 3: values.test.ts が `Cannot find module './values'` で失敗
  - Step 5: budget.test.ts・category.test.ts が実装なしで失敗（2 failed | 1 passed）
  - Step 7: csv.test.ts・formula.test.ts・csv.perf.test.ts が `Cannot find module './csv'` で失敗（3 failed | 3 passed）
  - 実装後、Step 8 でテストの期待値の誤り（金額列の欠落）1件をテスト側で修正した（実装の不具合ではない）
- 道具の版（正確な版で固定）: typescript 6.0.3、vitest 5.0.5、@vitest/coverage-v8 5.0.5、eslint 10.12.0、@eslint/js 10.0.1、typescript-eslint 8.71.2、globals 17.13.0、prettier 3.9.10

## 主な実装上の判断

- 契約 C1 の更新（計画どおり）: `ValidationCode` に `out-of-range-date`、`validateCsvRecord(record): Result<ValidCsvRecord, ValidationError[]>` を追加。
- 契約 C1 への計画外の追加: `CsvLine` に任意の項目 `fields?: string[]`（その行の全列のファイル上の値）を追加した。BR4.3 の「列数が5でない行もレコードとして返し、行の検証で扱う」を実現し、U6 の不正行表示（`InvalidRow.raw`）に使うため。任意の項目の追加なので契約の変更ルール上は非破壊。
- CSV の復号: 閉じた引用の直後に区切り以外の文字がある場合も malformed。単独の CR も改行として数える。引用した空の値だけの行は「完全に空の行」として飛ばさない。
- 想定外の型は例外にせず項目のエラーとして返す。メモに文字列以外が渡された場合は `{ field: "memo", code: "required", message: "メモ：文字で入力してください" }` を返す（rules.md にない文言の追加）。
- Lint 設定のテストは、ディスク上にない仮のファイルを検査するため型情報を使う解析を外し、参照禁止の規則だけを検査する。テストファイルに禁止が適用されないことも確かめている。
- tsconfig は `module: ESNext`、`moduleResolution: bundler`（`module: bundler` は存在しないため）。`skipLibCheck`・`isolatedModules` を有効化。
- 見えにくい文字（BOM・全角空白・結合用の濁点）はソース中では文字コードで書いた。

## 計画との違い

| 違い | 理由 | 確認してほしい点 |
|------|------|------------------|
| `CsvLine.fields?` の追加 | 上記のとおり BR4.3 と U6 の表示に必要 | 契約への追加として受け入れるか |
| メモの型違いの文言「メモ：文字で入力してください」の追加 | W1 の「想定外の型は該当項目の required」に従った | 文言表への追加として受け入れるか |
| テスト件数 212 件 | 境界値の表を個別に数えたため | なし |

## 残る課題

- 対象月の検証は真偽値（`isValidYearMonth`）だけで、エラー一覧を返す関数が C1 にない。U4 の予算設定で文言が必要になった場合、契約への追加を検討する。
- `npm ci` で fsevents の install script についての警告が出る（動作・検証には影響しない）。
