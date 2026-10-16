# 操作仕様（Interaction Specification）

- 出典: `mockups.md`、`inception/user-stories/stories.md`、`inception/requirements-analysis/requirements.md`、`refined-mockups-questions.md`
- 部品ごとの仕様は `.claude/knowledge/aidlc-design-agent/component-spec-template.md` の形式に従う。React コンポーネント名は設計上の呼び名であり、実装時の名前は Functional Design・Code Generation で確定する。
- 画面幅の区切りは mockups.md 第2章（1024px 以上／768〜1023px／768px 未満）。

## 1. 共通の振る舞い

| 項目 | 規則 | 出典 |
|------|------|------|
| 対象月 | 収支・月次集計・予算のタブで1つの対象月を共有する。初期値は今月（ブラウザのローカル日付） | FR5.1、A2 |
| 保存中 | 保存操作のボタンを無効にし、ボタンの文言を「保存中…」に変える。完了まで同じ操作を受け付けない | FR2.6 |
| 成功の知らせ | 操作した部品の近くに「✓ 〜しました」を表示し、`aria-live="polite"` で読み上げる。5秒で消える。フォーカスは移さない | Q6 |
| 失敗の知らせ | 操作した部品の近くに「⚠ 〜できませんでした」と再試行の方法を `role="alert"` で表示する。入力値は残す。自動では消えない | FR8.3 |
| 入力エラー | 項目の直下に「⚠ 項目名：直し方」を表示し、入力欄に `aria-invalid="true"` と `aria-describedby` を付ける。送信時は最初のエラー項目へフォーカスを移す | FR2.2、FR9.4 |
| 読み込み中 | StatusPanel の loading 状態を表示し、その画面の保存系ボタンを無効にする | FR8.1 |
| 表示のエスケープ | 利用者の入力と CSV 由来の値は React の通常の文字列描画で表示し、HTML として挿入しない | NFR8 |
| 動き | アニメーションは 200ms 以下。`prefers-reduced-motion` のときは動きを止める | NFR2 |
| 確認ダイアログ | 破壊的操作（収支の削除、カテゴリの削除）と CSV 取り込みだけに使う。ダイアログからさらにダイアログは開かない | FR2.5、FR3.4、FR7.2 |

## 2. 主な操作の流れ

### 流れ A: 収支を登録する（P1、P2）

1. 収支タブ → 日付（初期値は今日）→ 種別（初期値は支出）→ カテゴリ → 金額 → メモを入力する。
2. 「登録する」または入力欄で Enter → 保存中表示 → 保存成功: 一覧に追加し「✓ 登録しました」。フォームは日付と種別を残してカテゴリ・金額・メモを空にし、フォーカスは金額欄に移す（連続入力のため）。
3. 異常: 入力エラー → S1-3。保存失敗 → S1-7（入力値を保持）。カテゴリが見つからない → S1-7 の文言。

### 流れ B: 収支を編集・削除する

1. 一覧の「編集」→ フォームが編集モード、フォーカスは日付欄。「変更を保存」→ 成功で通常モードに戻り、押した「編集」ボタンへフォーカスを戻す。対象行が別の月へ移ったときは「2026年11月に移動しました」と表示し、フォーカスは一覧の見出しへ移す。
2. 「削除」→ D1（フォーカスはキャンセル）→「削除する」→ 成功で行を消し「✓ 削除しました」、フォーカスは次の行の「削除」ボタン（なければ一覧の見出し）へ移す。Esc・キャンセル → 何も変えず、押した「削除」へ戻す。

### 流れ C: 予算を設定する

1. 予算タブ → 月を選ぶ → 行の入力欄に額を入れ「保存」（または Enter）→ 成功で状態表示を「設定済み」に変え「✓ 食費の予算を保存しました」。
2. 「設定を外す」→ 確認なしで実行し、成功時に「✓ 食費の設定を外しました（2026年8月の予算を引き継ぎます）」と結果を文字で示す。取り消したい場合は同じ額を入れて保存し直す。

### 流れ D: CSV を取り込む

1. CSV タブ →「ファイルを選ぶ」→ 解析中は「ファイルを確認中…」→ 形式エラーなら理由を表示して終了。
2. 問題なし → D3 を開く → 「N件を取り込む」→ 取り込み中 → 成功で D3 を閉じ「✓ N件を取り込みました」、フォーカスは「ファイルを選ぶ」へ戻す。失敗で D3 内に失敗を表示し、ボタンは再試行可能に戻す。
3. キャンセル・Esc → 何も追加せず D3 を閉じ、「ファイルを選ぶ」へ戻す。

