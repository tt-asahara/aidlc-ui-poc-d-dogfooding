// 月次集計（US5.1〜US5.4、BR5.1〜BR5.4、BR8.1、BR8.2）。例の表、収支がない月、読み込み中と失敗での「—」、月の移動、3桁区切りと赤字を確かめる。
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Book } from "../../bookkeeping-core";
import type { Transaction } from "../../data-contract";
import { expectNoAxeViolations } from "../../ui-kit/test-fixtures";
import { categoryIdNamed, loadCategories, readyBook, renderInShell } from "../test-fixtures";
import type { ScreenId } from "../types";
import { SummaryScreen } from "./SummaryScreen";

/** 2章の例と同じ架空の数字を作る（食費の超過、交通費の予算なし、引き継ぎ、収入の行）。 */
async function seedExample(book: Book): Promise<void> {
  const categories = await loadCategories(book);
  const id = (name: string) => categoryIdNamed(categories, name);
  const steps = [
    await book.setBudget(id("日用品"), "2026-08", "5000"),
    await book.setBudget(id("食費"), "2026-10", "1000"),
    await book.addTransaction({
      date: "2026-10-01",
      type: "income",
      categoryId: id("給与"),
      amount: "250000",
      memo: "架空の給与",
    }),
    await book.addTransaction({
      date: "2026-10-05",
      type: "income",
      categoryId: id("副収入"),
      amount: "20000",
      memo: "",
    }),
    await book.addTransaction({
      date: "2026-10-01",
      type: "expense",
      categoryId: id("食費"),
      amount: "1200",
      memo: "架空のランチ",
    }),
    await book.addTransaction({
      date: "2026-10-15",
      type: "expense",
      categoryId: id("交通費"),
      amount: "3000",
      memo: "架空の定期代",
    }),
  ];
  for (const step of steps) {
    if (!step.ok) throw new Error("テストの前提の数字を作れませんでした");
  }
}

function renderSummary(book: Book, month = "2026-10") {
  const setMonth = vi.fn<(value: string) => void>();
  const navigate = vi.fn<(screen: ScreenId) => void>();
  const view = renderInShell(<SummaryScreen />, book, { month, setMonth, navigate });
  return { ...view, setMonth, navigate };
}

/** 支出の表の行（カテゴリ名のセルを含む行）の文字を、列の順に返す。 */
function expenseRowTexts(name: string): string[] {
  const table = screen.getByRole("table", { name: "支出のカテゴリ別（2026年10月）" });
  const cell = within(table).getByRole("cell", { name });
  const row = cell.closest("tr");
  if (row === null) throw new Error("行が見つかりません");
  return within(row)
    .getAllByRole("cell")
    .map((item) => item.textContent ?? "");
}

describe("月次集計", () => {
  it("2章の例の数字を、3桁区切り・予算・引き継ぎ・超過・赤字の表示で出す（BR5.1、BR5.2）", async () => {
    const book = await readyBook();
    await seedExample(book);
    renderSummary(book);
    expect(await screen.findByText("270,000円")).toBeInTheDocument();
    expect(screen.getByText("4,200円")).toBeInTheDocument();
    expect(screen.getByText("265,800円（黒字）")).toBeInTheDocument();
    expect(expenseRowTexts("食費")).toEqual(["食費", "1,000", "1,200", "−200", "▲ 超過"]);
    expect(expenseRowTexts("交通費")).toEqual(["交通費", "—（予算なし）", "3,000", "—", "—"]);
    expect(expenseRowTexts("日用品")).toEqual([
      "日用品",
      "5,000 (引き継ぎ)",
      "0",
      "5,000",
      "範囲内",
    ]);
    expect(expenseRowTexts("合計")).toEqual(["合計", "", "4,200", "", ""]);
  });

  it("収入の表は実績だけを持ち、予算の列を持たない（BR5.3）", async () => {
    const book = await readyBook();
    await seedExample(book);
    renderSummary(book);
    const table = await screen.findByRole("table", { name: "収入のカテゴリ別（2026年10月）" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["カテゴリ", "実績(円)"]);
    expect(within(table).getByRole("cell", { name: "250,000" })).toBeInTheDocument();
  });

  it("赤字の差額は「−」と「（赤字）」で示す（NFR5.1、BR5.1）", async () => {
    const book = await readyBook();
    const categories = await loadCategories(book);
    await book.addTransaction({
      date: "2026-10-01",
      type: "expense",
      categoryId: categoryIdNamed(categories, "食費"),
      amount: "1200",
      memo: "架空のランチ",
    });
    renderSummary(book);
    expect(await screen.findByText("−1,200円（赤字）")).toBeInTheDocument();
  });

  it("収支がない月は合計を 0 円と示し、案内と収支タブへの導線を出す（BR5.4）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    const { navigate } = renderSummary(book, "2026-12");
    expect(await screen.findByText("この月の収支はまだありません。")).toBeInTheDocument();
    expect(screen.getAllByText("0円")).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "収支タブで登録する" }));
    expect(navigate).toHaveBeenCalledWith("transactions");
  });

  it("読み込み中は合計を「—」にし、0円とは表示せず、案内も出さない（BR5.1、BR5.4）", async () => {
    const book = await readyBook();
    vi.spyOn(book, "listCategories").mockReturnValue(new Promise(() => undefined));
    renderSummary(book);
    expect(await screen.findByText("集計を読み込み中…")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(3);
    expect(screen.queryByText("0円")).toBeNull();
    expect(screen.queryByText("この月の収支はまだありません。")).toBeNull();
  });

  it("読み込みに失敗したら合計を「—」にして再試行を出し、「まだありません」は出さない（BR8.2）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    const transactionsSpy = vi
      .spyOn(book, "listTransactions")
      .mockResolvedValueOnce({ ok: false, error: { kind: "storage", message: "読めません" } });
    renderSummary(book);
    expect(await screen.findByText("データを読み込めませんでした")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(3);
    expect(screen.queryByText("この月の収支はまだありません。")).toBeNull();
    await user.click(screen.getByRole("button", { name: "再試行" }));
    await waitFor(() => expect(transactionsSpy.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it("別の画面の食い違い（一覧にないカテゴリ）は、同じ文言と画面の更新の導線を出す（BR3.5）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    const stray: Transaction = {
      id: "t-stray",
      date: "2026-10-02",
      type: "expense",
      categoryId: "c-unknown",
      amount: 500,
      memo: "",
      createdAt: "2026-10-02T00:00:00.000Z",
      updatedAt: "2026-10-02T00:00:00.000Z",
    };
    const transactionsSpy = vi
      .spyOn(book, "listTransactions")
      .mockResolvedValueOnce({ ok: true, value: [stray] });
    renderSummary(book);
    expect(
      await screen.findByText("⚠ 選んだカテゴリが見つかりません。画面を更新してください"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "画面を更新" }));
    await waitFor(() => expect(transactionsSpy.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it("翌月のボタンで対象月を1か月ずらして通知する（BR1.4）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    const { setMonth } = renderSummary(book);
    await user.click(await screen.findByRole("button", { name: "翌月（2026年11月）" }));
    expect(setMonth).toHaveBeenCalledWith("2026-11");
  });

  it("自動のアクセシビリティ検査で違反がない（NFR2.2）", async () => {
    const book = await readyBook();
    await seedExample(book);
    const { container } = renderSummary(book);
    await screen.findByText("265,800円（黒字）");
    await expectNoAxeViolations(container);
  });
});
