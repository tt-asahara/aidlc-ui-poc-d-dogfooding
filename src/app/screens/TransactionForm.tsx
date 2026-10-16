// 収支の登録と編集のフォーム（S1-1、S1-2、S1-3、S1-7。BR2.1、BR2.2、BR2.4、BR3.5、BR8.1、BR8.2、BR8.3、BR9.3）。
// 入力は文字列のまま持ち、検証は U4（U1 の検証）に任せる。失敗しても入力は残す。保存中は送信を受け付けない。
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type {
  Category,
  EntryType,
  Transaction,
  TransactionInput,
  ValidationError,
} from "../../data-contract";
import { Button, FieldError, InlineMessage, RadioGroup, Select, TextField } from "../../ui-kit";
import { useShell } from "../appState";
import { formatYen } from "../format";
import { createNotice } from "../status";
import {
  APP_MESSAGES,
  REQUIRED_LEGEND_TEXT,
  SAVE_FAILED_TEXT,
  STALE_SELECTION_TEXT,
} from "../messages";
import type { FormState } from "../types";

type FieldKey = "date" | "type" | "category" | "amount" | "memo";

/** 項目の順（画面の上から下。BR9.3 の「最初のエラー」の順）。 */
const FIELD_ORDER: readonly FieldKey[] = ["date", "type", "category", "amount", "memo"];

/** 食い違いを示す失敗の種類（BR3.5 の同じ文言で表示する）。 */
const STALE_RULE_CODES: readonly string[] = [
  "category-missing",
  "not-found",
  "category-type-mismatch",
];

export interface TransactionFormProps {
  categories: readonly Category[];
  /** 編集の対象。null なら登録。 */
  editing: Transaction | null;
  /** 登録の日付の初期値（ローカルの今日。BR2.1）。 */
  today: string;
  /** 保存に成功したとき（一覧の更新と知らせは親が行う）。 */
  onSaved: (saved: Transaction, mode: "create" | "edit") => void;
  onCancelEdit: () => void;
  /** 食い違い（別のタブでの変更）を知らせ、画面の表示を取り直させる。 */
  onStale: () => void;
  /**
   * 入力と送信を無効にする（読み取りの読み込み中・失敗のとき。BR8.1、BR8.2）。
   * 表示は残し、無効にするだけ。無効の間は送信しても何もしない。
   */
  disabled?: boolean;
}

export function toEntryType(value: string): EntryType {
  return value === "income" ? "income" : "expense";
}

function firstCategoryId(categories: readonly Category[], type: EntryType): string {
  return categories.find((category) => category.type === type)?.id ?? "";
}

function initialValues(
  editing: Transaction | null,
  today: string,
  categories: readonly Category[],
): TransactionInput {
  if (editing !== null) {
    return {
      date: editing.date,
      type: editing.type,
      categoryId: editing.categoryId,
      amount: String(editing.amount),
      memo: editing.memo,
    };
  }
  return {
    date: today,
    type: "expense",
    categoryId: firstCategoryId(categories, "expense"),
    amount: "",
    memo: "",
  };
}

/** U1 の検証の項目を、画面の入力欄に対応づける。 */
function fieldKeyOf(field: ValidationError["field"]): FieldKey | null {
  switch (field) {
    case "date":
      return "date";
    case "type":
      return "type";
    case "categoryId":
    case "category":
      return "category";
    case "amount":
      return "amount";
    case "memo":
      return "memo";
    default:
      return null;
  }
}

function firstInvalidField(errors: readonly ValidationError[]): FieldKey | null {
  const keys = errors
    .map((error) => fieldKeyOf(error.field))
    .filter((key): key is FieldKey => key !== null);
  return FIELD_ORDER.find((key) => keys.includes(key)) ?? null;
}

