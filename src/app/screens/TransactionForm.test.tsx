// 収支の登録と編集のフォーム（US2.1、US2.2、US2.4、US8.3、US9.3）。入力エラー・空の入力・保存失敗・二重送信・キーボード操作を確かめる。
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, type Mock } from "vitest";
import type { Book } from "../../bookkeeping-core";
import { expectNoAxeViolations } from "../../ui-kit/test-fixtures";
import { categoryIdNamed, loadCategories, readyBook, renderInShell } from "../test-fixtures";
import type { Category, Transaction } from "../../data-contract";
import { TransactionForm } from "./TransactionForm";

const TODAY = "2026-10-16";

// 必須の印（*）は読み上げの名前に含めないため、役割と名前で引く。
const dateField = () => screen.getByRole("textbox", { name: "日付" });
const amountField = () => screen.getByRole("textbox", { name: "金額（円・整数）" });
const memoField = () => screen.getByRole("textbox", { name: "メモ（200文字まで）" });
const categoryField = () => screen.getByRole("combobox", { name: "カテゴリ" });

async function seedFood(book: Book, categories: readonly Category[]): Promise<Transaction> {
  const result = await book.addTransaction({
    date: "2026-10-01",
    type: "expense",
    categoryId: categoryIdNamed(categories, "食費"),
    amount: "1200",
    memo: "架空のランチ",
  });
  if (!result.ok) throw new Error("テストの前提の収支を作れませんでした");
  return result.value;
}

type SavedCallback = (saved: Transaction, mode: "create" | "edit") => void;
type VoidCallback = () => void;

function renderForm(
  book: Book,
  categories: readonly Category[],
  options: {
    editing?: Transaction | null;
    onSaved?: Mock<SavedCallback>;
    onCancelEdit?: Mock<VoidCallback>;
    onStale?: Mock<VoidCallback>;
    onNewerVersion?: Mock<VoidCallback>;
  } = {},
) {
  const onSaved = options.onSaved ?? vi.fn<SavedCallback>();
  const onCancelEdit = options.onCancelEdit ?? vi.fn<VoidCallback>();
  const onStale = options.onStale ?? vi.fn<VoidCallback>();
  const onNewerVersion = options.onNewerVersion ?? vi.fn<VoidCallback>();
  const view = renderInShell(
    <TransactionForm
      key={options.editing?.id ?? "create"}
      categories={categories}
      editing={options.editing ?? null}
      today={TODAY}
      onSaved={onSaved}
      onCancelEdit={onCancelEdit}
      onStale={onStale}
    />,
    book,
    { onNewerVersion },
  );
  return { ...view, onSaved, onCancelEdit, onStale, onNewerVersion };
}

