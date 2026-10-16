// CSV の書き出し（US6.1〜US6.3、NFR8.2、NFR9.1）。成功と件数、0件の見出し行、Blob の一時的な URL の作成と解放、失敗の表示を確かめる。
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Book } from "../../bookkeeping-core";
import { expectNoAxeViolations } from "../../ui-kit/test-fixtures";
import { categoryIdNamed, loadCategories, readyBook, renderInShell } from "../test-fixtures";
import { CsvExportPanel, monthChoices } from "./CsvExportPanel";

const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:budget/test-1");
const revokeObjectURL = vi.fn<(url: string) => void>();

beforeEach(() => {
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
});

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(URL, "createObjectURL");
  Reflect.deleteProperty(URL, "revokeObjectURL");
});

function renderPanel(book: Book, onNewerVersion = vi.fn<() => void>()) {
  return renderInShell(<CsvExportPanel />, book, { month: "2026-10", onNewerVersion });
}

async function seedOneTransaction(book: Book): Promise<void> {
  const categories = await loadCategories(book);
  const result = await book.addTransaction({
    date: "2026-10-01",
    type: "expense",
    categoryId: categoryIdNamed(categories, "食費"),
    amount: "1200",
    memo: "架空のランチ",
  });
  if (!result.ok) throw new Error("テストの前提の収支を作れませんでした");
}

describe("CSV の書き出し", () => {
  it("全期間を書き出すと、ファイル名と件数を知らせ、Blob を一時的な URL で保存させる（US6.1）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    await seedOneTransaction(book);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    renderPanel(book);
    await user.click(screen.getByRole("button", { name: "CSV を書き出す" }));
    expect(
      await screen.findByText(/^✓ budget-transactions-\d{8}\.csv を書き出しました（1件）$/),
    ).toBeInTheDocument();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("解放は保存の開始の後、1000ms 後に行う（BR6.1、NFR9.1）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    renderPanel(book);
    await user.click(screen.getByRole("button", { name: "CSV を書き出す" }));
    await screen.findByText(/を書き出しました（0件）$/);
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:budget/test-1"), {
      timeout: 2000,
    });
  });

  it("画面を離れたときは、残っている一時的な URL をすぐに解放する（NFR9.1）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const view = renderPanel(book);
    await user.click(screen.getByRole("button", { name: "CSV を書き出す" }));
    await screen.findByText(/を書き出しました（0件）$/);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    view.unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:budget/test-1");
  });

  it("0件のときは見出し行だけを書き出し、その旨を表示する（BR6.3）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    renderPanel(book);
    await user.click(screen.getByRole("button", { name: "CSV を書き出す" }));
    expect(
      await screen.findByText("書き出す収支がないため見出し行のみ出力しました"),
    ).toBeInTheDocument();
    expect(screen.getByText(/を書き出しました（0件）$/)).toBeInTheDocument();
  });

  it("月を指定すると、その月のファイル名になる（US6.1）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    renderPanel(book);
    await user.click(screen.getByRole("radio", { name: "月を指定" }));
    await user.click(screen.getByRole("button", { name: "CSV を書き出す" }));
    expect(
      await screen.findByText("✓ budget-transactions-2026-10.csv を書き出しました（0件）"),
    ).toBeInTheDocument();
  });

  it("保存の読み取りに失敗したら、その理由を出し、ファイルは作らない（BR8.2）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    vi.spyOn(book, "listAllTransactions").mockResolvedValue({
      ok: false,
      error: { kind: "storage", message: "書き出せませんでした" },
    });
    renderPanel(book);
    await user.click(screen.getByRole("button", { name: "CSV を書き出す" }));
    expect(await screen.findByText("書き出せませんでした")).toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("新しい版のデータが返ったら、切り替えを呼ぶ（BR1.6）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    vi.spyOn(book, "listAllTransactions").mockResolvedValue({
      ok: false,
      error: { kind: "newer-version" },
    });
    const onNewerVersion = vi.fn<() => void>();
    renderPanel(book, onNewerVersion);
    await user.click(screen.getByRole("button", { name: "CSV を書き出す" }));
    await waitFor(() => expect(onNewerVersion).toHaveBeenCalledTimes(1));
  });

  it("月の候補は対象の月の前後を、範囲の内で重複なく並べる", () => {
    const choices = monthChoices("2026-10");
    expect(choices[0]).toBe("2025-10");
    expect(choices).toContain("2026-10");
    expect(choices[choices.length - 1]).toBe("2027-10");
    expect(new Set(monthChoices("2000-01")).size).toBe(monthChoices("2000-01").length);
  });

  it("自動のアクセシビリティ検査で違反がない（NFR2.2）", async () => {
    const book = await readyBook();
    const { container } = renderPanel(book);
    await expectNoAxeViolations(container);
  });
});
