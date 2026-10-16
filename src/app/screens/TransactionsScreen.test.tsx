// 収支タブ（US2.1〜US2.5、US8.1〜US8.3、US9.2、US9.3）。登録・編集・移動・削除（D1）・空の月・読み込みと保存の失敗を、保存を差し替えた Book で確かめる。
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, type Mock } from "vitest";
import type { Book } from "../../bookkeeping-core";
import { expectNoAxeViolations } from "../../ui-kit/test-fixtures";
import { categoryIdNamed, loadCategories, readyBook, renderInShell } from "../test-fixtures";
import { TransactionsScreen } from "./TransactionsScreen";

async function seed(book: Book): Promise<void> {
  const categories = await loadCategories(book);
  const food = categoryIdNamed(categories, "食費");
  const first = await book.addTransaction({
    date: "2026-10-01",
    type: "expense",
    categoryId: food,
    amount: "1200",
    memo: "架空のランチ",
  });
  const second = await book.addTransaction({
    date: "2026-10-15",
    type: "expense",
    categoryId: food,
    amount: "3000",
    memo: "架空の定期代",
  });
  if (!first.ok || !second.ok) throw new Error("テストの前提の収支を作れませんでした");
}

function renderScreen(
  book: Book,
  overrides: {
    month?: string;
    setMonth?: Mock<(month: string) => void>;
    onNewerVersion?: Mock<() => void>;
  } = {},
) {
  const setMonth = overrides.setMonth ?? vi.fn<(month: string) => void>();
  const onNewerVersion = overrides.onNewerVersion ?? vi.fn<() => void>();
  const view = renderInShell(<TransactionsScreen />, book, {
    month: overrides.month ?? "2026-10",
    setMonth,
    onNewerVersion,
  });
  return { ...view, setMonth, onNewerVersion };
}

