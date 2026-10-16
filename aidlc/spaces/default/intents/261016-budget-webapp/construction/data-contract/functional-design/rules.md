# 業務規則（data-contract）

- 出典: `inception/requirements-analysis/requirements.md`（FR1.1〜FR1.6、FR6.3、NFR5、NFR8）、`inception/user-stories/stories.md`（US1.1、US6.2）、`inception/contract-design/contract-summary.md`（C1）、`inception/domain-design/decisions.md`（ADR-005）、`functional-design-questions.md`（Q1〜Q3）
- すべての規則は純粋な判定・変換として実装し、画面入力と CSV 読み込みで同じものを使う（FR1.4）。

```yaml
rules:
  - id: BR1.1
    statement: 日付は YYYY-MM-DD 形式の実在する暦日で、2000-01-01 以上 2099-12-31 以下とする
    category: validation
    applies_to: [TransactionInput.date, CsvRecord.date]
    trigger: 収支の入力・CSV 行の検証時
    logic: >
      IF 前後の空白を除いた値が空 THEN required。
      ELSE IF 4桁-2桁-2桁の半角数字の形でない、または月が1〜12でない、または日がその月に存在しない（うるう年を考慮）THEN invalid-date。
      ELSE IF 2000-01-01 より前または 2099-12-31 より後 THEN out-of-range-date。
      ELSE 受け付ける（値は変えない）
    violation: 「日付：存在する日付を YYYY-MM-DD で入力してください」／「日付：2000-01-01〜2099-12-31 の日付を入力してください」／「日付を入力してください」
    source: FR1.1, ADR-005, Q2

  - id: BR1.2
    statement: 対象月は YYYY-MM 形式で、2000-01 以上 2099-12 以下とする
    category: validation
    applies_to: [YearMonth]
    trigger: 予算の設定・集計・書き出しの対象月を受け取るとき
    logic: IF 4桁-2桁の半角数字で月が1〜12、かつ範囲内 THEN 受け付ける ELSE invalid-month
    violation: 「対象月：YYYY-MM の形で 2000-01〜2099-12 を指定してください」
    source: FR1.3, Q2

  - id: BR1.3
    statement: 金額は正規化した後、1〜99,999,999 の整数とする
    category: validation
    applies_to: [TransactionInput.amount, CsvRecord.amount]
    trigger: 収支の入力・CSV 行の検証時
    logic: >
      数値で渡された場合はそのまま整数かを判定する。文字列の場合は、前後の空白を除き、全角数字を半角に、
      全角カンマを半角に直し、カンマをすべて取り除く。
      IF 空 THEN required。ELSE IF 半角数字だけで構成されていない（小数点、マイナス、¥、円、その他の文字を含む）THEN not-integer。
      ELSE IF 1 未満または 99,999,999 を超える THEN out-of-range。ELSE 整数として受け付ける
    violation: 「金額を入力してください」／「金額：1〜99,999,999 の整数で入力してください」
    source: FR1.1, NFR5, Q1

  - id: BR1.4
    statement: メモは前後の空白を除いた後、0〜200 文字（書記素で数える）とする
    category: validation
    applies_to: [TransactionInput.memo, CsvRecord.memo]
    trigger: 収支の入力・CSV 行の検証時
    logic: IF 前後の空白を除いた値の書記素の数が 200 を超える THEN too-long ELSE 除去後の値を受け付ける（未指定は空文字）
    violation: 「メモ：200文字以内で入力してください」
    source: FR1.1

  - id: BR1.5
    statement: 種別は income または expense とする。CSV 読み込みでは「収入」「支出」も受け付ける
    category: validation
    applies_to: [TransactionInput.type, CsvRecord.type]
    trigger: 収支の入力・CSV 行の検証時
    logic: >
      前後の空白を除き、英字は小文字に直す。IF income または 収入 THEN income。
      ELSE IF expense または 支出 THEN expense。ELSE IF 空 THEN required。ELSE invalid-type
    violation: 「種別：income（収入）か expense（支出）を指定してください」
    source: FR1.1, FR1.5, Q3

  - id: BR1.6
    statement: 収支の必須項目は日付・種別・カテゴリ・金額で、メモは任意とする
    category: validation
    applies_to: [TransactionInput, CsvRecord]
    trigger: 収支の入力・CSV 行の検証時
    logic: IF カテゴリ（id または名前）が空 THEN required。他の必須項目は BR1.1・BR1.3・BR1.5 の required に従う
    violation: 「カテゴリを選んでください」（CSV では「カテゴリを指定してください」）
    source: FR1.1, FR2.2

  - id: BR1.7
    statement: 検証は全項目について行い、見つかったエラーをすべて画面上の項目順（日付、種別、カテゴリ、金額、メモ）で返す
    category: policy
    applies_to: [TransactionInput]
    trigger: 収支の入力の検証時
    logic: 1つ目のエラーで止めず、全項目を判定してエラー一覧を返す。エラーが1件でもあれば保存しない
    violation: エラー一覧を返す（画面は最初のエラー項目へフォーカスを移す）
    source: FR2.2, FR9.4

  - id: BR2.1
    statement: カテゴリ名は前後の空白を除いた後、1〜20 文字（書記素で数える）とする
    category: validation
    applies_to: [CategoryName]
    trigger: カテゴリの追加・名前変更時
    logic: IF 除去後が空 THEN blank。ELSE IF 書記素の数が 20 を超える THEN too-long。ELSE 除去後の値を受け付ける
    violation: 「カテゴリ名を入力してください」／「カテゴリ名：20文字以内で入力してください」
    source: FR1.2, FR3.2

  - id: BR2.2
    statement: 同じ種別の中で、比較キーが同じカテゴリ名は重複とする
    category: constraint
    applies_to: [Category.name]
    trigger: カテゴリの追加・名前変更時（名前変更では自分自身を除いて比較する）
    logic: >
      比較キー＝前後の空白を除き、Unicode 互換正規化（NFKC）で全角英数を半角に直し、英字を小文字にした文字列。
      IF 同じ種別に同じ比較キーのカテゴリがある THEN duplicate-name。種別が違えば重複としない
    violation: 「カテゴリ名：同じ種別に同じ名前があります」
    source: FR1.2, AC1.1.3, AC3.2.2

  - id: BR3.1
    statement: 予算額は BR1.3 と同じ正規化の後、0〜99,999,999 の整数とする
    category: validation
    applies_to: [BudgetAmount]
    trigger: 予算の設定時
    logic: BR1.3 と同じ正規化と判定を行い、下限だけを 0 とする。0 は「0円の予算」として受け付ける（未設定とは区別する）
    violation: 「予算額を入力してください」／「予算額：0〜99,999,999 の整数で入力してください」
    source: FR1.3, FR4.1, FR4.2

  - id: BR4.1
    statement: CSV の見出し行は date,type,category,amount,memo と完全に一致する
    category: validation
    applies_to: [CSV ファイル]
    trigger: CSV の復号時
    logic: 先頭の BOM を除き、1行目を列に分け、各列の前後の空白を除いた値が見出しと順序どおり完全一致（英小文字）するか判定する。IF 一致しない THEN header-mismatch
    violation: CsvFormatError header-mismatch（実際の見出しを添える）
    source: FR1.5, FR7.5

  - id: BR4.2
    statement: CSV の書き出しは UTF-8（BOM 付き）、改行 CRLF、RFC 4180 の引用規則に従う
    category: policy
    applies_to: [CsvRecord の並び]
    trigger: CSV の符号化時
    logic: >
      先頭に BOM、1行目に見出し、以降1レコード1行。各値は BR4.5 を適用した後、カンマ・ダブルクォート・CR・LF・
      前後の空白を含む場合はダブルクォートで囲み、内部のダブルクォートは2つ重ねる。行の区切りは CRLF。最終行の後にも CRLF を付ける
    violation: なし（符号化は失敗しない）
    source: FR1.5, AC6.1.3, AC6.1.4

  - id: BR4.3
    statement: CSV の読み込みは BOM の有無と CRLF・LF の改行を受け付け、引用内の改行を含む値を1つの値として復号する
    category: policy
    applies_to: [CSV ファイル]
    trigger: CSV の復号時
    logic: >
      先頭の BOM を除く。RFC 4180 に従い列と行に分ける（引用内のカンマ・改行・重ねたダブルクォートは値の一部）。
      各レコードの行番号は、見出しを1行目とし、そのレコードが始まる物理行の番号とする。
      完全に空の行（値が1つもない行）は飛ばす。引用が閉じないまま終わった場合は malformed（引用が始まった行番号）とする。
      列数が5でないレコードはレコードとしては返し、列の不足・過剰は行の検証で扱う
    violation: CsvFormatError malformed（行番号つき）
    source: FR1.5, FR7.2, AC7.1.3

  - id: BR4.4
    statement: 0 バイトのファイルと、見出し行だけのファイルは「データなし」とし、読み込みの失敗と区別する
    category: policy
    applies_to: [CSV ファイル]
    trigger: CSV の復号時
    logic: IF BOM と空白を除いて内容が空、または見出し行の後にレコードが1件もない THEN empty
    violation: CsvFormatError empty
    source: FR7.5, AC7.3.2

  - id: BR4.5
    statement: 書き出す文字列の値が表計算ソフトで数式として解釈されないよう、先頭にシングルクォートを1つ付ける
    category: policy
    applies_to: [CsvRecord.category, CsvRecord.memo]
    trigger: CSV の符号化時
    logic: >
      IF 値が = + - @ のいずれかで始まる THEN 先頭に ' を付ける。
      ELSE IF 値が ' で始まり、2文字目が = + - @ ' のいずれか THEN 先頭に ' を付ける。
      ELSE 変えない
    violation: なし
    source: FR6.3, NFR8, AC6.2.1, AC6.2.3

  - id: BR4.6
    statement: 読み込んだ文字列の値から、BR4.5 で付けたシングルクォートを1つ外し、書き出し前の値に戻す
    category: policy
    applies_to: [CsvRecord.category, CsvRecord.memo]
    trigger: CSV の復号時
    logic: >
      IF 値が ' で始まり、その後ろの文字列が = + - @ ' のいずれかで始まる THEN 先頭の ' を1つ外す。ELSE 変えない。
      この規則により、どの値も「書き出し → 読み込み」で元に戻る（例：=SUM(A1) → '=SUM(A1) → =SUM(A1)、'=1 → ''=1 → '=1、'abc → 'abc → 'abc）
    violation: なし
    source: FR6.3, AC6.2.2, AC6.2.3

  - id: BR4.7
    statement: CSV の金額列・種別列・日付列は、画面入力と同じ規則（BR1.1、BR1.3、BR1.5）で検証する
    category: validation
    applies_to: [CsvRecord]
    trigger: CSV 行の検証時
    logic: CSV 行の各列を TransactionInput と同じ規則で検証する。カテゴリ名からの id の解決とカテゴリの存在確認は U6・U4 が行う
    violation: 行ごとの ValidationError 一覧
    source: FR1.4, FR7.3

  - id: BR5.1
    statement: 保存スキーマの版は整数で、初版は 1 とする
    category: constraint
    applies_to: [SCHEMA_VERSION]
    trigger: 保存領域を開くとき（U3 が参照）
    logic: 版を上げるのはデータの形を変える変更のときだけ。U3 は保存データの版がこれより大きければ「新しい版」とする
    violation: なし（判定は U3）
    source: FR1.6, AC1.2.3

  - id: BR6.1
    statement: 検証エラーの文言は「項目名：直し方」の日本語とし、画面と CSV で同じ文言を使う
    category: policy
    applies_to: [ValidationError.message]
    trigger: 検証エラーを返すとき
    logic: 各規則の violation に書いた文言を使う。CSV の取り込みでは、この文言を行番号と組み合わせて表示する（組み合わせは U6）
    violation: なし
    source: FR1.4, FR2.2, NFR2
```

