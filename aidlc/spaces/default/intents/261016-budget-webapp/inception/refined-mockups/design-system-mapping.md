# デザインシステムの対応表

- 方針（Q4 = A）: 外部の部品ライブラリは使わない。標準の HTML 要素を React で包んだ自前の最小限の部品と、CSS 変数（デザイントークン）で見た目を揃える。
- 外部資源の禁止（NFR1、C4）: Web フォント、アイコンフォント、CDN の CSS・画像は使わない。文字はシステムフォント、アイコンは Unicode の記号（✓ ⚠ ⏳ ▲ ◀ ▶）を文字として使い、意味は必ず文字でも示す。
- 既存のデザインシステムはない（新規開発）。

## 1. デザイントークン

### 色

| トークン | 値 | 用途 | コントラスト（背景 `--color-bg` #FFFFFF に対して） |
|----------|----|------|------|
| `--color-bg` | #FFFFFF | 画面背景 | — |
| `--color-surface` | #F5F6F8 | 表の見出し、パネル背景 | — |
| `--color-text` | #1F2328 | 本文 | 15.8:1 |
| `--color-text-muted` | #57606A | 補足文、凡例 | 6.4:1 |
| `--color-border` | #8C959F | 入力欄・表の罫線（UI 部品） | 3.0:1 |
| `--color-primary` | #0B5CAD | 主ボタンの背景、リンク、選択中タブの下線 | 6.7:1（ボタンの白文字は 6.7:1） |
| `--color-focus` | #0B5CAD | フォーカスリング（2px 実線＋2px 余白） | 6.7:1 |
| `--color-danger` | #B3261E | 削除ボタン、エラー文の記号と枠 | 6.5:1 |
| `--color-success` | #1A7F37 | 成功メッセージの記号 | 5.1:1 |
| `--color-warning-bg` | #FFF4E5 | 警告パネルの背景（文字は `--color-text`） | 文字 15.0:1 |

- 値は実装時に自動のコントラスト検査（NFR2）で確かめる。上の比は設計時の目安であり、検査結果が優先する。
- 状態は色だけで示さない。超過は「▲ 超過」、赤字は「−」＋「（赤字）」、エラーは「⚠」＋文、成功は「✓」＋文。

### 文字

| トークン | 値 | 用途 |
|----------|----|------|
| `--font-family` | `system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Noto Sans JP", sans-serif`（端末に入っているものだけを使い、読み込みはしない） | 全体 |
| `--font-size-base` | 1rem（16px） | 本文、入力 |
| `--font-size-small` | 0.875rem | 補足、凡例 |
| `--font-size-h1` | 1.5rem | アプリ名 |
| `--font-size-h2` | 1.25rem | 画面の見出し |
| `--font-variant-numeric` | `tabular-nums` | 金額（桁を揃える） |

### 余白と寸法

| トークン | 値 | 用途 |
|----------|----|------|
| `--space-1`〜`--space-6` | 4 / 8 / 16 / 24 / 32 / 48px | 余白の段階 |
| `--target-min` | 44px | ボタン・入力欄の最小の高さと幅 |
| `--radius` | 4px | ボタン・入力欄・パネルの角丸 |
| `--dialog-width` | 480px（確認）／720px（プレビュー） | ダイアログ幅 |
| `--motion-duration` | 150ms（`prefers-reduced-motion` で 0） | 状態変化の動き |

### 画面幅の区切り

| トークン | 値 |
|----------|----|
| `--bp-narrow` | 768px 未満 |
| `--bp-medium` | 768〜1023px |
| `--bp-wide` | 1024px 以上（基準） |

## 2. 部品と HTML 要素の対応

| 設計上の部品（interaction-spec.md） | 使う標準要素 | 自前の基本部品 |
|------|------|------|
| TabNav | `div[role=tablist]`＋`button[role=tab]`＋`section[role=tabpanel]` | Tabs |
| MonthNavigator | `button`×2＋`h2`/`output` | Button |
| TransactionForm | `form`、`label`、`input[type=date]`、`fieldset`＋`input[type=radio]`、`select`、`input[inputmode=numeric]`、`input[type=text]` | TextField、RadioGroup、Select、Button、FieldError |
| TransactionList | `table`、`caption`、`th[scope=col]` | DataTable、Button |
| ConfirmDialog | `dialog` 要素（`showModal()`。背景は `inert`） | Dialog、Button |
| StatusPanel | `div[role=status]` / `div[role=alert]` | StatusPanel |
| 成功・失敗の知らせ | `p[aria-live=polite]` / `p[role=alert]` | InlineMessage |
| SummaryCards | `dl` | — |
| CategoryBudgetTable / IncomeCategoryTable | `table` | DataTable |
| BudgetEditor | `table`、`input[inputmode=numeric]` | DataTable、TextField、Button |
| CategoryManager | `form`、`table` | TextField、RadioGroup、DataTable、Button |
| CsvExportPanel | `fieldset`＋ラジオ、`select`、`button` | RadioGroup、Select、Button |
| CsvImportPanel | `label`＋`input[type=file]` | FileInput |
| ImportPreviewDialog | `dialog`、`table` | Dialog、DataTable、Button |

## 3. 基本部品の種類

| 基本部品 | 種類・状態 |
|----------|------------|
| Button | 主（`--color-primary` 背景）／副（枠線）／危険（`--color-danger` 枠線＋文字）。状態: 通常・フォーカス・無効・処理中（文言を「〜中…」に変える） |
| TextField | ラベル（上）・入力・補足・エラー（下）。エラー時は枠を 2px にし、「⚠」と文で示す |
| Select / RadioGroup | ネイティブ要素のまま使い、見た目だけ揃える |
| DataTable | 金額列は右寄せ・`tabular-nums`。768px 未満では各行を見出し付きカードに変える |
| Dialog | ネイティブ `dialog` 要素。Esc で閉じる。開閉時のフォーカス移動は interaction-spec.md の各部品に従う |
| StatusPanel / InlineMessage | 種類ごとの記号＋文。記号は `aria-hidden="true"` |
| FieldError | 「⚠ 項目名：直し方」。入力欄から `aria-describedby` で参照される |

## 4. 文言の決まり

- 金額は「1,200円」のように3桁区切り＋「円」。表の見出しに「(円)」があるときは数値のみ。
- 日付は一覧で「10/01」、ダイアログや確認文では「2026-10-01」。
- ボタンは動詞で終える（「登録する」「削除する」「取り込む」）。確定ボタンは対象の件数を含める（「3件を取り込む」）。
- エラー文は「何が」「どう直すか」を含める（「金額：1〜99,999,999 の整数で入力してください」）。
