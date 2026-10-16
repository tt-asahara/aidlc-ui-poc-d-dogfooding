# 安全性と信頼性の設計（csv-exchange）

- 出典: `construction/csv-exchange/nfr-requirements/security-requirements.md`（NFR1.1、NFR4.1〜NFR4.3、NFR8.1〜NFR8.4）、`construction/csv-exchange/nfr-requirements/tech-stack-decisions.md`（NFR3.1、NFR3.2、NFR6.1〜NFR6.3、NFR9.1）、`construction/csv-exchange/functional-design/`（rules.md BR1.1〜BR5.2、functional-spec.md W1〜W3）、`inception/contract-design/contract-summary.md`（C1、C3、C5）、`nfr-design-questions.md`（Q1 = A、Q2 = A）、Functional Design のレビュー（Major 1・Minor 4）と NFR Requirements のレビュー（Major 1・Minor 4）
- U6 は種類 library。CSV の値は信用できない入力として扱い、U1 の検証を通った値だけを U4 に渡す。

## 1. 行の検証とカテゴリの照合（Q1 = A、Q2 = A）

この節は Functional Design の BR3.3 の最後の文（「U1 の検証で失敗した項目がある行でも…照合し、理由をまとめて返す」）と W2 の手順を置き換える。コード生成はこの節に従う。

```text
for each CsvLine（行番号の昇順）:
  if fields.length != 5        → invalid: ["列の数が違います（5列にしてください）"]（BR3.1）
  v = validateCsvRecord(record)
  if !v.ok                     → invalid: v.error の message を順に（BR3.2）。カテゴリの照合はしない（Q1 = A）
  c = matcher.find(v.value.type, normalizeCategoryNameForCompare(v.value.categoryName))
  if c なし:
    別の種別にある → invalid: ["カテゴリ：種別と一致しません"]
    どこにもない   → invalid: ["カテゴリ：見つかりません"]
  else → valid（categoryId = c.id、categoryName = c.name）
```

- 値の検証に失敗した行の理由は U1 の文言だけで、カテゴリの理由は出ない。値を直して読み込み直すと、必要ならカテゴリの理由が出る（Q1 = A）。
- 理由の文言は U1 の ValidationError.message をそのまま使う。U7 は「｛行番号｝行目：」を前に付けて表示する（例: 「3行目：金額：1〜99,999,999 の整数で入力してください」）。AC7.1.1 の例文は表示の形の例として扱う（Q2 = A）。
- 照合表（CategoryMatcher）は、U4 の listCategories の結果から1回だけ作る。種別ごとに比較キー → カテゴリ、比較キー → 種別の一覧を持つ。

## 2. ファイル全体の確認（NFR4.2、NFR4.3）

| 順 | 確認 | 結果の型（C5 のまま） |
|----|------|----------------------|
| 1 | file.size > 1,048,576 | `{ kind: "too-large"; limitBytes: 1048576 }`（中身を読まない） |
| 2 | arrayBuffer の失敗 | `{ kind: "read-failed"; message: "ファイルを読み込めませんでした" }` |
| 3 | UTF-8 として正しくない | `{ kind: "read-failed"; message: "UTF-8 の CSV ファイルを選んでください" }` |
| 4 | decodeCsv の empty | `{ kind: "empty" }` |
| 5 | decodeCsv の header-mismatch | `{ kind: "header-mismatch" }` |
| 6 | decodeCsv の malformed | `{ kind: "malformed"; line: number; message: string }`（message は U1 の文言） |
| 7 | レコードが 5,000 件を超える | `{ kind: "too-many-rows"; limitRows: 5000 }`（復号の後に判定。行ごとの検証とプレビューは作らない） |

- 5,000 件超えは復号の後で断る（1MB 以内でも短い行が多いファイルは全体を一度走査する）。その最悪の時間を 4.3 節で測る（NFR Requirements レビュー Minor）。
- U4 の listCategories・listAllTransactions の失敗は OperationError をそのまま返す。

## 3. 確定とプレビュー後の変化（NFR4.1、BR4.2）

- 確定は U4 の importTransactions の1回だけ。U4 が書き込み処理の中でカテゴリを確かめる。
- プレビューの後に別のタブでカテゴリが**消えた**場合は import-category-missing（行番号つき）で、1件も追加されない。カテゴリの**名前が変わった**だけの場合は categoryId が残るため取り込みは成功し、プレビューに出ていた名前だけが古い表示になる（FD レビュー Minor：BR4.2 の「変わった」をこの意味に読み替える）。