describe("収支タブ", () => {
  it("対象月の収支を一覧に表示し、件数を見出しの文字で示す（US2.3）", async () => {
    const book = await readyBook();
    await seed(book);
    renderScreen(book);
    expect(await screen.findByRole("table", { name: "2026年10月の収支 2件" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "収支一覧" })).toBeInTheDocument();
  });

  it("登録に成功すると「登録しました」を出し、一覧に追加する（US2.1、BR1.5）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    await seed(book);
    renderScreen(book);
    await screen.findByRole("table", { name: "2026年10月の収支 2件" });
    await user.type(screen.getByRole("textbox", { name: "金額（円・整数）" }), "800");
    await user.click(screen.getByRole("button", { name: "登録する" }));
    expect(await screen.findByText("✓ 登録しました")).toBeInTheDocument();
    expect(await screen.findByRole("table", { name: "2026年10月の収支 3件" })).toBeInTheDocument();
  });

  it("編集は同じフォームで行い、成功のあと押した「編集」へフォーカスを戻す（BR2.4）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    await seed(book);
    renderScreen(book);
    await user.click(await screen.findByRole("button", { name: "2026-10-01 食費 1,200円 を編集" }));
    expect(
      screen.getByRole("heading", { name: "収支の編集（2026-10-01 食費 1,200円）" }),
    ).toBeInTheDocument();
    const amount = screen.getByRole("textbox", { name: "金額（円・整数）" });
    await user.clear(amount);
    await user.type(amount, "1500");
    await user.click(screen.getByRole("button", { name: "変更を保存" }));
    expect(await screen.findByText("✓ 更新しました")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2026-10-01 食費 1,500円 を編集" })).toHaveFocus();
  });

  it("日付を別の月に変えて保存すると、移動先を知らせ、共有の対象月は変えない（BR2.4）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    await seed(book);
    const { setMonth } = renderScreen(book);
    await user.click(await screen.findByRole("button", { name: "2026-10-01 食費 1,200円 を編集" }));
    const date = screen.getByRole("textbox", { name: "日付" });
    await user.clear(date);
    await user.type(date, "2026-11-01");
    await user.click(screen.getByRole("button", { name: "変更を保存" }));
    expect(await screen.findByText("2026年11月に移動しました")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "収支一覧" })).toHaveFocus();
    expect(setMonth).not.toHaveBeenCalled();
    expect(await screen.findByRole("table", { name: "2026年10月の収支 1件" })).toBeInTheDocument();
  });

  it("削除は D1 で確認し、フォーカスはキャンセルに置き、Esc で何も変えずに戻す（BR2.5、BR9.2）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    await seed(book);
    renderScreen(book);
    const deleteButton = await screen.findByRole("button", {
      name: "2026-10-15 食費 3,000円 を削除",
    });
    await user.click(deleteButton);
    const dialog = await screen.findByRole("alertdialog", { name: "この収支を削除しますか？" });
    expect(within(dialog).getByText("削除すると元に戻せません。")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "キャンセル" })).toHaveFocus();
    // jsdom は Esc を標準の dialog の cancel に変換しないため、ブラウザが送る cancel を直接送る。
    const nativeDialog = document.querySelector("dialog");
    if (nativeDialog === null) throw new Error("テストの前提のダイアログがありません");
    fireEvent(nativeDialog, new Event("cancel", { cancelable: true }));
    await waitFor(() => expect(nativeDialog).not.toHaveAttribute("open"));
    expect(deleteButton).toHaveFocus();
    expect(await screen.findByRole("table", { name: "2026年10月の収支 2件" })).toBeInTheDocument();
  });

  it("削除を確定すると行を消し、知らせを出し、次の行の「削除」へフォーカスを移す（BR2.5）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    await seed(book);
    renderScreen(book);
    await user.click(await screen.findByRole("button", { name: "2026-10-15 食費 3,000円 を削除" }));
    await user.click(await screen.findByRole("button", { name: "削除する" }));
    expect(await screen.findByText("✓ 削除しました")).toBeInTheDocument();
    expect(await screen.findByRole("table", { name: "2026年10月の収支 1件" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2026-10-01 食費 1,200円 を削除" })).toHaveFocus();
  });

  it("キーボードだけで削除の確認を開ける（Enter）（US9.1）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    await seed(book);
    renderScreen(book);
    const deleteButton = await screen.findByRole("button", {
      name: "2026-10-01 食費 1,200円 を削除",
    });
    deleteButton.focus();
    await user.keyboard("{Enter}");
    expect(
      await screen.findByRole("alertdialog", { name: "この収支を削除しますか？" }),
    ).toBeInTheDocument();
  });

  it("収支がない月は案内を出し、登録欄へ移動できる（BR2.3）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    await seed(book);
    renderScreen(book, { month: "2026-12" });
    expect(await screen.findByText("この月の収支はまだありません。")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "登録欄へ移動" }));
    expect(screen.getByRole("textbox", { name: "日付" })).toHaveFocus();
  });

  it("読み込み中は読み込み中を示し、「まだありません」は出さない（BR8.1）", async () => {
    const book = await readyBook();
    vi.spyOn(book, "listTransactions").mockReturnValue(new Promise(() => undefined));
    renderScreen(book);
    // 分類の読み込みが済むと表示の要素は差し替わるため、そのつど探し直す。
    await waitFor(() => expect(screen.getByText("収支を読み込み中…")).toBeInTheDocument());
    expect(screen.queryByText("この月の収支はまだありません。")).toBeNull();
  });

  it("読み込みに失敗したら再試行を出し、「まだありません」は出さない。再試行で読み直す（BR8.2）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    const listSpy = vi
      .spyOn(book, "listTransactions")
      .mockResolvedValueOnce({ ok: false, error: { kind: "storage", message: "読めません" } });
    renderScreen(book);
    expect(await screen.findByText("データを読み込めませんでした")).toBeInTheDocument();
    expect(screen.queryByText("この月の収支はまだありません。")).toBeNull();
    await user.click(screen.getByRole("button", { name: "再試行" }));
    await waitFor(() => expect(listSpy.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it("一覧の読み込み中は登録フォームの入力と送信を無効にする（BR8.1）", async () => {
    const book = await readyBook();
    vi.spyOn(book, "listTransactions").mockReturnValue(new Promise(() => undefined));
    renderScreen(book);
    // 分類の読み込みが済んでフォームが出るまで待つ（一覧は読み込み中のまま）。
    const submit = await screen.findByRole("button", { name: "登録する" });
    expect(screen.getByText("収支を読み込み中…")).toBeInTheDocument();
    expect(submit).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "日付" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "金額（円・整数）" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "メモ（200文字まで）" })).toBeDisabled();
  });

  it("一覧の読み込みに失敗したらフォームを無効にし、「まだありません」は出さない（BR8.2）", async () => {
    const book = await readyBook();
    // failReads は分類の読み込みも失敗させるため、一覧の読み取りだけを失敗させる。
    vi.spyOn(book, "listTransactions").mockResolvedValue({
      ok: false,
      error: { kind: "storage", message: "読めません" },
    });
    renderScreen(book);
    expect(await screen.findByText("データを読み込めませんでした")).toBeInTheDocument();
    expect(screen.queryByText(/まだありません/)).toBeNull();
    expect(screen.getByRole("button", { name: "登録する" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "日付" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "金額（円・整数）" })).toBeDisabled();
  });

  it("一覧の読み込みが済んでいればフォームは有効のまま（BR8.1）", async () => {
    const book = await readyBook();
    await seed(book);
    renderScreen(book);
    await screen.findByRole("table", { name: "2026年10月の収支 2件" });
    expect(screen.getByRole("button", { name: "登録する" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "日付" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "金額（円・整数）" })).toBeEnabled();
  });

  it("保存に失敗したら入力を残し、一覧には追加しない（BR8.3）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    await seed(book);
    vi.spyOn(book, "addTransaction").mockResolvedValue({
      ok: false,
      error: { kind: "storage", message: "保存できませんでした" },
    });
    renderScreen(book);
    await screen.findByRole("table", { name: "2026年10月の収支 2件" });
    await user.type(screen.getByRole("textbox", { name: "金額（円・整数）" }), "900");
    await user.click(screen.getByRole("button", { name: "登録する" }));
    expect(
      await screen.findByText("保存できませんでした。入力内容はそのまま残っています。"),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "金額（円・整数）" })).toHaveValue("900");
    expect(screen.getByRole("table", { name: "2026年10月の収支 2件" })).toBeInTheDocument();
  });

  it("操作の途中で新しい版のデータが返ったら、切り替えを呼ぶ（BR1.6）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    await seed(book);
    vi.spyOn(book, "deleteTransaction").mockResolvedValue({
      ok: false,
      error: { kind: "newer-version" },
    });
    const { onNewerVersion } = renderScreen(book);
    await user.click(await screen.findByRole("button", { name: "2026-10-15 食費 3,000円 を削除" }));
    await user.click(await screen.findByRole("button", { name: "削除する" }));
    await waitFor(() => expect(onNewerVersion).toHaveBeenCalledTimes(1));
  });

  it("自動のアクセシビリティ検査で違反がない（NFR2.2）", async () => {
    const book = await readyBook();
    await seed(book);
    const { container } = renderScreen(book);
    await screen.findByRole("table", { name: "2026年10月の収支 2件" });
    await expectNoAxeViolations(container);
  });
});
