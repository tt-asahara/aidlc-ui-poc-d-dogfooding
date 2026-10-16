# 部品の形（ui-kit）

- 出典: `inception/contract-design/contract-summary.md`（C6）、`inception/refined-mockups/interaction-spec.md`・`design-system-mapping.md`・`accessibility-checklist.md`、`inception/domain-design/components.md`（UiKit）、`inception/domain-design/decisions.md`（ADR-005、ADR-006）、`functional-design-questions.md`（Q1）
- U2 は業務データを持たない。ここでの「エンティティ」は、部品が受け取る設定（props）と、部品が内部に持つ表示の状態である。
- 型は論理型で書く。React の具体的な書き方はコード生成で決める。

```yaml
entities:
  - name: DesignTokens
    description: 色・文字・余白・寸法・画面幅の区切りの定数（CSS 変数として1か所で定義）
    attributes:
      - { name: color, logical_type: map, required: true, constraints: [design-system-mapping.md 第1章の10色、文字は背景に対し 4.5:1 以上、部品の枠とフォーカスは 3:1 以上] }
      - { name: font, logical_type: map, required: true, constraints: [システムフォントのみ。外部フォントの読み込みなし] }
      - { name: space, logical_type: list, required: true, allowed_values: [4px, 8px, 16px, 24px, 32px, 48px] }
      - { name: targetMin, logical_type: length, required: true, default: 44px }
      - { name: motionDuration, logical_type: duration, required: true, default: 150ms, constraints: [prefers-reduced-motion のとき 0] }
      - { name: breakpoints, logical_type: map, required: true, constraints: ["narrow < 768px", "medium 768〜1023px", "wide ≥ 1024px"] }
    rules: [BR1.1, BR1.2]

  - name: ButtonProps
    attributes:
      - { name: variant, logical_type: enum, allowed_values: [primary, secondary, danger], default: secondary }
      - { name: busy, logical_type: boolean, default: false }
      - { name: busyLabel, logical_type: string, required: false, default: "処理中…" }
      - { name: disabled, logical_type: boolean, default: false }
      - { name: type, logical_type: enum, allowed_values: [button, submit], default: button }
      - { name: label, logical_type: "string または子要素", required: true }
      - { name: ariaLabel, logical_type: string, required: false }
      - { name: elementRef, logical_type: "DOM 要素への参照", required: false, constraints: [フォーカスの戻し先として使えるよう公開する（BR2.4）] }
    rules: [BR2.1, BR2.4]

  - name: FieldProps
    description: TextField・Select・RadioGroup に共通する入力欄の設定
    attributes:
      - { name: id, logical_type: string, required: true, unique: true }
      - { name: label, logical_type: string, required: true }
      - { name: value, logical_type: string, required: true }
      - { name: required, logical_type: boolean, default: false }
      - { name: hint, logical_type: string, required: false }
      - { name: error, logical_type: string, required: false }
      - { name: inputMode, logical_type: enum, allowed_values: [text, numeric], default: text }
      - { name: maxLength, logical_type: integer, required: false }
      - { name: options, logical_type: "list of {value, label}", required: "Select・RadioGroup のとき必須" }
      - { name: elementRef, logical_type: "DOM 要素への参照", required: false }
    rules: [BR3.1, BR3.2, BR3.3, BR2.4]

  - name: DataTableProps
    attributes:
      - { name: caption, logical_type: string, required: true }
      - { name: columns, logical_type: "list of {key, header, align, render}", required: true, min: 1 }
      - { name: rows, logical_type: list, required: true }
      - { name: rowKey, logical_type: "行 → string", required: true }
      - { name: busy, logical_type: boolean, default: false }
    rules: [BR4.1, BR4.2]

  - name: DialogProps
    attributes:
      - { name: open, logical_type: boolean, required: true }
      - { name: title, logical_type: string, required: true }
      - { name: role, logical_type: enum, allowed_values: [dialog, alertdialog], default: dialog }
      - { name: describedBy, logical_type: string, required: false }
      - { name: initialFocus, logical_type: "DOM 要素への参照", required: false }
      - { name: returnFocus, logical_type: "DOM 要素への参照", required: false, constraints: [省略時は開いた時点でフォーカスがあった要素] }
      - { name: onClose, logical_type: "理由（escape・cancel） → なし", required: true }
    rules: [BR5.1, BR5.2, BR5.3, BR5.4, BR5.5]

  - name: DialogState
    description: Dialog が内部に持つ状態
    attributes:
      - { name: phase, logical_type: enum, allowed_values: [closed, open], default: closed }
      - { name: openerElement, logical_type: "DOM 要素への参照", required: false, constraints: [開いた時点のフォーカス要素を記憶] }

  - name: StatusPanelProps
    attributes:
      - { name: kind, logical_type: enum, required: true, allowed_values: [loading, error, empty, unavailable, newer-version] }
      - { name: subject, logical_type: string, required: true }
      - { name: action, logical_type: "{label, onClick}", required: false }
      - { name: slowAfterMs, logical_type: integer, default: 5000, min: 0 }
    rules: [BR6.1, BR6.2]

  - name: InlineMessageProps
    attributes:
      - { name: tone, logical_type: enum, required: true, allowed_values: [success, error] }
      - { name: text, logical_type: string, required: true }
      - { name: autoHideMs, logical_type: integer, default: "success は 5000、error は自動で消えない" }
      - { name: onHidden, logical_type: "なし → なし", required: false }
    rules: [BR6.3, BR6.4]

  - name: FieldErrorProps
    attributes:
      - { name: id, logical_type: string, required: true, constraints: [入力欄の aria-describedby から参照される] }
      - { name: fieldLabel, logical_type: string, required: true }
      - { name: message, logical_type: string, required: true }
    rules: [BR3.2]

  - name: FileInputProps
    attributes:
      - { name: id, logical_type: string, required: true }
      - { name: label, logical_type: string, required: true }
      - { name: accept, logical_type: string, required: true, default: ".csv,text/csv" }
      - { name: disabled, logical_type: boolean, default: false }
      - { name: onSelect, logical_type: "File → なし", required: true }
      - { name: elementRef, logical_type: "DOM 要素への参照", required: false }
    rules: [BR7.1]

  - name: TabsProps
    attributes:
      - { name: label, logical_type: string, required: true }
      - { name: tabs, logical_type: "list of {id, label}", required: true, min: 1 }
      - { name: selectedId, logical_type: string, required: true }
      - { name: onSelect, logical_type: "id → なし", required: true }
      - { name: renderPanel, logical_type: "id → 子要素", required: true }
    rules: [BR8.1, BR8.2, BR8.3]
```

## 概要

- デザイントークン1種と、部品の設定10種（ボタン、入力欄（共通）、表、ダイアログ、状態表示、知らせ、項目のエラー、ファイル選択、タブ）、ダイアログの内部状態1種。
- 契約 C6 との差分: Button・TextField・Select・RadioGroup・FileInput に、フォーカスの戻し先として使える DOM 要素の参照（elementRef）を公開する。Contract Design のレビューで受け入れた指摘（R-09）への対応。Tabs には disabled の状態を持たせない（refined-mockups のレビュー指摘 R-05：起動時の特殊画面ではタブ自体を表示しない方針に統一）。
