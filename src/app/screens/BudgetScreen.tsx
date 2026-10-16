// 予算タブ（S3、US4.1〜US4.3、BR4.1〜BR4.3）。支出カテゴリの全件について、対象月の予算と出所を表示し、保存と設定の解除を行う。
// 検証は U4（U1 の検証）に任せる。入力エラーは行の下に出して入力欄へフォーカス（US9.3）。成功の知らせは画面の上に出す（再読み込みの後も残る）。
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { Category, ValidationError, YearMonth } from "../../data-contract";
import type { EffectiveBudget } from "../../bookkeeping-core";
import { Button, FieldError, InlineMessage } from "../../ui-kit";
import { useShell } from "../appState";
import { formatMonthLabel } from "../format";
import { MonthNavigator } from "../MonthNavigator";
import { APP_MESSAGES, SAVE_FAILED_TEXT, STALE_SELECTION_TEXT } from "../messages";
import { useLatestRead } from "../reads";
import { createNotice, NoticeView, ReadView } from "../status";
import type { Notice } from "../types";

/** 食い違いを示す失敗（BR3.5 と同じ文言で画面の更新を促す）。 */
const STALE_CODES: readonly string[] = ["category-missing", "not-found", "category-type-mismatch"];

function categoryNameFor(categories: readonly Category[], categoryId: string): string {
  return (
    categories.find((category) => category.id === categoryId)?.name ??
    APP_MESSAGES.transactions.fallbackCategoryName
  );
}

/** 出所の文字（BR4.1）。 */
function sourceText(budget: EffectiveBudget): string {
  switch (budget.source.kind) {
    case "set":
      return APP_MESSAGES.budget.sourceSet;
    case "carried":
      return APP_MESSAGES.budget.sourceCarried(formatMonthLabel(budget.source.from));
    case "none":
      return APP_MESSAGES.budget.sourceNone;
  }
}

interface BudgetRowProps {
  name: string;
  budget: EffectiveBudget;
  monthLabel: string;
  onNotice: (notice: Notice) => void;
  onChanged: () => void;
  onNewerVersion: () => void;
}

/**
 * 予算の1行（入力欄・出所・保存・設定を外す）。入力の下書きは行の中だけに持つ。
 * 保存のあと表示が取り直されて値が変わったときだけ下書きを新しい値に合わせる（保存に失敗したら下書きは残す。BR8.3）。
 */