export function TransactionForm({
  categories,
  editing,
  today,
  onSaved,
  onCancelEdit,
  onStale,
  disabled = false,
}: TransactionFormProps) {
  const { book, onNewerVersion } = useShell();
  const mode = editing === null ? "create" : "edit";
  const [form, setForm] = useState<FormState>(() => ({
    mode,
    values: initialValues(editing, today, categories),
    fieldErrors: [],
    saving: false,
    notice: null,
  }));
  const [isStale, setIsStale] = useState(false);
  // 二重の送信を防ぐ（描画の前に連続で押されても1回だけ送る。BR2.2）。
  const savingRef = useRef(false);
  // 次の描画の後にフォーカスする項目（エラーの最初の項目、登録後の金額欄など）。
  const pendingFocusRef = useRef<FieldKey | null>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const typeRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLSelectElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const memoRef = useRef<HTMLInputElement>(null);

  const { values } = form;
  const entryType = toEntryType(values.type);
  const categoryName = (categoryId: string): string | undefined =>
    categories.find((category) => category.id === categoryId)?.name;

  function elementOf(key: FieldKey): HTMLElement | null {
    switch (key) {
      case "date":
        return dateRef.current;
      case "type":
        return typeRef.current;
      case "category":
        return categoryRef.current;
      case "amount":
        return amountRef.current;
      case "memo":
        return memoRef.current;
    }
  }

  // 送信の後のフォーカス移動（描画が済んでから行う）。
  useEffect(() => {
    const target = pendingFocusRef.current;
    if (target === null) return;
    pendingFocusRef.current = null;
    elementOf(target)?.focus();
  });

  // 編集を始めたら日付欄へ（BR2.4、流れ B）。フォームは編集ごとに作り直すため、マウント時に一度だけ行う。
  useEffect(() => {
    if (mode === "edit") dateRef.current?.focus();
  }, [mode]);

  function setValues(update: (current: TransactionInput) => TransactionInput): void {
    setForm((current) => ({ ...current, values: update(current.values) }));
  }

  function changeType(nextType: EntryType): void {
    // 種別を変えたらカテゴリは同じ種別の先頭に合わせる（カテゴリは種別で絞る。BR2.1）。
    setValues((current) => ({
      ...current,
      type: nextType,
      categoryId: firstCategoryId(categories, nextType),
    }));
  }

  function errorFor(key: FieldKey): string | undefined {
    return form.fieldErrors.find((error) => fieldKeyOf(error.field) === key)?.message;
  }

  function handleSuccess(saved: Transaction): void {
    if (editing === null) {
      // 登録の後は日付と種別を残し、カテゴリ・金額・メモを空にして金額へ戻る（BR2.1、流れ A）。
      setForm((current) => ({
        ...current,
        fieldErrors: [],
        notice: null,
        values: { ...current.values, categoryId: "", amount: "", memo: "" },
      }));
      amountRef.current?.focus();
    }
    onSaved(saved, mode);
  }

  function handleFailure(
    error:
      | { kind: "validation"; errors: ValidationError[] }
      | { kind: "rule"; code: string }
      | { kind: "newer-version" }
      | { kind: "storage" },
  ): void {
    switch (error.kind) {
      case "validation":
        setForm((current) => ({ ...current, fieldErrors: error.errors }));
        pendingFocusRef.current = firstInvalidField(error.errors);
        return;
      case "rule":
        // 別のタブで消えた等。入力は残し、画面の更新を促す（BR3.5）。
        setIsStale(STALE_RULE_CODES.includes(error.code));
        return;
      case "newer-version":
        onNewerVersion();
        return;
      case "storage":
        setForm((current) => ({
          ...current,
          notice: createNotice("error", SAVE_FAILED_TEXT),
        }));
        return;
    }
  }

  async function save(): Promise<void> {
    if (disabled || savingRef.current) return;
    savingRef.current = true;
    setIsStale(false);
    setForm((current) => ({ ...current, saving: true, notice: null, fieldErrors: [] }));
    try {
      const result =
        editing === null
          ? await book.addTransaction(values)
          : await book.updateTransaction(editing.id, values);
      if (result.ok) {
        handleSuccess(result.value);
      } else if (result.error.kind === "rule") {
        handleFailure({ kind: "rule", code: result.error.violation.code });
      } else {
        handleFailure(result.error);
      }
    } catch {
      // 想定外の例外も保存の失敗として表示する（黙って捨てない）。
      handleFailure({ kind: "storage" });
    } finally {
      savingRef.current = false;
      setForm((current) => ({ ...current, saving: false }));
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // 無効の間の送信は何もしない（BR8.1、BR8.2）。
    if (disabled) return;
    void save();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Escape" && mode === "edit") onCancelEdit();
  };

  const categoryOptions = [
    { value: "", label: APP_MESSAGES.transactions.chooseCategory },
    ...categories
      .filter((category) => category.type === entryType)
      .map((category) => ({ value: category.id, label: category.name })),
  ];
  const typeOptions: { value: EntryType; label: string }[] = [
    { value: "expense", label: APP_MESSAGES.transactions.typeExpense },
    { value: "income", label: APP_MESSAGES.transactions.typeIncome },
  ];
  const editingSummary =
    editing === null
      ? ""
      : `${editing.date} ${categoryName(editing.categoryId) ?? APP_MESSAGES.transactions.fallbackCategoryName} ${formatYen(editing.amount)}`;
  const title =
    editing === null
      ? APP_MESSAGES.transactions.formTitle
      : APP_MESSAGES.transactions.editTitle(editingSummary);
  const headingId = mode === "create" ? "tx-form-create" : "tx-form-edit";
  const submitLabel =
    mode === "create"
      ? APP_MESSAGES.transactions.submitCreate
      : APP_MESSAGES.transactions.submitEdit;

  return (
    <form
      className="app-section"
      aria-labelledby={headingId}
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
    >
      {/* 無効の fieldset の中の入力・選択・ボタンは、ブラウザの標準の動きで無効になる（枠は表示しない）。 */}
      <fieldset disabled={disabled} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
        <h2 id={headingId} className="app-section__title">
          {title}
        </h2>
        <p className="app-muted">{REQUIRED_LEGEND_TEXT}</p>
        {form.fieldErrors.length > 0 && (
          <InlineMessage tone="error">
            {APP_MESSAGES.transactions.summaryErrors(form.fieldErrors.length)}
          </InlineMessage>
        )}
        <div className="app-form-row">
          <TextField
            id="tx-date"
            label={APP_MESSAGES.transactions.date}
            value={values.date}
            onChange={(date) => setValues((current) => ({ ...current, date }))}
            required
            hint="YYYY-MM-DD"
            error={errorFor("date")}
            ref={dateRef}
          />
          <div>
            <RadioGroup<EntryType>
              legend={APP_MESSAGES.transactions.type}
              name="tx-type"
              value={entryType}
              options={typeOptions}
              onChange={changeType}
              ref={typeRef}
            />
            {errorFor("type") !== undefined && (
              <FieldError
                id="tx-type-error"
                field={APP_MESSAGES.transactions.type}
                message={errorFor("type") ?? ""}
              />
            )}
          </div>
          <Select
            id="tx-category"
            label={APP_MESSAGES.transactions.category}
            value={values.categoryId}
            options={categoryOptions}
            onChange={(categoryId) => setValues((current) => ({ ...current, categoryId }))}
            error={errorFor("category")}
            ref={categoryRef}
          />
        </div>
        <div className="app-form-row">
          <TextField
            id="tx-amount"
            label={APP_MESSAGES.transactions.amount}
            value={String(values.amount)}
            onChange={(amount) => setValues((current) => ({ ...current, amount }))}
            required
            inputMode="numeric"
            error={errorFor("amount")}
            ref={amountRef}
          />
          <TextField
            id="tx-memo"
            label={APP_MESSAGES.transactions.memo}
            value={values.memo}
            onChange={(memo) => setValues((current) => ({ ...current, memo }))}
            error={errorFor("memo")}
            ref={memoRef}
          />
        </div>
        {isStale && (
          <div role="alert" className="app-section">
            <p>{`⚠ ${STALE_SELECTION_TEXT}`}</p>
            <div>
              <Button onClick={onStale}>{APP_MESSAGES.refreshScreen}</Button>
            </div>
          </div>
        )}
        {form.notice !== null && (
          <div className="app-section">
            <InlineMessage tone="error">{form.notice.text}</InlineMessage>
            <p className="app-hint">
              {mode === "create"
                ? APP_MESSAGES.transactions.saveFailedRetry
                : APP_MESSAGES.transactions.saveFailedRetryEdit}
            </p>
          </div>
        )}
        <div className="app-actions">
          <Button
            type="submit"
            variant="primary"
            busy={form.saving}
            busyLabel={APP_MESSAGES.transactions.saving}
            disabled={disabled}
          >
            {submitLabel}
          </Button>
          {mode === "edit" && (
            <Button onClick={onCancelEdit}>{APP_MESSAGES.transactions.cancelEdit}</Button>
          )}
        </div>
      </fieldset>
    </form>
  );
}
