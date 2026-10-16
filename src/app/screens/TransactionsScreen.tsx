// 収支タブ（S1、US2.1〜US2.5、US8.1〜US8.3、US9.3）。登録フォーム・月の一覧・編集・削除（D1）を組み合わせる。
// 読み取りは reads の窓口（最新の要求だけ）。書き込みは U4 の収支の操作。成功のあとは表示を U4 から取り直す（BR1.5）。
import { useRef, useState } from "react";
import { toYearMonth, type Category, type Transaction } from "../../data-contract";
import { localIsoDate, useShell } from "../appState";
import { MonthNavigator } from "../MonthNavigator";
import { formatEntryType, formatMonthLabel, formatYen } from "../format";
import { APP_MESSAGES, DELETE_FAILED_TEXT, STALE_SELECTION_TEXT } from "../messages";
import { useLatestRead } from "../reads";
import { createNotice, NoticeView, ReadView } from "../status";
import type { DialogState, Notice } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { TransactionForm } from "./TransactionForm";
import { deleteButtonKey, editButtonKey, TransactionList } from "./TransactionList";

const LIST_HEADING_ID = "tx-list-title";

function categoryNameFor(categories: readonly Category[], categoryId: string): string {
  return (
    categories.find((category) => category.id === categoryId)?.name ??
    APP_MESSAGES.transactions.fallbackCategoryName
  );
}

