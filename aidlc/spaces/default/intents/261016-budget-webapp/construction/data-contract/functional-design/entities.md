# エンティティと値の形（data-contract）

- 出典: `inception/requirements-analysis/requirements.md`（FR1.1〜FR1.6）、`inception/domain-design/components.md`（DataContract、エンティティの属性名）、`inception/contract-design/contract-summary.md`（C1）、`functional-design-questions.md`（Q1〜Q3）
- U1 はデータを持たず、収支・カテゴリ・予算・CSV 行の「形」と「値の規則」を定める（ADR-007）。データの持ち主（作成・更新・削除）は U3・U4 である。
- 型は言語に依存しない論理型で書く。規則の詳細は `rules.md` の BR 番号を参照する。

```yaml
value_types:
  - name: EntryType
    description: 収支の種別
    logical_type: enum
    allowed_values: [income, expense]
    rules: [BR1.5]
  - name: IsoDate
    description: 時刻を持たない暦日（YYYY-MM-DD）
    logical_type: string
    constraints: [実在する暦日, "2000-01-01 以上 2099-12-31 以下"]
    rules: [BR1.1]
  - name: YearMonth
    description: 対象月（YYYY-MM）
    logical_type: string
    constraints: ["2000-01 以上 2099-12 以下"]
    rules: [BR1.2]
  - name: Amount
    description: 収支の金額（円）
    logical_type: integer
    min: 1
    max: 99999999
    rules: [BR1.3]
  - name: BudgetAmount
    description: 予算額（円）
    logical_type: integer
    min: 0
    max: 99999999
    rules: [BR3.1]
  - name: Memo
    description: 収支のメモ（前後の空白を除去した後）
    logical_type: string
    min_length: 0
    max_length: 200
    length_unit: 書記素（見た目の1文字）
    rules: [BR1.4]
  - name: CategoryName
    description: カテゴリ名（前後の空白を除去した後）
    logical_type: string
    min_length: 1
    max_length: 20
    length_unit: 書記素（見た目の1文字）
    rules: [BR2.1, BR2.2]
  - name: IsoDateTime
    description: 日時（ISO 8601、オフセット付き）。登録日時・更新日時に使う
    logical_type: string
    constraints: [並べ替えは文字列ではなく時刻の値で比較する]

entities:
  - name: Transaction
    description: 1件の収入または支出（持ち主は U4 の Ledger）
    attributes:
      - { name: id, logical_type: string, required: true, unique: true, constraints: [持ち主が付与する不透明な文字列] }
      - { name: date, logical_type: IsoDate, required: true }
      - { name: type, logical_type: EntryType, required: true }
      - { name: categoryId, logical_type: string, required: true, references: Category.id }
      - { name: amount, logical_type: Amount, required: true }
      - { name: memo, logical_type: Memo, required: true, default: "" }
      - { name: createdAt, logical_type: IsoDateTime, required: true }
      - { name: updatedAt, logical_type: IsoDateTime, required: true }
    entity_constraints:
      - type はカテゴリの type と一致する（確認は U4 の書き込み処理の中で行う）
    relationships:
      - { to: Category, cardinality: "many-to-one", direction: "Transaction → Category" }

  - name: TransactionInput
    description: 画面・CSV からの未検証の入力。検証に通ると Transaction の id・日時以外の属性になる
    attributes:
      - { name: date, logical_type: string, required: true }
      - { name: type, logical_type: string, required: true }
      - { name: categoryId, logical_type: string, required: true }
      - { name: amount, logical_type: "string または integer", required: true }
      - { name: memo, logical_type: string, required: false, default: "" }

  - name: Category
    description: 収支の分類（持ち主は U4 の CategoryCatalog）
    attributes:
      - { name: id, logical_type: string, required: true, unique: true }
      - { name: type, logical_type: EntryType, required: true }
      - { name: name, logical_type: CategoryName, required: true, unique: "同じ type の中で比較キーが一意（BR2.2）" }
      - { name: sortOrder, logical_type: integer, required: true, min: 0 }
      - { name: createdAt, logical_type: IsoDateTime, required: true }
    relationships: []

  - name: Budget
    description: 支出カテゴリ・対象月ごとの予算（持ち主は U4 の BudgetPlanner）
    attributes:
      - { name: categoryId, logical_type: string, required: true, references: Category.id }
      - { name: month, logical_type: YearMonth, required: true }
      - { name: amount, logical_type: BudgetAmount, required: true }
      - { name: updatedAt, logical_type: IsoDateTime, required: true }
    entity_constraints:
      - (categoryId, month) の組で一意
      - 参照するカテゴリの type は expense
    relationships:
      - { to: Category, cardinality: "many-to-one", direction: "Budget → Category" }

  - name: CsvRecord
    description: CSV の1レコード（見出しを除く）。カテゴリは名前で表す
    attributes:
      - { name: date, logical_type: string, required: true }
      - { name: type, logical_type: string, required: true }
      - { name: category, logical_type: string, required: true }
      - { name: amount, logical_type: string, required: true }
      - { name: memo, logical_type: string, required: true, default: "" }
    entity_constraints:
      - 列の順序は date,type,category,amount,memo（BR4.1）

  - name: CsvLine
    description: 復号した CSV レコードと、その元ファイル上の行番号
    attributes:
      - { name: line, logical_type: integer, required: true, min: 2, constraints: [見出しを1行目とし、レコードが始まる物理行の番号（BR4.3）] }
      - { name: record, logical_type: CsvRecord, required: true }

  - name: ValidationError
    description: 1つの項目の検証エラー
    attributes:
      - { name: field, logical_type: enum, required: true, allowed_values: [date, type, categoryId, category, amount, memo, name, budgetAmount, month] }
      - { name: code, logical_type: enum, required: true, allowed_values: [required, invalid-date, out-of-range-date, invalid-month, not-integer, out-of-range, too-long, blank, duplicate-name, invalid-type] }
      - { name: message, logical_type: string, required: true, constraints: [日本語の表示文言（BR6.1）] }

  - name: CsvFormatError
    description: CSV 全体の形式の誤り
    attributes:
      - { name: kind, logical_type: enum, required: true, allowed_values: [empty, header-mismatch, malformed] }
      - { name: line, logical_type: integer, required: false, constraints: [malformed のとき必須] }
      - { name: found, logical_type: "list of string", required: false, constraints: [header-mismatch のとき実際の見出し] }

constants:
  - { name: SCHEMA_VERSION, value: 1, rules: [BR5.1] }
  - { name: CSV_HEADER, value: [date, type, category, amount, memo], rules: [BR4.1] }
```

## 概要

- **値の型（8種）**: 種別、日付、対象月、金額、予算額、メモ、カテゴリ名、日時。すべて `rules.md` の規則で検証・正規化される。
- **エンティティ（4種）**: 収支・カテゴリ・予算は保存されるデータの形、収支の入力は未検証の入力の形。持ち主は U4。
- **CSV の形（2種）**: CSV レコード（カテゴリは名前）と、行番号つきの CSV 行。
- **失敗の形（2種）**: 項目ごとの検証エラーと、CSV 全体の形式の誤り。
- `ValidationError.code` に `out-of-range-date` を追加した（Q2 で日付の範囲を決めたため）。契約 C1 の `ValidationCode` への追加にあたり、Contract Design の変更ルールに従い、コード生成で契約文書の型と利用者のテストを同じ変更で更新する。