---

## TabNav

| Field | Value |
|---|---|
| Component | TabNav |
| Description | 5つの画面（収支・月次集計・予算・カテゴリ・CSV）を切り替えるタブ |
| Category | navigation |

### States

| State | Description | Trigger |
|---|---|---|
| default | 収支タブが選択された状態 | 起動完了 |
| focus | 選択中のタブにフォーカスリング | Tab キーでタブ列に入る |
| selected | 下線＋太字、`aria-selected="true"` | クリック、Enter、矢印キーでの移動 |
| disabled | すべてのタブが操作不可 | S0-a、S0-b の表示中 |

### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| tabs | `{id: string; label: string}[]` | yes | — | 表示するタブ |
| selectedId | string | yes | `"transactions"` | 選択中のタブ |
| onSelect | `(id: string) => void` | yes | — | 選択の変更 |

### Responsive Behaviour

| Breakpoint | Behaviour |
|---|---|
| mobile (<768px) | 1行のまま横スクロール。選択中のタブが見える位置へ自動スクロール |
| tablet (768–1024px) | 基準と同じ |
| desktop (>1024px) | 基準レイアウト |

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | `tablist`、各タブは `tab`、内容は `tabpanel`（`aria-labelledby` でタブと関連づけ） |
| Keyboard interaction | 左右矢印で前後のタブへ移動し同時に選択（自動選択）、Home/End で先頭・末尾。Tab でタブ列から内容へ出る |
| Label / aria-label | タブの文字がそのまま名前。`tablist` に `aria-label="画面の切り替え"` |
| Contrast ratio | WCAG AA（文字 4.5:1、下線・フォーカスリング 3:1） |
| Screen reader | 「収支、タブ、1/5、選択中」 |
| Focus management | 選択中のタブだけが Tab の到達先（`tabindex="0"`）、他は `-1` |

### Usage Example

```
<TabNav tabs={TABS} selectedId={current} onSelect={setCurrent} />
```

---

## MonthNavigator

| Field | Value |
|---|---|
| Component | MonthNavigator |
| Description | 対象月の表示と前月・翌月への移動 |
| Category | navigation |

### States

| State | Description | Trigger |
|---|---|---|
| default | 「2026年10月」と前後のボタン | 表示 |
| focus | ボタンにフォーカスリング | Tab |
| disabled | 前後ボタンが無効 | 読み込み中 |

### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| month | string（`YYYY-MM`） | yes | 今月 | 対象月 |
| onChange | `(month: string) => void` | yes | — | 月の変更 |
| disabled | boolean | no | false | 読み込み中の無効化 |

### Responsive Behaviour

| Breakpoint | Behaviour |
|---|---|
| mobile (<768px) | ボタンは「◀」「▶」の記号のみ表示し、`aria-label` で「前月」「翌月」 |
| tablet (768–1024px) | 基準と同じ |
| desktop (>1024px) | 「◀ 前月」「翌月 ▶」 |

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | `button` ×2、月の表示は見出しまたは `aria-live="polite"` の文字 |
| Keyboard interaction | Tab で各ボタンへ、Enter/Space で移動 |
| Label / aria-label | 「前月（2026年9月）」「翌月（2026年11月）」 |
| Contrast ratio | WCAG AA |
| Screen reader | 移動後に「2026年11月を表示中」と読み上げ |
| Focus management | 押したボタンにフォーカスを残す |

### Usage Example

```
<MonthNavigator month="2026-10" onChange={setMonth} />
```

---

## TransactionForm

| Field | Value |
|---|---|
| Component | TransactionForm |
| Description | 収支の登録と編集を行うフォーム（収支タブ上部に常設） |
| Category | input |

### States

| State | Description | Trigger |
|---|---|---|
| default | 登録モード。日付は今日、種別は支出 | 表示 |
| editing | 編集モード。見出し「収支の編集（〜）」と「キャンセル」「変更を保存」 | 一覧の「編集」 |
| focus | 各入力欄にフォーカスリング | Tab |
| disabled | すべての入力と送信が無効 | 読み込み中・読み込み失敗 |
| loading | 送信ボタンが「保存中…」で無効 | 保存処理中 |
| error | 項目エラー、または保存失敗の表示 | 検証失敗・保存失敗 |

### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| categories | `Category[]` | yes | — | 種別ごとのカテゴリ選択肢 |
| editing | `Transaction \| null` | no | null | 編集対象 |
| onSubmit | `(input: TransactionInput) => Promise<SaveResult>` | yes | — | 保存処理。結果で成功・失敗を表示 |
| onCancelEdit | `() => void` | no | — | 編集の取り消し |
| disabled | boolean | no | false | 読み込み中などの無効化 |

### Responsive Behaviour

| Breakpoint | Behaviour |
|---|---|
| mobile (<768px) | 項目を1列に縦積み |
| tablet (768–1024px) | 2列 |
| desktop (>1024px) | 日付・種別・カテゴリの1行、金額・メモ・送信の1行 |

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | `form`（`aria-labelledby` で見出し）、種別は `fieldset`＋`legend`＋ラジオボタン |
| Keyboard interaction | Tab で項目間を移動、種別は矢印キー、Enter で送信、編集モードでは Esc で取り消し |
| Label / aria-label | すべての入力に見える `<label>`。必須は `aria-required="true"` と見出しの「*」 |
| Contrast ratio | WCAG AA（入力欄の枠 3:1） |
| Screen reader | エラーは `aria-describedby` で欄に関連づけ。要約「2件の項目を確認してください」は `role="alert"` |
| Focus management | 送信エラー時は最初のエラー項目へ。登録成功時は金額欄へ。編集の開始時は日付欄へ、終了時は押した「編集」へ |

### Usage Example

```
<TransactionForm categories={cats} editing={null} onSubmit={save} />
```

---

## TransactionList

| Field | Value |
|---|---|
| Component | TransactionList |
| Description | 対象月の収支一覧と、各行の編集・削除 |
| Category | display |

### States

| State | Description | Trigger |
|---|---|---|
| default | 収支の表と件数 | データあり |
| empty | 「この月の収支はまだありません」と「登録欄へ移動」 | 対象月の収支が0件 |
| loading | 行の形の仮表示と「読み込み中…」 | 読み込み中 |
| error | 「データを読み込めませんでした」と「再試行」 | 読み込み失敗 |
| focus | 行内ボタンにフォーカスリング | Tab |

### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| transactions | `Transaction[]` | yes | — | 並べ替え済みの収支 |
| categories | `Category[]` | yes | — | 名前表示用 |
| status | `"loading" \| "ready" \| "error"` | yes | — | 読み込み状態 |
| onEdit | `(id: string) => void` | yes | — | 編集の開始 |
| onDelete | `(id: string) => void` | yes | — | 削除確認の表示 |
| onRetry | `() => void` | yes | — | 再読み込み |

### Responsive Behaviour

| Breakpoint | Behaviour |
|---|---|
| mobile (<768px) | 1件ごとのカード表示（項目名付き） |
| tablet (768–1024px) | 表。メモ列は省略表示 |
| desktop (>1024px) | 表 |

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | `<table>`＋`<caption>`（「2026年10月の収支 3件」）、列見出しは `<th scope="col">` |
| Keyboard interaction | 行内の「編集」「削除」へ Tab で移動、Enter/Space で実行 |
| Label / aria-label | ボタンに対象を含める：「2026-10-01 食費 1,200円 を編集」 |
| Contrast ratio | WCAG AA |
| Screen reader | 状態の切り替え（読み込み中→表示）は `aria-busy` と `aria-live="polite"` で通知 |
| Focus management | 削除後は次の行の「削除」、なければ一覧の見出しへ |

### Usage Example

```
<TransactionList transactions={rows} categories={cats} status="ready" onEdit={edit} onDelete={askDelete} onRetry={reload} />
```

---

## ConfirmDialog

| Field | Value |
|---|---|
| Component | ConfirmDialog |
| Description | 破壊的操作の確認（D1 収支の削除、D2 カテゴリの削除） |
| Category | feedback |

### States

| State | Description | Trigger |
|---|---|---|
| default | 対象の内容と「キャンセル」「削除する」 | 削除ボタン |
| focus | 開いた直後は「キャンセル」にフォーカス | 表示 |
| loading | 「削除中…」で両ボタン無効 | 削除処理中 |
| error | 「削除できませんでした」を表示し、ボタンを戻す | 保存失敗、最新データでの使用件数の再確認で使用中と判明 |

### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| title | string | yes | — | 「この収支を削除しますか？」など |
| body | ReactNode | yes | — | 対象の日付・カテゴリ・金額、連動して消える予算 |
| confirmLabel | string | no | `"削除する"` | 確定ボタンの文言 |
| onConfirm | `() => Promise<SaveResult>` | yes | — | 実行 |
| onClose | `() => void` | yes | — | 閉じる（呼び出し元へフォーカスを戻す） |

### Responsive Behaviour

| Breakpoint | Behaviour |
|---|---|
| mobile (<768px) | 画面幅いっぱい、ボタンは縦積み |
| tablet (768–1024px) | 幅 480px 中央 |
| desktop (>1024px) | 幅 480px 中央 |

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | `alertdialog`、`aria-modal="true"`、`aria-labelledby`（題名）、`aria-describedby`（本文） |
| Keyboard interaction | Tab/Shift+Tab はダイアログ内で循環、Esc で閉じる、Enter/Space でボタン実行 |
| Label / aria-label | 題名が名前 |
| Contrast ratio | WCAG AA。背景の覆いは本文を隠すが操作は不可 |
| Screen reader | 開いたときに題名と本文を読み上げ |
| Focus management | 開く: 「キャンセル」へ。閉じる: 開いた操作要素へ戻す。背後は `inert` |

### Usage Example

```
<ConfirmDialog title="この収支を削除しますか？" body={<Summary tx={tx} />} onConfirm={remove} onClose={close} />
```

---

## StatusPanel

| Field | Value |
|---|---|
| Component | StatusPanel |
| Description | 読み込み中・読み込み失敗・空データ・保存できない環境を区別して表示する共通部品 |
| Category | feedback |

### States

| State | Description | Trigger |
|---|---|---|
| loading | ⏳「〜を読み込み中…」と仮表示。5秒を超えたら「時間がかかっています…」を追記 | 読み込み開始 |
| error | ⚠「データを読み込めませんでした」と「再試行」 | 読み込み失敗 |
| empty | 「〜はまだありません」と次の操作への導線 | 0件 |
| unavailable | ⚠「この環境ではデータを保存できません」と「再読み込み」 | IndexedDB 利用不可（S0-a） |
| newer-version | ⚠「新しい版で保存されたデータのため開けません」 | 保存データの版がアプリより新しい（S0-b） |

### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| kind | `"loading" \| "error" \| "empty" \| "unavailable" \| "newer-version"` | yes | — | 表示の種類 |
| subject | string | yes | — | 「収支」「集計」など |
| action | `{label: string; onClick: () => void}` | no | — | 再試行・導線 |

### Responsive Behaviour

| Breakpoint | Behaviour |
|---|---|
| mobile (<768px) | 幅いっぱい |
| tablet (768–1024px) | 内容領域の幅 |
| desktop (>1024px) | 内容領域の幅 |

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | loading と empty は `role="status"`、error・unavailable・newer-version は `role="alert"` |
| Keyboard interaction | 操作ボタンは Tab で到達、Enter/Space で実行 |
| Label / aria-label | 表示文がそのまま名前 |
| Contrast ratio | WCAG AA。アイコンは文字と併記（アイコンは `aria-hidden="true"`） |
| Screen reader | 種類ごとに上記の文を読み上げ |
| Focus management | フォーカスは移さない。ただし起動時の unavailable・newer-version は見出しへフォーカス |

### Usage Example

```
<StatusPanel kind="error" subject="収支" action={{ label: "再試行", onClick: reload }} />
```

---

## SummaryCards と CategoryBudgetTable

| Field | Value |
|---|---|
| Component | SummaryCards / CategoryBudgetTable / IncomeCategoryTable |
| Description | 月次集計の合計3値と、カテゴリ別の予算・実績・残り・状態の表 |
| Category | display |

### States

| State | Description | Trigger |
|---|---|---|
| default | 合計と表 | データあり |
| empty | 合計 0円＋「この月の収支はまだありません」。予算がある行は予算と残りを表示 | 対象月の収支が0件 |
| loading | 合計欄は「—」、表は仮表示 | 読み込み中 |
| error | StatusPanel error | 読み込み失敗 |

### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| summary | `MonthlySummary` | yes | — | 収入合計・支出合計・差額・カテゴリ別行（予算の出所: 設定済み／引き継ぎ（何月）／予算なし） |
| status | `"loading" \| "ready" \| "error"` | yes | — | 読み込み状態 |

### Responsive Behaviour