function BudgetRow({
  name,
  budget,
  monthLabel,
  onNotice,
  onChanged,
  onNewerVersion,
}: BudgetRowProps) {
  const { book } = useShell();
  const serverText = budget.amount === null ? "" : String(budget.amount);
  const [draft, setDraft] = useState(serverText);
  const [seenServerText, setSeenServerText] = useState(serverText);
  if (seenServerText !== serverText) {
    // 表示の値が変わったら、下書きを新しい値に合わせる（描画の中での状態の調整）。
    setSeenServerText(serverText);
    setDraft(serverText);
  }
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [rowMessage, setRowMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const busyRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = `budget-${budget.categoryId}`;
  const errorId = `${inputId}-error`;

  /** 操作の結果の共通の処理（失敗は行の下に出し、入力は残す）。 */
  function handleFailure(error: { kind: string; code?: string; errors?: ValidationError[] }): void {
    switch (error.kind) {
      case "validation":
        setErrors(error.errors ?? []);
        inputRef.current?.focus();
        return;
      case "rule":
        setRowMessage(
          error.code !== undefined && STALE_CODES.includes(error.code)
            ? STALE_SELECTION_TEXT
            : SAVE_FAILED_TEXT,
        );
        return;
      case "newer-version":
        onNewerVersion();
        return;
      default:
        setRowMessage(SAVE_FAILED_TEXT);
    }
  }

  async function run(action: () => Promise<void>): Promise<void> {
    if (busyRef.current) return;
    busyRef.current = true;
    setSaving(true);
    setErrors([]);
    setRowMessage(null);
    try {
      await action();
    } catch {
      // 想定外の例外も保存の失敗として表示する（黙って捨てない）。
      setRowMessage(SAVE_FAILED_TEXT);
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  }

  function save(): Promise<void> {
    if (draft.trim() === "") {
      // 空欄では保存しない。設定の解除は［設定を外す］で行う（BR4.2）。
      setRowMessage(APP_MESSAGES.budget.emptyInput);
      inputRef.current?.focus();
      return Promise.resolve();
    }
    return run(async () => {
      const result = await book.setBudget(budget.categoryId, budget.month, draft);
      if (result.ok) {
        onNotice(createNotice("success", APP_MESSAGES.budget.saved(name)));
        onChanged();
        return;
      }
      if (result.error.kind === "validation") {
        handleFailure({ kind: "validation", errors: result.error.errors });
      } else if (result.error.kind === "rule") {
        handleFailure({ kind: "rule", code: result.error.violation.code });
      } else {
        handleFailure({ kind: result.error.kind });
      }
    });
  }

  function clear(): Promise<void> {
    return run(async () => {
      const result = await book.clearBudget(budget.categoryId, budget.month);
      if (!result.ok) {
        if (result.error.kind === "rule" && result.error.violation.code === "budget-not-set") {
          setRowMessage(APP_MESSAGES.budget.notSet);
          return;
        }
        handleFailure(
          result.error.kind === "rule"
            ? { kind: "rule", code: result.error.violation.code }
            : { kind: result.error.kind },
        );
        return;
      }
      // 外した後の出所（引き継ぎ先の月）を読み直して、知らせの文を決める（BR4.3）。
      const after = await book.getEffectiveBudgets(budget.month);
      const next = after.ok
        ? after.value.find((row) => row.categoryId === budget.categoryId)
        : undefined;
      const message = !after.ok
        ? APP_MESSAGES.budget.clearedPlain(name)
        : next?.source.kind === "carried"
          ? APP_MESSAGES.budget.clearedCarried(name, formatMonthLabel(next.source.from))
          : APP_MESSAGES.budget.clearedNone(name);
      onNotice(createNotice("success", message));
      onChanged();
      inputRef.current?.focus();
    });
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void save();
  };

  return (
    <tr>
      <th scope="row" data-label={APP_MESSAGES.budget.columns.category}>
        {name}
      </th>
      <td data-label={APP_MESSAGES.budget.columns.amount}>
        <input
          ref={inputRef}
          id={inputId}
          className="uk-input"
          type="text"
          inputMode="numeric"
          value={draft}
          aria-label={APP_MESSAGES.budget.inputAria(name, monthLabel)}
          aria-invalid={errors.length > 0 || undefined}
          aria-describedby={errors.length > 0 ? errorId : undefined}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
        />{" "}
        <span className="app-muted">{sourceText(budget)}</span>
        {errors.map((error) => (
          <FieldError
            key={error.code}
            id={errorId}
            field={APP_MESSAGES.budget.budgetFieldLabel}
            message={error.message}
          />
        ))}
        {rowMessage !== null && <InlineMessage tone="error">{rowMessage}</InlineMessage>}
      </td>
      <td data-label={APP_MESSAGES.budget.columns.actions}>
        <div className="app-actions">
          <Button
            busy={saving}
            busyLabel={APP_MESSAGES.budget.saving}
            aria-label={APP_MESSAGES.budget.saveAria(name)}
            onClick={() => void save()}
          >
            {APP_MESSAGES.budget.save}
          </Button>
          {budget.source.kind === "set" && (
            <Button
              disabled={saving}
              aria-label={APP_MESSAGES.budget.clearAria(name)}
              onClick={() => void clear()}
            >
              {APP_MESSAGES.budget.clear}
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

interface BudgetTableProps {
  month: YearMonth;
  budgets: readonly EffectiveBudget[];
  categories: readonly Category[];
  busy: boolean;
  onNotice: (notice: Notice) => void;
  onChanged: () => void;
  onNewerVersion: () => void;
}

function BudgetTable({
  month,
  budgets,
  categories,
  busy,
  onNotice,
  onChanged,
  onNewerVersion,
}: BudgetTableProps): ReactNode {
  const monthLabel = formatMonthLabel(month);
  return (
    <table className="uk-table" aria-busy={busy || undefined}>
      <caption className="uk-table__caption">{`${monthLabel}の支出カテゴリの予算`}</caption>
      <thead>
        <tr>
          <th scope="col">{APP_MESSAGES.budget.columns.category}</th>
          <th scope="col">{APP_MESSAGES.budget.columns.amount}</th>
          <th scope="col">{APP_MESSAGES.budget.columns.actions}</th>
        </tr>
      </thead>
      <tbody>
        {budgets.map((budget) => (
          <BudgetRow
            key={`${month}|${budget.categoryId}`}
            name={categoryNameFor(categories, budget.categoryId)}
            budget={budget}
            monthLabel={monthLabel}
            onNotice={onNotice}
            onChanged={onChanged}
            onNewerVersion={onNewerVersion}
          />
        ))}
      </tbody>
    </table>
  );
}

export function BudgetScreen() {
  const { book, month, setMonth, onNewerVersion } = useShell();
  const categoriesRead = useLatestRead(() => book.listCategories(), "categories", onNewerVersion);
  const budgetsRead = useLatestRead(() => book.getEffectiveBudgets(month), month, onNewerVersion);
  const [notice, setNotice] = useState<Notice | null>(null);

  return (
    <div className="app-screen">
      <div className="app-actions">
        <h2 className="app-section__title">{APP_MESSAGES.budget.title}</h2>
        <MonthNavigator month={month} onChange={setMonth} />
      </div>
      <p className="app-hint">{APP_MESSAGES.budget.intro}</p>
      <NoticeView notice={notice} onHidden={() => setNotice(null)} />
      <ReadView
        view={categoriesRead.view}
        subject={APP_MESSAGES.budget.subject}
        onRetry={categoriesRead.reload}
      >
        {(categories) => (
          <ReadView
            view={budgetsRead.view}
            subject={APP_MESSAGES.budget.subject}
            onRetry={budgetsRead.reload}
          >
            {(budgets, busy) => (
              <BudgetTable
                month={month}
                budgets={budgets}
                categories={categories}
                busy={busy}
                onNotice={setNotice}
                onChanged={budgetsRead.reload}
                onNewerVersion={onNewerVersion}
              />
            )}
          </ReadView>
        )}
      </ReadView>
    </div>
  );
}