describe("収支の登録フォーム", () => {
  it("日付の初期値は今日、種別は支出で、カテゴリは支出の先頭になる（BR2.1）", async () => {
    const book = await readyBook();
    const categories = await loadCategories(book);
    renderForm(book, categories);
    expect(dateField()).toHaveValue(TODAY);
    expect(screen.getByRole("radio", { name: "支出" })).toBeChecked();
    expect(categoryField()).toHaveValue(categoryIdNamed(categories, "食費"));
  });

  it("登録に成功したら、日付と種別を残し、カテゴリ・金額・メモを空にして金額へフォーカスを戻す（BR2.1）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    const categories = await loadCategories(book);
    const { onSaved } = renderForm(book, categories);
    await user.selectOptions(categoryField(), categoryIdNamed(categories, "食費"));
    await user.type(amountField(), "1200");
    await user.type(memoField(), "架空のランチ");
    await user.click(screen.getByRole("button", { name: "登録する" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(onSaved.mock.calls[0]?.[1]).toBe("create");
    expect(amountField()).toHaveValue("");
    expect(memoField()).toHaveValue("");
    expect(dateField()).toHaveValue(TODAY);
    expect(amountField()).toHaveFocus();
  });

  it("入力エラーは項目ごとに表示し、最初のエラーの項目へフォーカスを移し、入力を残す（BR1.1、BR9.3）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    const categories = await loadCategories(book);
    const { onSaved } = renderForm(book, categories);
    const dateInput = dateField();
    await user.clear(dateInput);
    await user.type(dateInput, "2026-13-01");
    await user.type(amountField(), "12.5");
    await user.click(screen.getByRole("button", { name: "登録する" }));

    expect(await screen.findByText("2件の項目を確認してください")).toBeInTheDocument();
    expect(dateInput).toHaveAttribute("aria-invalid", "true");
    expect(amountField()).toHaveAttribute("aria-invalid", "true");
    expect(dateInput).toHaveFocus();
    expect(dateInput).toHaveValue("2026-13-01");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("別のタブで消えたカテゴリは、同じ文言と画面を更新する導線を出し、入力は残す（BR3.5）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    const categories = await loadCategories(book);
    vi.spyOn(book, "addTransaction").mockResolvedValue({
      ok: false,
      error: { kind: "rule", violation: { code: "category-missing" } },
    });
    const { onStale, onSaved } = renderForm(book, categories);
    await user.type(amountField(), "500");
    await user.click(screen.getByRole("button", { name: "登録する" }));

    expect(
      await screen.findByText("⚠ 選んだカテゴリが見つかりません。画面を更新してください"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "画面を更新" }));
    expect(onStale).toHaveBeenCalledTimes(1);
    expect(amountField()).toHaveValue("500");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("保存に失敗したら、入力を残し、一覧には追加しない（BR8.3）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    const categories = await loadCategories(book);
    vi.spyOn(book, "addTransaction").mockResolvedValue({
      ok: false,
      error: { kind: "storage", message: "保存できませんでした" },
    });
    const { onSaved } = renderForm(book, categories);
    await user.type(amountField(), "700");
    await user.click(screen.getByRole("button", { name: "登録する" }));

    expect(
      await screen.findByText("保存できませんでした。入力内容はそのまま残っています。"),
    ).toBeInTheDocument();
    expect(screen.getByText("もう一度「登録する」を押すと再試行します。")).toBeInTheDocument();
    expect(amountField()).toHaveValue("700");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("保存の処理が例外で失敗しても、保存の失敗として表示する（黙って捨てない）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    const categories = await loadCategories(book);
    vi.spyOn(book, "addTransaction").mockRejectedValue(new Error("想定外"));
    renderForm(book, categories);
    await user.type(amountField(), "700");
    await user.click(screen.getByRole("button", { name: "登録する" }));
    expect(
      await screen.findByText("保存できませんでした。入力内容はそのまま残っています。"),
    ).toBeInTheDocument();
  });

  it("保存中は送信を受け付けず、二重の送信を1回にまとめる（BR2.2）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    const categories = await loadCategories(book);
    // 保存を保留にして、保存中に2回押す（完了を待ってから押すと、2回目は正当な送信になる）。
    const originalAdd = book.addTransaction.bind(book);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const addSpy = vi.spyOn(book, "addTransaction").mockImplementation(async (input) => {
      await gate;
      return originalAdd(input);
    });
    const { onSaved } = renderForm(book, categories);
    await user.type(amountField(), "300");
    const button = screen.getByRole("button", { name: "登録する" });
    await user.click(button);
    await user.click(button);
    release();
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(addSpy).toHaveBeenCalledTimes(1);
  });

  it("入力欄で Enter を押すと登録する（キーボードだけで操作できる。BR2.1）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    const categories = await loadCategories(book);
    const { onSaved } = renderForm(book, categories);
    await user.type(amountField(), "450{Enter}");
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it("新しい版のデータが返ったら、S0-b への切り替えを呼ぶ（BR1.6）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    const categories = await loadCategories(book);
    vi.spyOn(book, "addTransaction").mockResolvedValue({
      ok: false,
      error: { kind: "newer-version" },
    });
    const { onNewerVersion } = renderForm(book, categories);
    await user.type(amountField(), "100");
    await user.click(screen.getByRole("button", { name: "登録する" }));
    await waitFor(() => expect(onNewerVersion).toHaveBeenCalledTimes(1));
  });

  it("自動のアクセシビリティ検査で違反がない（NFR2.2）", async () => {
    const book = await readyBook();
    const categories = await loadCategories(book);
    const { container } = renderForm(book, categories);
    await expectNoAxeViolations(container);
  });
});

describe("収支の編集フォーム", () => {
  it("編集では見出しに対象を示し、日付へフォーカスし、Esc で取り消す（BR2.4、流れ B）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    const categories = await loadCategories(book);
    const existing = await seedFood(book, categories);
    const { onCancelEdit } = renderForm(book, categories, { editing: existing });

    expect(
      screen.getByRole("heading", { name: "収支の編集（2026-10-01 食費 1,200円）" }),
    ).toBeInTheDocument();
    expect(dateField()).toHaveFocus();
    expect(dateField()).toHaveValue("2026-10-01");
    expect(screen.getByRole("button", { name: "変更を保存" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(onCancelEdit).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onCancelEdit).toHaveBeenCalledTimes(2);
  });

  it("編集の保存は U4 の更新を使い、成功を親へ伝える", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    const categories = await loadCategories(book);
    const existing = await seedFood(book, categories);
    const updateSpy = vi.spyOn(book, "updateTransaction");
    const { onSaved } = renderForm(book, categories, { editing: existing });
    const amount = amountField();
    await user.clear(amount);
    await user.type(amount, "1500");
    await user.click(screen.getByRole("button", { name: "変更を保存" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(updateSpy).toHaveBeenCalledWith(
      existing.id,
      expect.objectContaining({ amount: "1500" }),
    );
    expect(onSaved.mock.calls[0]?.[1]).toBe("edit");
  });
});
