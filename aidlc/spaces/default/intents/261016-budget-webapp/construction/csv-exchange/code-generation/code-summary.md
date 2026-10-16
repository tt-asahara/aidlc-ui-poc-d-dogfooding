# コード生成のまとめ（csv-exchange）

## 作成・変更したファイル

| 区分 | ファイル |
|------|----------|
| 実装（新規） | src/csv-exchange/ の types.ts、messages.ts、fileReader.ts、categoryMatcher.ts、export.ts、preview.ts、commit.ts、index.ts |
| テスト（新規） | src/csv-exchange/ の fileReader.test.ts、categoryMatcher.test.ts、export.test.ts、preview.test.ts、commit.test.ts、index.test.ts、performance.test.ts、lint-config.test.ts、test-fixtures.ts（テスト専用） |
| 共通設定（変更） | vitest.config.ts（csv-exchange 用プロジェクト、環境 node、`src/csv-exchange/**` に行 80%）、eslint.config.js（csv-exchange 用のブロックに禁止の一覧を書き切り。import は fake-indexeddb、../storage、U1・U4 の内部ファイルを禁止）、README.md |

- U1〜U4 のソース、package.json、package-lock.json は変更していない。追加の依存はない。契約 C5 は変えていない。

## テストとカバレッジ

- `npm run verify`: 成功（終了コード 0）。開発担当の最終実行と、オーケストレーター側の再実行の両方で、47 ファイル・597 件（U1〜U4 531 件、U6 66 件）がすべて合格した。
- U6 の内訳: fileReader 9、categoryMatcher 7、export 9、preview 18、commit 8、index 6、performance 3、lint-config 6。
- 行カバレッジ: 全体 99.21%、src/data-contract 100%、src/ui-kit 100%、src/storage 98.18%、src/bookkeeping-core 100%、src/csv-exchange 100%（分岐 94%）。しきい値は下げていない。
- テストの順序: U6 は「CSV 変換のレイヤー」なので、各部品のテストを先に書き、実装の前の実行で失敗（実装ファイルがないことによる読み込みの失敗）を確かめてから実装し、合格を確かめた（fileReader 9 件、categoryMatcher 7 件、export 9 件、preview・commit・index は3ファイルとも読み込みの失敗から実装後 57 件合格）。性能と Lint の確認のテストは計画どおり Step 7 で書いた。
- 準備確認: `npx vitest run --project csv-exchange --passWithNoTests` は終了コード 0（承認済みのテストの手順は変更していないため、結果はここに記録する）。
- 必須のテスト観点: 入力エラー（不正な行、ファイル全体の6つの理由）、空データ（0件の書き出し、空・見出しのみ、取り込める行0件、確定0件）、読み込み中（delayMs）、保存失敗（確定の failWrites、プレビュー後のカテゴリの削除）。キーボード操作は画面のない U6 には該当しない。
- 性能の目安（U3 の差し替えの上。Node.js v24.18.0、darwin 25.5.0 arm64、Apple M5 Pro。`npx vitest run --project csv-exchange src/csv-exchange/performance.test.ts --reporter=verbose`）:

| 測ったもの | 判定 | 測定値 | 合格条件 |
|------------|------|--------|----------|
| parseImportFile（5,000 行、既存 5,000 件・カテゴリ 30 件） | 空回し1回の後5回の中央値 | 34.7ms | 1,000ms 以内 |
| exportTransactions（5,000 件） | 同上 | 12.0ms | 1,000ms 以内 |
| too-many-rows を返すまで（`,,,,` の行を並べた 1,048,574 バイト） | 空回し1回の後3回の中央値 | 18.2ms | 500ms 以内 |

## 主な実装上の判断

- 行の検証は security-design.md 第1章（NFR Design Q1 = A）のとおり、列の数 → U1 の検証 → カテゴリの照合の順。検証に失敗した行は照合せず、理由は U1 の文言だけ（Q2 = A）。照合は U1 の比較キー（FD Q1 = A）。
- 例外の変換は index.ts の共通の関数1つで行う。parseImportFile はファイルの読み取り・復号・件数の段階の例外を read-failed（「ファイルを読み込めませんでした」）、Book の呼び出しの段階の例外を storage（「データを読み込めませんでした」。U4 の読み取りの文言にそろえた）にする。書き出しは storage（「書き出せませんでした」）、確定は storage（「保存できませんでした」）。
- ファイルは TextDecoder（UTF-8、不正なバイト列で失敗、BOM は残して U1 の decodeCsv に任せる）で読む。
- 既存と同じ内容の判定のキーは、値の区切り文字と混ざらないよう JSON の配列にした。
- 公開窓口は3つの関数と C5 の型だけ。

## 計画との違い

| 違い | 理由 |
|------|------|
| Book の呼び出しの例外の文言「データを読み込めませんでした」を追加 | 設計に定めがなく、U4 の読み取りの失敗の文言にそろえた |
| passWithNoTests の結果を unit-test-instructions.md ではなくこのまとめに記録 | 承認済みのテストの手順を書き換えないため |
| テストの BOM を `String.fromCharCode(0xfeff)` で書く | ファイル書き込みの道具が見えない BOM の文字をそのまま埋め込んだため。ソースに BOM の文字が残っていないことを確認済み |

## 引き継ぎ

- **U7 の Build and Test へ**: 本物の IndexedDB と Chrome で、読み込みからプレビューの表示まで 2 秒以内（NFR3 の合計）、ファイル選択のキーボード操作、書き出したファイルのダウンロードと表計算ソフトでの表示（数式として実行されないこと）を確かめる。
- **U7 へ**: 取り込めない行の理由は「｛行番号｝行目：」を前に付けて表示する。確定の import-category-missing では行番号を示してファイルの選び直しを促す。名前の変更だけならプレビューの名前が古いまま取り込みが成功する。

## 残る課題

- 不安定なテスト（既存）: 全体を並列で実行すると、`src/data-contract/lint-config.test.ts`「fetch と Date の参照は違反になる」と `src/storage/lint-config.test.ts`「fetch・XMLHttpRequest・…・eval の参照は違反になる」が、ESLint の初回の読み込みで既定の 5,000ms を超えて時々失敗する。単独では約 710ms で合格、`--maxWorkers=2` では全件合格。変更前の基準の実行でも同じ2件が失敗しており既存の問題だが、eslint.config.js が大きくなるほど起きやすくなる可能性がある。一度だけ `src/bookkeeping-core/performance.test.ts`（200ms の判定）も負荷で失敗した。U1・U3 は変更禁止の範囲のため手を入れていない。U4 と同じ対処（beforeAll での事前の読み込みと 60 秒の待ち時間）を Build and Test で行うか判断が要る。
