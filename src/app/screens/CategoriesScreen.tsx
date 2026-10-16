// カテゴリタブ（S4、US3.1〜US3.4、BR3.1〜BR3.5）。一覧（支出と収入）、追加、名前変更（Esc で取り消し）、削除（使用中・最後の1件は理由を行の下に、それ以外は D2 で確認）。
// 書き込みは U4 の操作。成功のあとは一覧と使用件数を U4 から取り直す（BR1.5）。食い違いは BR3.5 の文言で画面の更新を促す。
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { CategoryUsage } from "../../bookkeeping-core";
import type { Category, EntryType, ValidationError } from "../../data-contract";
import { Button, FieldError, InlineMessage, RadioGroup, TextField } from "../../ui-kit";
import { useShell } from "../appState";
import {
  APP_MESSAGES,
  DELETE_FAILED_TEXT,
  SAVE_FAILED_TEXT,
  STALE_SELECTION_TEXT,
} from "../messages";
import { useLatestRead } from "../reads";
import { createNotice, NoticeView, ReadView } from "../status";
import type { DialogState, Notice } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";

const NO_USAGE: CategoryUsage = { transactions: 0, budgets: 0 };
const HEADING_ID = "category-heading";

function renameKey(id: string): string {
  return `rename:${id}`;
}

function deleteKey(id: string): string {
  return `delete:${id}`;
}

