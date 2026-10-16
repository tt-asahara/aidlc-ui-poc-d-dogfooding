# CSV 入出力の規則（csv-exchange）

- 出典: `inception/requirements-analysis/requirements.md`（FR1.5、FR6.1〜FR6.4、FR7.1〜FR7.7、NFR1、NFR8）、`inception/user-stories/stories.md`（AC6.1.1〜AC6.3.1、AC7.1.1〜AC7.4.2）、`inception/contract-design/contract-summary.md`（C1、C3、C5）、`inception/domain-design/` のレビュー（プレビュー後にカテゴリが消えた場合）、`construction/bookkeeping-core/code-generation/code-summary.md`、`functional-design-questions.md`（Q1 = A）

```yaml
rules:
  - id: BR1.1
    statement: 書き出しは、U4 から対象の収支とカテゴリを取り、U1 の encodeCsv で CSV にして Blob で返す
    category: policy
    applies_to: [exportTransactions, ExportResult]
    trigger: exportTransactions の呼び出し時
    logic: >
      book.listAllTransactions(range)（日付の古い順。月の検証も U4）と book.listCategories() を呼ぶ。各収支を
      { date, type, category: カテゴリ名, amount: 金額の10進の文字列, memo } の CsvRecord にし、encodeCsv（BOM 付き、CRLF、
      RFC 4180 の引用、数式対策）にかける。Blob（type text/csv;charset=utf-8）にして count・headerOnly と返す
    violation: U4 の OperationError をそのまま返す
    source: FR6.1, FR6.2, FR1.5, AC6.1.1, AC6.1.3, AC6.1.4

  - id: BR1.2
    statement: ファイル名は、全期間なら書き出した日の日付、月指定ならその月で決める
    category: calculation
    applies_to: [ExportResult]
    trigger: exportTransactions の呼び出し時
    logic: range が all なら budget-transactions-{today の地方時の YYYYMMDD}.csv、{ month } なら budget-transactions-{month}.csv。today の既定は現在時刻
    violation: なし
    source: FR6.1, AC6.1.1, AC6.1.2

  - id: BR1.3
    statement: 書き出す収支が0件なら、見出し行だけのファイルを作り headerOnly を true にする
    category: policy
    applies_to: [ExportResult]
    trigger: 対象の収支が0件のとき
    logic: encodeCsv([]) の結果（BOM と見出し行と CRLF）を返し、count 0、headerOnly true。文言「書き出す収支がないため見出し行のみ出力しました」は U7 が表示する
    violation: なし
    source: FR6.4, AC6.3.1

  - id: BR1.4
    statement: 数式対策（= + - @、および ' の後にそれらが続く値の先頭への '）は U1 の encodeCsv に任せ、U6 では加工しない
    category: policy
    applies_to: [exportTransactions]
    trigger: 書き出し時
    logic: CsvRecord にはアプリの値をそのまま入れる。二重に ' を付けない
    violation: なし
    source: FR6.3, AC6.2.1, AC6.2.3

  - id: BR1.5
    statement: 収支のカテゴリがカテゴリ一覧にない場合（通常は起きない）は、書き出しを止めて規則違反を返す
    category: invariant
    applies_to: [exportTransactions]
    trigger: カテゴリ名を引けない収支があるとき
    logic: 名前が空の行を作らず { kind: rule, violation: { code: category-missing } } を返す（U4 の規則上、使われているカテゴリは消せない）
    violation: rule（category-missing）
    source: FR3.4, C3

  - id: BR2.1
    statement: 1MB（1,048,576 バイト）を超えるファイルは、中身を読まずに too-large を返す
    category: validation
    applies_to: [parseImportFile]
    trigger: parseImportFile の呼び出し時（最初に確かめる）
    logic: file.size > 1048576 なら { kind: too-large, limitBytes: 1048576 }。ちょうど 1,048,576 バイトは読み込む
    violation: ImportFileError too-large
    source: FR7.6, AC7.3.3

  - id: BR2.2
    statement: ファイルは UTF-8 として読み、読めない・UTF-8 として正しくない場合は read-failed を返す
    category: validation
    applies_to: [parseImportFile]
    trigger: ファイルの読み取り時
    logic: file.arrayBuffer() を TextDecoder("utf-8", { fatal: true }) で文字列にする。読み取りの失敗は read-failed（「ファイルを読み込めませんでした」）、不正なバイト列は read-failed（「UTF-8 の CSV ファイルを選んでください」）。BOM の有無は U1 の decodeCsv が受け付ける
    violation: ImportFileError read-failed
    source: FR1.5, FR8.2, AC7.1.3

  - id: BR2.3
    statement: CSV として復号できない場合は、U1 の失敗の種類をそのまま ImportFileError にする
    category: validation
    applies_to: [parseImportFile]
    trigger: decodeCsv の失敗時
    logic: empty → empty（0バイト・空白だけ・見出し行のみ）、header-mismatch → header-mismatch、malformed（引用が閉じていない等）→ malformed（line・message）
    violation: ImportFileError empty・header-mismatch・malformed
    source: FR7.5, AC7.3.1, AC7.3.2

  - id: BR2.4
    statement: 見出しを除いたレコードが 5,000 件を超えるファイルは、プレビューを作らず too-many-rows を返す
    category: validation
    applies_to: [parseImportFile]
    trigger: 復号の後
    logic: レコードの件数（引用の中の改行で複数の物理行にまたがるレコードも1件）> 5000 なら { kind: too-many-rows, limitRows: 5000 }。ちょうど 5,000 件は進む
    violation: ImportFileError too-many-rows
    source: FR7.6, AC7.3.3

  - id: BR3.1
    statement: 列の数が5でない行は、取り込めない行にする
    category: validation
    applies_to: [InvalidRow]
    trigger: 各レコードの検証時（最初に確かめる）
    logic: CsvLine.fields の長さが 5 でなければ、reasons ["列の数が違います（5列にしてください）"] の取り込めない行にし、値の検証はしない
    violation: InvalidRow
    source: FR1.5, FR7.2

  - id: BR3.2
    statement: 各行は U1 の validateCsvRecord で検証し、失敗した項目の文言をすべて理由にする
    category: validation
    applies_to: [InvalidRow, PreviewRow]
    trigger: 各レコードの検証時
    logic: validateCsvRecord(record) が失敗したら、ValidationError の message を日付・種別・カテゴリ・金額・メモの順に reasons にする（文言は U1 のもの。例: 金額が abc なら「金額：1〜99,999,999 の整数で入力してください」）
    violation: InvalidRow
    source: FR7.3, FR1.4, AC7.1.1

  - id: BR3.3
    statement: カテゴリ名は、カテゴリ名の重複の判定と同じ比べ方で、同じ種別のカテゴリと照合する
    category: validation
    applies_to: [CategoryMatcher, PreviewRow, InvalidRow]
    trigger: 種別とカテゴリ名が U1 の検証を通った行
    logic: >
      normalizeCategoryNameForCompare(categoryName) をキーに、同じ種別のカテゴリを引く（Q1 = A）。見つかれば categoryId と現在の名前を使う。
      同じ種別にはないが別の種別にある → reasons に「カテゴリ：種別と一致しません」。どの種別にもない → 「カテゴリ：見つかりません」。
      U1 の検証で失敗した項目がある行でも、種別とカテゴリ名が検証を通っていれば照合し、理由をまとめて返す
    violation: InvalidRow
    source: FR7.3, AC7.1.2, Q1

  - id: BR3.4
    statement: すべての検証と照合を通った行を、取り込める行にする
    category: policy
    applies_to: [PreviewRow]
    trigger: 各レコードの検証の後
    logic: U1 の検証済みの値（date・type・amount・数式対策を外した memo）と、照合した categoryId・categoryName で PreviewRow を作る
    violation: なし
    source: FR7.2, FR6.3, AC6.2.2

  - id: BR3.5
    statement: 取り込めない行の raw には、ファイル上の全列の値をそのまま入れる
    category: policy
    applies_to: [InvalidRow]
    trigger: 取り込めない行を作るとき
    logic: CsvLine.fields（引用を外した後、数式対策の ' は外す前の値）を raw にする。画面での表示時のエスケープは U7 が行う
    violation: なし
    source: FR7.2, NFR8

  - id: BR3.6
    statement: 既存の収支と日付・種別・カテゴリ・金額・メモがすべて一致する取り込める行には、sameAsExisting を true にする。除外はしない
    category: calculation
    applies_to: [PreviewRow]
    trigger: プレビューの作成時
    logic: book.listAllTransactions("all") の各収支から「date|type|categoryId|amount|memo」のキーの集合を作り、取り込める行のキーが集合にあれば true。ファイルの中の行どうしの一致は見ない
    violation: なし
    source: FR7.7, AC7.4.1, AC7.4.2

  - id: BR3.7
    statement: プレビューの取り込める行・取り込めない行は、行番号の昇順に並べる
    category: calculation
    applies_to: [ImportPreview]
    trigger: プレビューの作成時
    logic: decodeCsv の順（行番号の昇順）を保つ
    violation: なし
    source: FR7.2

  - id: BR3.8
    statement: すべての行が取り込めない場合も、プレビューとして返す（取り込める行は0件）
    category: policy
    applies_to: [ImportPreview]
    trigger: 取り込める行が0件のとき
    logic: validRows を空のまま返す。確定の操作を無効にするのは U7
    violation: なし
    source: AC7.1.4

  - id: BR4.1
    statement: 確定は、取り込める行だけを U4 の importTransactions に1回で渡す
    category: policy
    applies_to: [commitImport]
    trigger: commitImport の呼び出し時
    logic: >
      validRows を行の順に { line, input: { date, type, categoryId, amount, memo } } の ImportRow にして book.importTransactions に渡し、
      結果をそのまま返す（成功は { added }）。validRows が0件なら U4 を呼ばずに { added: 0 } を返す
    violation: U4 の OperationError（validation・rule・storage・newer-version）
    source: FR7.4, AC7.2.1, AC7.2.4, AC7.4.2

  - id: BR4.2
    statement: プレビューの後に別のタブでカテゴリが消えた・変わった場合、確定は1件も追加せず import-category-missing（行番号つき）を返す
    category: policy
    applies_to: [commitImport]
    trigger: U4 の importTransactions が import-category-missing を返したとき
    logic: U4 が書き込み処理の中で確かめた結果をそのまま返す。U7 は「｛行番号｝行目のカテゴリが見つかりません。ファイルを選び直してください」と表示し、プレビューを閉じる（選び直すと最新のカテゴリで照合し直す）
    violation: rule（import-category-missing）
    source: FR7.4, C5 Q5 = A, Domain Design のレビュー

  - id: BR4.3
    statement: キャンセルでは何もしない
    category: policy
    applies_to: [ImportPreview]
    trigger: プレビューのキャンセル時
    logic: U6 は保存に触れない（プレビューは保存せず、U7 が捨てる）
    violation: なし
    source: FR7.4, AC7.2.2

  - id: BR5.1
    statement: U6 はネットワークを使わず、ファイルの読み取りはブラウザの File の操作だけで、書き出しは Blob を返すだけにする
    category: invariant
    applies_to: [exportTransactions, parseImportFile]
    trigger: すべての操作
    logic: fetch 等の通信、保存先の直接の参照を使わない。ダウンロードのための URL の作成と破棄は U7 が行う
    violation: なし
    source: FR6.2, NFR1

  - id: BR5.2
    statement: U6 の操作は例外を投げない
    category: invariant
    applies_to: [exportTransactions, parseImportFile, commitImport]
    trigger: すべての操作
    logic: 想定外の例外は、読み込みでは read-failed、書き出し・確定では { kind: storage, message } にする
    violation: なし
    source: 契約の共通の決まり, FR8.2, FR8.3
```

## 規則の要約

| 範囲 | 規則 |
|------|------|
| 書き出し | BR1.1〜BR1.5 |
| ファイルの確認 | BR2.1〜BR2.4 |
| 行の検証とプレビュー | BR3.1〜BR3.8 |
| 確定 | BR4.1〜BR4.3 |
| 共通 | BR5.1、BR5.2 |

## 解釈の記録

- AC7.1.1 の例文「3行目：金額が数値ではありません」は、表示の形（行番号と理由）を示す例と解釈し、理由の文言は U1 の承認済みの文言（「金額：1〜99,999,999 の整数で入力してください」）を使う。画面入力と CSV で同じ検証関数・同じ文言を使う（FR1.4）ことを優先した。
