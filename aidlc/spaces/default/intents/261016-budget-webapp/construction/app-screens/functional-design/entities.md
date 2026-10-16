# 画面の状態の形（app-screens）

- 出典: `inception/refined-mockups/mockups.md`（画面の状態）、`inception/refined-mockups/interaction-spec.md`（部品の States）、`inception/contract-design/contract-summary.md`（C1〜C6）、`functional-design-questions.md`（Q1 = A）
- U7 は保存しない。下の形はすべて画面のメモリの中だけにある（ページを閉じると消える）。保存されるのは U3 の中の収支・カテゴリ・予算だけ。

```yaml
entities:
  - name: AppBoot
    description: 起動時の状態（openBook の結果を写したもの）
    attributes:
      - { name: status, logical_type: enum, required: true, allowed_values: [booting, ready, unavailable, newer-version, load-failed] }
      - { name: book, logical_type: "Book | null", required: true, constraints: [ready のときだけ値がある] }
      - { name: message, logical_type: string, required: false, constraints: [load-failed のときの概要] }
    rules: [BR1.2, BR8.4]

  - name: ScreenId
    description: 5つの画面（タブ）の識別子
    attributes:
      - { name: id, logical_type: enum, required: true, allowed_values: [transactions, summary, budgets, categories, csv] }
    rules: [BR9.1]

  - name: SharedMonth
    description: 収支・月次集計・予算で共有する対象月
    attributes:
      - { name: month, logical_type: YearMonth, required: true, constraints: [初期値は今月（ローカル日付）。U1 の isValidYearMonth を満たす] }
    rules: [BR1.4]

  - name: AsyncView
    description: 読み取り結果を表示する欄の状態（読み込み中・成功・失敗）
    attributes:
      - { name: state, logical_type: enum, required: true, allowed_values: [loading, loaded, failed] }
      - { name: slow, logical_type: boolean, required: true, constraints: [loading が5秒を超えたとき true] }
      - { name: error, logical_type: "OperationError | null", required: false, constraints: [failed のとき値がある] }
    rules: [BR8.1, BR8.2]

  - name: FormState
    description: 登録・編集フォームの状態（入力値は失敗しても残す）
    attributes:
      - { name: mode, logical_type: enum, required: true, allowed_values: [create, edit] }
      - { name: values, logical_type: "TransactionInput", required: true, constraints: [入力の文字列のまま保持] }
      - { name: fieldErrors, logical_type: "ValidationError[]", required: true, constraints: [validation のときだけ] }
      - { name: saving, logical_type: boolean, required: true, constraints: [true の間は保存の操作を受け付けない] }
      - { name: notice, logical_type: "Notice | null", required: false }
    rules: [BR2.1, BR2.2, BR2.4, BR8.3, BR9.3]

  - name: Notice
    description: 操作の結果の知らせ（成功と失敗）
    attributes:
      - { name: kind, logical_type: enum, required: true, allowed_values: [success, error] }
      - { name: text, logical_type: string, required: true, constraints: [固定の日本語の文言。入力値は埋め込むが文字列として描画する] }
      - { name: autoHideMs, logical_type: "integer | null", required: true, constraints: [success は 5000、error は null（消えない）] }
    rules: [BR2.1, BR8.3]

  - name: DialogState
    description: 確認と取り込みのダイアログ（D1、D2、D3）の状態
    attributes:
      - { name: kind, logical_type: enum, required: true, allowed_values: [none, deleteTransaction, deleteCategory, importPreview] }
      - { name: target, logical_type: "string | null", required: false, constraints: [対象の id（収支・カテゴリ）] }
      - { name: returnFocusRef, logical_type: "RefObject<HTMLElement | null>", required: true, constraints: [開く前に押したボタン] }
      - { name: busy, logical_type: boolean, required: true, constraints: [true の間はキャンセルも無効] }
      - { name: error, logical_type: "string | null", required: false, constraints: [D3 の保存失敗の文言] }
    rules: [BR2.5, BR3.4, BR7.4, BR7.5, BR9.2]

  - name: ImportView
    description: CSV 取り込みの画面の状態（ファイル選択から確定まで）
    attributes:
      - { name: phase, logical_type: enum, required: true, allowed_values: [idle, analyzing, fileError, previewing, saving, done] }
      - { name: preview, logical_type: "ImportPreview | null", required: false, constraints: [previewing と saving のとき] }
      - { name: fileError, logical_type: "ImportFileError | null", required: false, constraints: [fileError のとき] }
      - { name: notice, logical_type: "Notice | null", required: false }
    rules: [BR7.1, BR7.2, BR7.4]

  - name: ExportView
    description: 書き出しの状態
    attributes:
      - { name: range, logical_type: "all | { month: YearMonth }", required: true }
      - { name: notice, logical_type: "Notice | null", required: false }
    rules: [BR6.1, BR6.3]
```

## 契約 C1〜C6 との差分

- なし。画面は C3 の Book と C4・C5 の関数だけを使い、C6 の部品の props を使う。Q1 = A のとおり、削除確認は C3 の使用件数（収支と予算の件数）だけを使う。