export function CategoriesScreen() {
  const { book, onNewerVersion } = useShell();
  const categoriesRead = useLatestRead(() => book.listCategories(), "categories", onNewerVersion);
  const usageRead = useLatestRead(() => book.getCategoryUsage(), "usage", onNewerVersion);

  const [notice, setNotice] = useState<Notice | null>(null);
  // 追加の欄
  const [addType, setAddType] = useState<EntryType>("expense");
  const [addName, setAddName] = useState("");
  const [addErrors, setAddErrors] = useState<ValidationError[]>([]);
  const [addMessage, setAddMessage] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);
  const addBusyRef = useRef(false);
  const addNameRef = useRef<HTMLInputElement>(null);
  // 名前の変更（行ごと、同時に1行）
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameErrors, setRenameErrors] = useState<ValidationError[]>([]);
  const [renameMessage, setRenameMessage] = useState<string | null>(null);
  const [renameBusy, setRenameBusy] = useState(false);
  const renameBusyRef = useRef(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  // 行の下の理由（使用中・最後の1件・食い違い・削除の失敗）
  const [rowMessages, setRowMessages] = useState<Record<string, string>>({});
  // D2（カテゴリの削除の確認）
  const dialogReturnRef = useRef<HTMLElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [dialog, setDialog] = useState<DialogState>({
    kind: "none",
    target: null,
    busy: false,
    error: null,
  });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const buttonsRef = useRef(new Map<string, HTMLButtonElement>());
  // 描画の後にフォーカスする操作の鍵（名前の変更の終わり、削除の後など）。
  const pendingFocusRef = useRef<string | null>(null);

  useEffect(() => {
    const key = pendingFocusRef.current;
    if (key === null) return;
    pendingFocusRef.current = null;
    const element = buttonsRef.current.get(key);
    if (element !== undefined && element.isConnected) element.focus();
    else headingRef.current?.focus();
  });

  function registerButton(key: string, element: HTMLButtonElement | null): void {
    if (element === null) buttonsRef.current.delete(key);
    else buttonsRef.current.set(key, element);
  }

  function reloadAll(): void {
    categoriesRead.reload();
    usageRead.reload();
  }

  function setRowMessage(id: string, text: string | null): void {
    setRowMessages((current) => {
      const next = { ...current };
      if (text === null) delete next[id];
      else next[id] = text;
      return next;
    });
  }

  async function submitAdd(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (addBusyRef.current) return;
    addBusyRef.current = true;
    setAddBusy(true);
    setAddErrors([]);
    setAddMessage(null);
    try {
      const result = await book.addCategory(addType, addName);
      if (result.ok) {
        setAddName("");
        setNotice(createNotice("success", APP_MESSAGES.categories.added(result.value.name)));
        reloadAll();
      } else if (result.error.kind === "validation") {
        setAddErrors(result.error.errors);
        addNameRef.current?.focus();
      } else if (result.error.kind === "newer-version") {
        onNewerVersion();
      } else {
        setAddMessage(SAVE_FAILED_TEXT);
      }
    } catch {
      // 想定外の例外も保存の失敗として表示する（黙って捨てない）。
      setAddMessage(SAVE_FAILED_TEXT);
    } finally {
      addBusyRef.current = false;
      setAddBusy(false);
    }
  }

  function startRename(category: Category): void {
    setRowMessage(category.id, null);
    setRenameMessage(null);
    setRenameErrors([]);
    setRenameDraft(category.name);
    setRenameId(category.id);
  }

  /** 名前の変更をやめ、押した「名前を変更」へフォーカスを戻す（Esc・キャンセル。BR3.3）。 */
  function cancelRename(): void {
    if (renameId !== null) pendingFocusRef.current = renameKey(renameId);
    setRenameId(null);
    setRenameErrors([]);
    setRenameMessage(null);
  }

  async function saveRename(category: Category): Promise<void> {
    if (renameBusyRef.current) return;
    renameBusyRef.current = true;
    setRenameBusy(true);
    setRenameErrors([]);
    setRenameMessage(null);
    try {
      const result = await book.renameCategory(category.id, renameDraft);
      if (result.ok) {
        setRenameId(null);
        setNotice(createNotice("success", APP_MESSAGES.categories.renamed));
        pendingFocusRef.current = renameKey(category.id);
        reloadAll();
      } else if (result.error.kind === "validation") {
        setRenameErrors(result.error.errors);
        renameInputRef.current?.focus();
      } else if (result.error.kind === "rule") {
        // 別のタブで消えた等。名前の変更をやめて、行の下に画面の更新を促す（BR3.5）。
        setRenameId(null);
        setRowMessage(category.id, STALE_SELECTION_TEXT);
        reloadAll();
      } else if (result.error.kind === "newer-version") {
        onNewerVersion();
      } else {
        setRenameMessage(SAVE_FAILED_TEXT);
      }
    } catch {
      setRenameMessage(SAVE_FAILED_TEXT);
    } finally {
      renameBusyRef.current = false;
      setRenameBusy(false);
    }
  }

  function requestDelete(category: Category, usage: CategoryUsage, sameTypeCount: number): void {
    // 使われているもの・種別の最後の1件は削除せず、理由を行の下に出す（押せるボタンのまま。BR3.4）。
    if (usage.transactions > 0) {
      setRowMessage(category.id, APP_MESSAGES.categories.inUse(usage.transactions));
      return;
    }
    if (sameTypeCount <= 1) {
      setRowMessage(category.id, APP_MESSAGES.categories.lastOfType);
      return;
    }
    setRowMessage(category.id, null);
    dialogReturnRef.current = buttonsRef.current.get(deleteKey(category.id)) ?? null;
    setDialog({ kind: "deleteCategory", target: category.id, busy: false, error: null });
  }

  function closeDialog(): void {
    setDialog((current) => ({ ...current, kind: "none", target: null, busy: false, error: null }));
  }

  /** D2 の確定。確定の失敗は D2 を閉じて、その行の下に理由を出す（BR3.4）。 */
  async function confirmDelete(category: Category): Promise<void> {
    if (dialog.busy) return;
    setDialog((current) => ({ ...current, busy: true }));
    const failInRow = (text: string) => {
      closeDialog();
      setRowMessage(category.id, text);
      reloadAll();
    };
    try {
      const result = await book.deleteCategory(category.id);
      if (result.ok) {
        const deletedBudgets = result.value.deletedBudgets;
        const message =
          deletedBudgets > 0
            ? APP_MESSAGES.categories.deletedWithBudgets(category.name, deletedBudgets)
            : APP_MESSAGES.categories.deleted(category.name);
        dialogReturnRef.current = headingRef.current;
        closeDialog();
        setNotice(createNotice("success", message));
        reloadAll();
        return;
      }
      if (result.error.kind === "newer-version") {
        closeDialog();
        onNewerVersion();
        return;
      }
      if (result.error.kind === "rule") {
        const violation = result.error.violation;
        if (violation.code === "category-in-use") {
          failInRow(APP_MESSAGES.categories.inUse(violation.count));
          return;
        }
        if (violation.code === "last-category-of-type") {
          failInRow(APP_MESSAGES.categories.lastOfType);
          return;
        }
        if (violation.code === "not-found" || violation.code === "category-type-mismatch") {
          failInRow(STALE_SELECTION_TEXT);
          return;
        }
      }
      failInRow(DELETE_FAILED_TEXT);
    } catch {
      // 想定外の例外も失敗として行の下に出す（黙って捨てない）。
      failInRow(DELETE_FAILED_TEXT);
    }
  }

  return (
    <div className="app-screen">
      <h2 id={HEADING_ID} ref={headingRef} className="app-section__title" tabIndex={-1}>
        {APP_MESSAGES.categories.title}
      </h2>
      <form
        className="app-section"
        aria-labelledby="category-add-title"
        onSubmit={(event) => void submitAdd(event)}
      >
        <h3 id="category-add-title" className="app-section__title">
          {APP_MESSAGES.categories.addLegend}
        </h3>
        <div className="app-form-row">
          <RadioGroup<EntryType>
            legend={APP_MESSAGES.categories.typeLegend}
            name="category-add-type"
            value={addType}
            options={[
              { value: "expense", label: APP_MESSAGES.categories.typeExpense },
              { value: "income", label: APP_MESSAGES.categories.typeIncome },
            ]}
            onChange={setAddType}
          />
          <div>
            <TextField
              id="category-add-name"
              label={APP_MESSAGES.categories.nameLabel}
              value={addName}
              onChange={setAddName}
              error={addErrors[0]?.message}
              ref={addNameRef}
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            busy={addBusy}
            busyLabel={APP_MESSAGES.categories.adding}
          >
            {APP_MESSAGES.categories.addButton}
          </Button>
        </div>
        {addMessage !== null && <InlineMessage tone="error">{addMessage}</InlineMessage>}
      </form>
      <NoticeView notice={notice} onHidden={() => setNotice(null)} />
      <ReadView
        view={categoriesRead.view}
        subject={APP_MESSAGES.categories.subject}
        onRetry={categoriesRead.reload}
      >
        {(categories, busyCategories) => (
          <ReadView
            view={usageRead.view}
            subject={APP_MESSAGES.categories.subject}
            onRetry={usageRead.reload}
          >
            {(usage, busyUsage) => {
              const usageOf = (id: string) => usage[id] ?? NO_USAGE;
              const sections: { type: EntryType; heading: string }[] = [
                {
                  type: "expense",
                  heading: APP_MESSAGES.categories.expenseHeading(
                    categories.filter((c) => c.type === "expense").length,
                  ),
                },
                {
                  type: "income",
                  heading: APP_MESSAGES.categories.incomeHeading(
                    categories.filter((c) => c.type === "income").length,
                  ),
                },
              ];
              const target = categories.find((category) => category.id === dialog.target);
              const targetUsage = target === undefined ? NO_USAGE : usageOf(target.id);
              return (
                <>
                  {sections.map((section) => {
                    const rows = categories.filter((category) => category.type === section.type);
                    return (
                      <section
                        key={section.type}
                        className="app-section"
                        aria-label={section.heading}
                      >
                        <h3 className="app-section__title">{section.heading}</h3>
                        <table
                          className="uk-table"
                          aria-busy={busyCategories || busyUsage || undefined}
                        >
                          <caption className="uk-table__caption">{section.heading}</caption>
                          <thead>
                            <tr>
                              <th scope="col">{APP_MESSAGES.categories.columns.name}</th>
                              <th scope="col">{APP_MESSAGES.categories.columns.usage}</th>
                              <th scope="col">{APP_MESSAGES.categories.columns.actions}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((category) => {
                              const categoryUsage = usageOf(category.id);
                              const renaming = renameId === category.id;
                              return (
                                <tr key={category.id}>
                                  <th scope="row" data-label={APP_MESSAGES.categories.columns.name}>
                                    {renaming ? (
                                      <>
                                        <input
                                          ref={renameInputRef}
                                          className="uk-input"
                                          type="text"
                                          autoFocus
                                          aria-label={APP_MESSAGES.categories.renameAria(
                                            category.name,
                                          )}
                                          aria-invalid={renameErrors.length > 0 || undefined}
                                          value={renameDraft}
                                          onChange={(event) =>
                                            setRenameDraft(event.currentTarget.value)
                                          }
                                          onKeyDown={(event) => {
                                            if (event.key === "Escape") cancelRename();
                                            if (
                                              event.key === "Enter" &&
                                              !event.nativeEvent.isComposing
                                            ) {
                                              event.preventDefault();
                                              void saveRename(category);
                                            }
                                          }}
                                        />
                                        {renameErrors.map((error) => (
                                          <FieldError
                                            key={error.code}
                                            id={`rename-${category.id}-error`}
                                            field={APP_MESSAGES.categories.nameLabel}
                                            message={error.message}
                                          />
                                        ))}
                                        {renameMessage !== null && (
                                          <InlineMessage tone="error">
                                            {renameMessage}
                                          </InlineMessage>
                                        )}
                                      </>
                                    ) : (
                                      category.name
                                    )}
                                  </th>
                                  <td data-label={APP_MESSAGES.categories.columns.usage}>
                                    {APP_MESSAGES.categories.usageCount(categoryUsage.transactions)}
                                  </td>
                                  <td data-label={APP_MESSAGES.categories.columns.actions}>
                                    {renaming ? (
                                      <div className="app-actions">
                                        <Button
                                          busy={renameBusy}
                                          busyLabel={APP_MESSAGES.categories.save}
                                          onClick={() => void saveRename(category)}
                                        >
                                          {APP_MESSAGES.categories.save}
                                        </Button>
                                        <Button onClick={cancelRename}>
                                          {APP_MESSAGES.categories.cancel}
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className="app-actions">
                                        <Button
                                          aria-label={APP_MESSAGES.categories.renameAria(
                                            category.name,
                                          )}
                                          ref={(element) =>
                                            registerButton(renameKey(category.id), element)
                                          }
                                          onClick={() => startRename(category)}
                                        >
                                          {APP_MESSAGES.categories.rename}
                                        </Button>
                                        <Button
                                          variant="danger"
                                          aria-label={APP_MESSAGES.categories.deleteAria(
                                            category.name,
                                          )}
                                          ref={(element) =>
                                            registerButton(deleteKey(category.id), element)
                                          }
                                          onClick={() =>
                                            requestDelete(category, categoryUsage, rows.length)
                                          }
                                        >
                                          {APP_MESSAGES.categories.delete}
                                        </Button>
                                      </div>
                                    )}
                                    {rowMessages[category.id] !== undefined && (
                                      <InlineMessage tone="error">
                                        {rowMessages[category.id]}
                                      </InlineMessage>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </section>
                    );
                  })}
                  <ConfirmDialog
                    open={dialog.kind === "deleteCategory" && target !== undefined}
                    title={
                      target === undefined ? "" : APP_MESSAGES.categories.confirmTitle(target.name)
                    }
                    body={
                      targetUsage.budgets > 0 ? (
                        <p>{APP_MESSAGES.categories.confirmBudgets(targetUsage.budgets)}</p>
                      ) : null
                    }
                    confirmLabel={APP_MESSAGES.categories.confirmDelete}
                    busyLabel={APP_MESSAGES.categories.deleting}
                    busy={dialog.busy}
                    error={dialog.error}
                    cancelRef={cancelRef}
                    returnFocusRef={dialogReturnRef}
                    onConfirm={() => {
                      if (target !== undefined) void confirmDelete(target);
                    }}
                    onCancel={closeDialog}
                  />
                </>
              );
            }}
          </ReadView>
        )}
      </ReadView>
    </div>
  );
}