| Breakpoint | Behaviour |
|---|---|
| mobile (<768px) | 合計3値は縦積み。表はカテゴリごとのカード |
| tablet (768–1024px) | 合計3値は横並び、表 |
| desktop (>1024px) | 同上 |

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | 合計は `<dl>`、表は `<table>`＋`<caption>` |
| Keyboard interaction | 操作要素なし（月の移動は MonthNavigator） |
| Label / aria-label | 「残り −200円、超過」のように数値と状態を同じセルで読める文にする |
| Contrast ratio | WCAG AA。超過・赤字は記号と文字で示し、色は補助 |
| Screen reader | 月の切り替え後に合計を `aria-live="polite"` で通知 |
| Focus management | なし |

### Usage Example

```
<SummaryCards summary={s} status="ready" /><CategoryBudgetTable summary={s} status="ready" />
```

---

## BudgetEditor

| Field | Value |
|---|---|
| Component | BudgetEditor |
| Description | 予算タブの表。支出カテゴリごとに対象月の予算を入力・保存・設定解除する |
| Category | input |

### States

| State | Description | Trigger |
|---|---|---|
| default | 各行に入力欄と出所（設定済み／引き継ぎ（何月）／予算なし） | 表示 |
| focus | 入力欄・ボタンのフォーカスリング | Tab |
| loading | 行の「保存」が「保存中…」 | 保存処理中 |
| error | 行の下に入力エラーまたは保存失敗 | 検証失敗・保存失敗 |
| disabled | 全行が無効 | 読み込み中 |

### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| month | string | yes | — | 対象月 |
| rows | `{category: Category; amount: number \| null; source: "set" \| "carried" \| "none"; carriedFrom?: string}[]` | yes | — | 行の内容 |
| onSave | `(categoryId: string, amount: number) => Promise<SaveResult>` | yes | — | 保存 |
| onClear | `(categoryId: string) => Promise<SaveResult>` | yes | — | 設定を外す |

### Responsive Behaviour

| Breakpoint | Behaviour |
|---|---|
| mobile (<768px) | 1カテゴリ1カード（名前・入力・出所・ボタン） |
| tablet (768–1024px) | 表 |
| desktop (>1024px) | 表 |

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | `<table>`、入力欄は `<input inputmode="numeric">` |
| Keyboard interaction | Tab で入力欄→保存→設定を外す→次の行。入力欄で Enter はその行の保存 |
| Label / aria-label | 入力欄に「食費の2026年10月の予算（円）」、ボタンに「食費の予算を保存」 |
| Contrast ratio | WCAG AA |
| Screen reader | 出所は文字で読み上げ（「引き継ぎ、2026年8月から」） |
| Focus management | 保存・設定解除の後は押したボタンに残す。エラー時は該当の入力欄へ |

### Usage Example

```
<BudgetEditor month="2026-10" rows={rows} onSave={saveBudget} onClear={clearBudget} />
```

---

## CategoryManager

| Field | Value |
|---|---|
| Component | CategoryManager |
| Description | カテゴリの追加・名前変更・削除 |
| Category | input |

### States

| State | Description | Trigger |
|---|---|---|
| default | 追加欄と種別ごとの一覧（名前・使用件数・操作） | 表示 |
| renaming | 行の名前が入力欄になり「保存」「キャンセル」 | 「名前を変更」 |
| error | 追加欄・行の下に理由（重複、空白のみ、21文字以上、使用中、最後の1件） | 検証失敗・削除不可 |
| loading | 対象ボタンが「保存中…」 | 保存処理中 |

### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| categories | `Category[]` | yes | — | 全カテゴリ |
| usage | `Record<string, number>` | yes | — | カテゴリごとの使用件数 |
| onAdd | `(type, name) => Promise<SaveResult>` | yes | — | 追加 |
| onRename | `(id, name) => Promise<SaveResult>` | yes | — | 名前変更 |
| onDelete | `(id) => void` | yes | — | 削除確認（D2）を開く |

### Responsive Behaviour

| Breakpoint | Behaviour |
|---|---|
| mobile (<768px) | 追加欄は縦積み、一覧はカード |
| tablet (768–1024px) | 表 |
| desktop (>1024px) | 表 |

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | 追加欄は `form`、種別は `fieldset`＋ラジオ、一覧は `<table>` |
| Keyboard interaction | 名前変更中は Enter で保存、Esc で取り消し |
| Label / aria-label | 「食費の名前を変更」「食費を削除」 |
| Contrast ratio | WCAG AA |
| Screen reader | 削除不可の理由は `role="alert"` |
| Focus management | 名前変更の開始で入力欄へ、終了で「名前を変更」へ戻す |

