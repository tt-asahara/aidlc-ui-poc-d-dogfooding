# CSV 入出力の形（csv-exchange）

- 出典: `inception/contract-design/contract-summary.md`（C1、C3、C5）、`inception/domain-design/components.md`（CsvExchange）、`inception/requirements-analysis/requirements.md`（FR1.5、FR6.1〜FR6.4、FR7.1〜FR7.7）、`inception/user-stories/stories.md`（US6.1〜US6.3、US7.1〜US7.4）、`construction/bookkeeping-core/code-generation/code-summary.md`（U4 からの引き継ぎ）、`functional-design-questions.md`（Q1 = A）
- U6 はデータを持たない。CSV の符号化・復号・1行の検証は U1（C1）、収支・カテゴリの取得と一括追加は U4（C3）が行い、U6 はその間をつなぐ。ファイルの読み取りと生成はブラウザ内だけで行う。

```yaml
entities:
  - name: ExportResult
    description: 書き出しの結果（C5）。ダウンロードの操作は U7 が行う
    attributes:
      - { name: fileName, logical_type: string, required: true, constraints: ["全期間は budget-transactions-YYYYMMDD.csv（today の地方時の日付）、月指定は budget-transactions-YYYY-MM.csv"] }
      - { name: blob, logical_type: Blob, required: true, constraints: ["type は text/csv;charset=utf-8。中身は U1 の encodeCsv の結果（BOM 付き、CRLF）"] }
      - { name: count, logical_type: integer, required: true, min: 0 }
      - { name: headerOnly, logical_type: boolean, required: true, constraints: [count が 0 のとき true] }
    rules: [BR1.1, BR1.2, BR1.3, BR1.4]

  - name: ImportFileError
    description: ファイル全体を読み込まない理由（C5）
    attributes:
      - { name: kind, logical_type: enum, required: true, allowed_values: [too-large, too-many-rows, empty, header-mismatch, malformed, read-failed] }
    rules: [BR2.1, BR2.2, BR2.3, BR2.4]

  - name: PreviewRow
    description: 取り込める行（C5）。値は U1 の検証を通った値、カテゴリは照合した id と現在の名前
    attributes:
      - { name: line, logical_type: integer, required: true, min: 2, constraints: [見出しを1行目とした、レコードが始まる元ファイルの行番号] }
      - { name: date, logical_type: IsoDate, required: true }
      - { name: type, logical_type: EntryType, required: true }
      - { name: categoryId, logical_type: string, required: true }
      - { name: categoryName, logical_type: string, required: true, constraints: [アプリ側の現在のカテゴリ名（CSV の表記ではない）] }
      - { name: amount, logical_type: integer, required: true, min: 1, max: 99999999 }
      - { name: memo, logical_type: string, required: true, constraints: [数式対策の ' を外した後の値] }
      - { name: sameAsExisting, logical_type: boolean, required: true, constraints: [既存の収支と日付・種別・カテゴリ・金額・メモがすべて一致] }
    rules: [BR3.2, BR3.3, BR3.4, BR3.6]

  - name: InvalidRow
    description: 取り込めない行（C5）。表示時は U7 がエスケープする
    attributes:
      - { name: line, logical_type: integer, required: true, min: 2 }
      - { name: reasons, logical_type: "list of string", required: true, constraints: [1件以上。固定の日本語の文言で、入力値を埋め込まない。U7 が「｛line｝行目：」を前に付けて表示する] }
      - { name: raw, logical_type: "list of string", required: true, constraints: [ファイル上の全列の値（CsvLine.fields）] }
    rules: [BR3.1, BR3.2, BR3.3, BR3.5]

  - name: ImportPreview
    description: 取り込みの確認の内容（C5）。U7 が表示し、確定またはキャンセルする
    attributes:
      - { name: fileName, logical_type: string, required: true }
      - { name: validRows, logical_type: "list of PreviewRow", required: true, constraints: [行番号の昇順。0件もありうる（AC7.1.4）] }
      - { name: invalidRows, logical_type: "list of InvalidRow", required: true, constraints: [行番号の昇順] }
    rules: [BR3.7, BR3.8]

  - name: CategoryMatcher
    description: CSV のカテゴリ名からカテゴリを引く表（U6 の内部）。U1 の normalizeCategoryNameForCompare の値をキーにする（Q1 = A）
    attributes:
      - { name: byType, logical_type: "Map<EntryType, Map<string, Category>>", required: true, constraints: [同じ種別の中では比較キーが重複しない（U1・U4 の重複の規則）] }
      - { name: anyType, logical_type: "Map<string, EntryType[]>", required: true, constraints: [種別の不一致の判定に使う] }
    rules: [BR3.3]
```

## 契約 C5 との差分

- なし。照合の比べ方（Q1 = A）と取り込めない行の理由の文言は U6 の内部の規則で、窓口の型は変えない。