## 規則の概要

| ID | 種類 | 内容 |
|----|------|------|
| BR1.1 | 検証 | 日付は実在する暦日、2000-01-01〜2099-12-31 |
| BR1.2 | 検証 | 対象月は YYYY-MM、2000-01〜2099-12 |
| BR1.3 | 検証 | 金額は全角数字・カンマを正規化して 1〜99,999,999 の整数 |
| BR1.4 | 検証 | メモは前後空白除去後 0〜200 文字 |
| BR1.5 | 検証 | 種別は income / expense（CSV では 収入 / 支出 も可、大小文字は区別しない） |
| BR1.6 | 検証 | 必須は日付・種別・カテゴリ・金額 |
| BR1.7 | 方針 | 全項目を検証し、エラーを画面の項目順で返す |
| BR2.1 | 検証 | カテゴリ名は前後空白除去後 1〜20 文字 |
| BR2.2 | 制約 | 同じ種別で比較キー（NFKC・小文字）が同じなら重複 |
| BR3.1 | 検証 | 予算額は 0〜99,999,999 の整数（0円と未設定は別） |
| BR4.1 | 検証 | CSV 見出しは date,type,category,amount,memo と完全一致 |
| BR4.2 | 方針 | 書き出しは BOM 付き UTF-8・CRLF・RFC 4180 |
| BR4.3 | 方針 | 読み込みは BOM 有無・CRLF/LF・引用内改行を受け付け、行番号はレコードの開始行 |
| BR4.4 | 方針 | 0 バイト・見出しのみは「データなし」 |
| BR4.5 | 方針 | 書き出し時の数式対策（先頭に ' を1つ） |
| BR4.6 | 方針 | 読み込み時に数式対策の ' を1つ外し、往復で値が戻る |
| BR4.7 | 検証 | CSV の各列は画面入力と同じ規則で検証 |
| BR5.1 | 制約 | 保存スキーマの版は 1 から始まる整数 |
| BR6.1 | 方針 | エラー文言は「項目名：直し方」で画面と CSV 共通 |