export function TransactionsScreen() {
  const { book, month, setMonth, onNewerVersion } = useShell();
  const transactionsRead = useLatestRead(() => book.listTransactions(month), month, onNewerVersion);
  const categoriesRead = useLatestRead(() => book.listCategories(), "categories", onNewerVersion);

  const [editing, setEditing] = useState<Transaction | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [today] = useState(() => localIsoDate(new Date()));
  // 閉じたときのフォーカスの戻し先。状態には入れず、画面が持つ（閉じる直前に差し替えるため）。
  const dialogReturnRef = useRef<HTMLElement | null>(null);
  const [dialog, setDialog] = useState<DialogState>({
    kind: "none",
    target: null,
    busy: false,
    error: null,
  });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formSectionRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const buttonsRef = useRef(new Map<string, HTMLButtonElement>());
  // 編集を始めた「編集」ボタンの鍵（終わったら同じボタンへフォーカスを戻す。BR2.4）。
  const editOpenerRef = useRef<string | null>(null);

  function registerButton(key: string, element: HTMLButtonElement | null): void {
    if (element === null) buttonsRef.current.delete(key);
    else buttonsRef.current.set(key, element);
  }

  /** 鍵の操作ボタンがあればそこへ、なければ一覧の見出しへフォーカスを移す。 */
  function focusButtonOrHeading(key: string | null): void {
    const element = key === null ? undefined : buttonsRef.current.get(key);
    if (element !== undefined && element.isConnected) element.focus();
    else headingRef.current?.focus();
  }

  function goToForm(): void {
    formSectionRef.current?.querySelector("input")?.focus();
  }

  function startEdit(transaction: Transaction): void {
    editOpenerRef.current = editButtonKey(transaction.id);
    setNotice(null);
    setEditing(transaction);
  }

  function finishEdit(): void {
    const opener = editOpenerRef.current;
    editOpenerRef.current = null;
    setEditing(null);
    focusButtonOrHeading(opener);
  }

  function handleSaved(saved: Transaction, mode: "create" | "edit"): void {
    if (mode === "create") {
      setNotice(createNotice("success", APP_MESSAGES.transactions.created));
    } else if (toYearMonth(saved.date) !== month) {
      // 別の月へ移った。共有の対象月は変えず、移動先を一覧の上で知らせる（BR2.4）。
      editOpenerRef.current = null;
      setEditing(null);
      setNotice(
        createNotice(
          "success",
          APP_MESSAGES.transactions.moved(formatMonthLabel(toYearMonth(saved.date))),
        ),
      );
      headingRef.current?.focus();
    } else {
      setNotice(createNotice("success", APP_MESSAGES.transactions.updated));
      finishEdit();
    }
    transactionsRead.reload();
  }

  function handleStale(): void {
    categoriesRead.reload();
    transactionsRead.reload();
  }

  function requestDelete(transaction: Transaction): void {
    dialogReturnRef.current = buttonsRef.current.get(deleteButtonKey(transaction.id)) ?? null;
    setDialog({
      kind: "deleteTransaction",
      target: transaction.id,
      busy: false,
      error: null,
    });
  }

  function closeDialog(): void {
    setDialog((current) => ({ ...current, kind: "none", target: null, busy: false, error: null }));
  }

  async function confirmDelete(rows: readonly Transaction[]): Promise<void> {
    const target = dialog.target;
    if (target === null || dialog.busy) return;
    setDialog((current) => ({ ...current, busy: true, error: null }));
    try {
      const result = await book.deleteTransaction(target);
      if (result.ok) {
        // 次の行の「削除」へ戻す（なければ見出し）。ダイアログが閉じるときにこの参照を読む（BR2.5）。
        const index = rows.findIndex((row) => row.id === target);
        const next = index >= 0 ? rows[index + 1] : undefined;
        dialogReturnRef.current =
          (next !== undefined ? buttonsRef.current.get(deleteButtonKey(next.id)) : undefined) ??
          headingRef.current;
        closeDialog();
        setNotice(createNotice("success", APP_MESSAGES.transactions.deleted));
        transactionsRead.reload();
        return;
      }
      if (result.error.kind === "newer-version") {
        onNewerVersion();
        return;
      }
      if (result.error.kind === "rule" && result.error.violation.code === "not-found") {
        // 別のタブで消えていた（BR3.5 の文言で画面の更新を促す）。
        closeDialog();
        setNotice(createNotice("error", STALE_SELECTION_TEXT));
        transactionsRead.reload();
        return;
      }
      setDialog((current) => ({ ...current, busy: false, error: DELETE_FAILED_TEXT }));
    } catch {
      // 想定外の例外も失敗として表示する（黙って捨てない）。
      setDialog((current) => ({ ...current, busy: false, error: DELETE_FAILED_TEXT }));
    }
  }

  return (
    <div className="app-screen">
      <ReadView
        view={categoriesRead.view}
        subject={APP_MESSAGES.transactions.loadingSubject}
        onRetry={categoriesRead.reload}
      >
        {(categories) => {
          const rows: readonly Transaction[] =
            transactionsRead.view.state === "failed" ? [] : (transactionsRead.view.data ?? []);
          const targetRow = rows.find((row) => row.id === dialog.target);
          // 一覧の読み込み中・失敗の間は登録・編集の送信を受け付けない（BR8.1、BR8.2）。フォームは表示したまま無効にする。
          const listUnavailable =
            transactionsRead.view.state === "loading" || transactionsRead.view.state === "failed";
          return (
            <>
              <div ref={formSectionRef}>
                <TransactionForm
                  key={editing?.id ?? "create"}
                  categories={categories}
                  editing={editing}
                  today={today}
                  onSaved={handleSaved}
                  onCancelEdit={finishEdit}
                  onStale={handleStale}
                  disabled={listUnavailable}
                />
              </div>
              <NoticeView notice={notice} onHidden={() => setNotice(null)} />
              <section className="app-section" aria-labelledby={LIST_HEADING_ID}>
                <div className="app-actions">
                  <h2
                    id={LIST_HEADING_ID}
                    ref={headingRef}
                    className="app-section__title"
                    tabIndex={-1}
                  >
                    {APP_MESSAGES.transactions.listTitle}
                  </h2>
                  <MonthNavigator month={month} onChange={setMonth} />
                </div>
                <ReadView
                  view={transactionsRead.view}
                  subject={APP_MESSAGES.transactions.loadingSubject}
                  onRetry={transactionsRead.reload}
                >
                  {(transactions, busy) => (
                    <TransactionList
                      month={month}
                      transactions={transactions}
                      categories={categories}
                      editingId={editing?.id ?? null}
                      busy={busy}
                      onEdit={startEdit}
                      onDelete={requestDelete}
                      onGoToForm={goToForm}
                      registerButton={registerButton}
                    />
                  )}
                </ReadView>
              </section>
              <ConfirmDialog
                open={dialog.kind === "deleteTransaction"}
                title={APP_MESSAGES.transactions.confirmTitle}
                body={
                  targetRow === undefined ? null : (
                    <>
                      <p>{`${targetRow.date} ${formatEntryType(targetRow.type)} ${categoryNameFor(categories, targetRow.categoryId)} ${formatYen(targetRow.amount)}`}</p>
                      {targetRow.memo !== "" && (
                        <p>{APP_MESSAGES.transactions.memoLine(targetRow.memo)}</p>
                      )}
                      <p>{APP_MESSAGES.transactions.confirmWarning}</p>
                    </>
                  )
                }
                confirmLabel={APP_MESSAGES.transactions.confirmDelete}
                busyLabel={APP_MESSAGES.transactions.deleting}
                busy={dialog.busy}
                error={dialog.error}
                cancelRef={cancelRef}
                returnFocusRef={dialogReturnRef}
                onConfirm={() => void confirmDelete(rows)}
                onCancel={closeDialog}
              />
            </>
          );
        }}
      </ReadView>
    </div>
  );
}