## 4. 例外と失敗（NFR4.3、BR5.2）

- U6 の3つの操作は、全体を包んで例外を外に出さない。想定外の例外は、parseImportFile では `{ kind: "read-failed"; message: "ファイルを読み込めませんでした" }`、exportTransactions・commitImport では `{ kind: "storage"; message: "保存できませんでした" }`（書き出しは「書き出せませんでした」）。
- テストで、arrayBuffer が reject する File と、例外を投げる Book の差し替えを使い、それぞれの変換を確かめる（NFR Requirements レビュー Minor）。

## 5. 外部に出さないこと（NFR1.1、NFR8.1〜NFR8.4）

eslint.config.js に `src/csv-exchange/**/*.ts`（`*.test.ts` と `test-fixtures.ts` を除く）向けのブロックを加え、禁止の一覧をこのブロックに書き切る（フラット設定では別のブロックの指定は合成されない）。

| 規則 | 禁止するもの |
|------|--------------|
| no-restricted-globals | fetch、XMLHttpRequest、WebSocket、EventSource、indexedDB、localStorage、sessionStorage、eval |
| no-restricted-properties | navigator.sendBeacon、window・globalThis・self の fetch・XMLHttpRequest・WebSocket・EventSource・indexedDB・localStorage・sessionStorage、document.cookie |
| no-new-func、no-eval | new Function、eval の呼び出し |
| no-restricted-imports | `fake-indexeddb` とその下位のパス、`../storage` とその下位のパス（U6 が使うのは U1 と U4 の公開窓口だけ） |

- U6 は HTML を組み立てない。取り込めない行の raw はファイル上の値のまま返し、表示時のエスケープは U7。
- テストデータは架空の名前・金額だけを使う。

## 6. テストの設計（NFR3.1、NFR3.2、NFR6.1〜NFR6.3、NFR9.1）

### 6.1 構成

- vitest.config.ts に csv-exchange 用のプロジェクト（名前 `csv-exchange`、環境 node、`src/csv-exchange/**/*.test.ts`）を加え、`src/csv-exchange/**` に行カバレッジ 80% のしきい値を設ける。
- Book は U4 の openBook に U3 の createMemoryStorage を渡して作る。File・Blob は Node.js 24 の組み込みを使う。偽のタイマーは使わない。
- テストを先に書いて失敗を確かめてから実装する（U6 は「CSV 変換のレイヤー」）。追加の依存はない。

### 6.2 必須のテスト観点

| 観点 | この Unit のテスト |
|------|------------------|
| 入力エラー | 列の数、値の検証の失敗（理由は U1 の文言のみ）、カテゴリが見つからない・種別と一致しない、ファイル全体の6つの理由 |
| 空データ | 収支0件の書き出し（見出しのみ）、0バイト・見出しのみのファイル、取り込める行0件のプレビュー、確定0件 |
| 読み込み中 | 差し替えの delayMs の間はプレビューが未完了 |
| 保存失敗 | 確定の failWrites で1件も増えない、プレビュー後にカテゴリを消してからの確定 |
| 境界値 | 1,048,576 バイトと 1 バイト超え、5,000 件と 5,001 件、引用の中の改行を含むレコードの件数 |
| 往復 | 書き出したファイルを空のアプリに取り込むと同じ内容（AC7.2.4）、数式対策とカンマ・ダブルクォート・改行の往復 |
| 例外 | 4章の変換 |

### 6.3 性能の確かめ方

fake-indexeddb ではなく U3 の差し替えの上で測る。値は U6 の層の大きな遅れを見つけるための目安で、要件 NFR3 の「読み込みからプレビューの表示まで 2 秒」の合計（本物の IndexedDB と Chrome）は U7 の Build and Test で確かめる。測定値と実行環境（Node.js のバージョン、OS、CPU）をテストの出力に記録する。

| 測るもの | 前提 | 判定 | 合格条件 |
|----------|------|------|----------|
| parseImportFile | 架空の収支 5,000 行の CSV、既存の収支 5,000 件・カテゴリ 30 件 | 空回し1回の後に5回の中央値 | 1,000ms 以内 |
| exportTransactions | 収支 5,000 件 | 同上 | 1,000ms 以内 |
| too-many-rows を返すまで | 1MB に近い、最小の行を並べた CSV | 1回 | 500ms 以内 |