### Usage Example

```
<CategoryManager categories={cats} usage={usage} onAdd={add} onRename={rename} onDelete={askDelete} />
```

---

## CsvExportPanel と CsvImportPanel

| Field | Value |
|---|---|
| Component | CsvExportPanel / CsvImportPanel |
| Description | CSV の書き出し（全期間・月指定）と、ファイル選択から形式チェックまで |
| Category | input |

### States

| State | Description | Trigger |
|---|---|---|
| default | 対象の選択と「CSV を書き出す」、形式の説明と「ファイルを選ぶ」 | 表示 |
| loading | 「ファイルを確認中…」 | ファイル選択直後の解析中 |
| empty | 書き出し: 「書き出す収支がないため見出し行のみ出力しました」。読み込み: 「データがありません」 | 0件 |
| error | 見出し不一致・上限超過・読み取り失敗の理由 | 形式チェック失敗 |

### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| onExport | `(range: "all" \| {month: string}) => Promise<ExportResult>` | yes | — | 書き出し（ブラウザ内でファイルを生成） |
| onFileSelected | `(file: File) => Promise<ParseResult>` | yes | — | 解析し、成功なら D3 を開く |

### Responsive Behaviour

| Breakpoint | Behaviour |
|---|---|
| mobile (<768px) | 縦積み |
| tablet (768–1024px) | 書き出しと読み込みを縦に並べる |
| desktop (>1024px) | 同上 |

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | ネイティブの `<input type="file" accept=".csv,text/csv">` に見える `<label>` を付ける |
| Keyboard interaction | Enter/Space でファイル選択を開く。対象はラジオ（矢印キー） |
| Label / aria-label | 「CSV ファイルを選ぶ」 |
| Contrast ratio | WCAG AA |
| Screen reader | 結果・エラーを `aria-live` で通知 |
| Focus management | D3 を閉じた後は「ファイルを選ぶ」へ戻す |

### Usage Example

```
<CsvExportPanel onExport={exportCsv} /><CsvImportPanel onFileSelected={parseFile} />
```

---

## ImportPreviewDialog

| Field | Value |
|---|---|
| Component | ImportPreviewDialog |
| Description | 取り込める行と取り込めない行を示し、確定・キャンセルを受ける（D3） |
| Category | feedback |

### States

| State | Description | Trigger |
|---|---|---|
| default | 件数の要約、取り込めない行（行番号と理由）、取り込める行の表 | 解析成功 |
| empty | 取り込める行0件。「取り込める行がありません」、確定ボタンは無効 | 全行不正 |
| loading | 「取り込み中…」でボタン無効 | 確定後の保存中 |
| error | 「取り込めませんでした。1件も追加していません」と再試行可能なボタン | 保存失敗 |

### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| fileName | string | yes | — | 表示用（エスケープして表示） |
| validRows | `PreviewRow[]` | yes | — | 行番号・内容・「既存と同じ内容」の注記 |
| invalidRows | `{line: number; reasons: string[]}[]` | yes | — | 取り込めない行 |
| onConfirm | `() => Promise<SaveResult>` | yes | — | 一括追加（全件成功か0件） |
| onCancel | `() => void` | yes | — | 何もせず閉じる |

### Responsive Behaviour

| Breakpoint | Behaviour |
|---|---|
| mobile (<768px) | 画面いっぱい。行はカード |
| tablet (768–1024px) | 幅 720px 中央。ダイアログ内スクロール |
| desktop (>1024px) | 同上 |

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | `dialog`、`aria-modal="true"`、`aria-labelledby`（題名）、`aria-describedby`（件数の要約） |
| Keyboard interaction | Tab はダイアログ内で循環、Esc でキャンセル |
| Label / aria-label | 確定ボタンは「3件を取り込む」と件数を含む |
| Contrast ratio | WCAG AA |
| Screen reader | 開いたときに「取り込める行3件、取り込めない行1件」を読み上げ |
| Focus management | 開く: 件数の要約（`tabindex="-1"` の見出し）へ。閉じる: 「ファイルを選ぶ」へ |

### Usage Example

```
<ImportPreviewDialog fileName={f.name} validRows={ok} invalidRows={ng} onConfirm={commit} onCancel={close} />
```
