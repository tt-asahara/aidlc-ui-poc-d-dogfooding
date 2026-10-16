// 予算タブ（US4.1〜US4.3、US9.3、BR4.1〜BR4.3、BR8.1〜BR8.3）。出所の表示、保存、入力エラー、空欄の案内、設定を外す、保存失敗、読み込みの状態を確かめる。
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Book } from "../../bookkeeping-core";
import { expectNoAxeViolations } from "../../ui-kit/test-fixtures";
import { categoryIdNamed, loadCategories, readyBook, renderInShell } from "../test-fixtures";
import { BudgetScreen } from "./BudgetScreen";

/** 食費は 2026-10 に設定、日用品は 2026-08 の設定を引き継ぐ、交通費は予算なし。 */
async function seedBudgets(book: Book, options: { foodAug?: boolean } = {}): Promise<void> {
  const categories = await loadCategories(book);
  const id = (name: string) => categoryIdNamed(categories, name);
  const steps = [
    await book.setBudget(id("日用品"), "2026-08", "5000"),
    await book.setBudget(id("食費"), "2026-10", "25000"),
  ];
  if (options.foodAug === true) steps.push(await book.setBudget(id("食費"), "2026-08", "1000"));
  for (const step of steps) {
    if (!step.ok) throw new Error("テストの前提の予算を作れませんでした");
  }
}

function renderBudget(book: Book, month = "2026-10") {
  const setMonth = vi.fn<(value: string) => void>();
  const view = renderInShell(<BudgetScreen />, book, { month, setMonth });
  return { ...view, setMonth };
}

/** 対象の行（カテゴリ名のセル）と、その中の入力欄を返す。 */
async function inputFor(name: string): Promise<HTMLInputElement> {
  const input = await screen.findByRole("textbox", { name: `${name}の2026年10月の予算（円）` });
  return input as HTMLInputElement;
}

function rowOf(input: HTMLElement): HTMLElement {
  const row = input.closest("tr");
  if (row === null) throw new Error("行が見つかりません");
  return row;
}

describe("予算タブ", () => {
  it("支出カテゴリの全件を、設定済み・引き継ぎ（2026年8月）・予算なしの出所つきで表示する（BR4.1）", async () => {
    const book = await readyBook();
    await seedBudgets(book);
    renderBudget(book);
    const food = await inputFor("食費");
    expect(food).toHaveValue("25000");
    expect(within(rowOf(food)).getByText("設定済み")).toBeInTheDocument();
    const carried = await inputFor("日用品");
    expect(carried).toHaveValue("5000");
    expect(within(rowOf(carried)).getByText("引き継ぎ(2026年8月)")).toBeInTheDocument();
    const none = await inputFor("交通費");
    expect(none).toHaveValue("");
    expect(within(rowOf(none)).getByText("予算なし")).toBeInTheDocument();
  });

  it("「設定を外す」は設定済みの行だけに出す（BR4.3）", async () => {
    const book = await readyBook();
    await seedBudgets(book);
    renderBudget(book);
    await inputFor("食費");
    expect(screen.getByRole("button", { name: "食費の設定を外す" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "日用品の設定を外す" })).toBeNull();
    expect(screen.queryByRole("button", { name: "交通費の設定を外す" })).toBeNull();
  });

  it("保存に成功すると「✓ 食費の予算を保存しました」を出し、U4 の値を変える（BR4.2）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    await seedBudgets(book);
    renderBudget(book);
    const food = await inputFor("食費");
    await user.clear(food);
    await user.type(food, "30000");
    await user.click(screen.getByRole("button", { name: "食費の予算を保存" }));
    expect(await screen.findByText("✓ 食費の予算を保存しました")).toBeInTheDocument();
    const after = await book.getEffectiveBudgets("2026-10");
    expect(after.ok && after.value.find((row) => row.amount === 30000)).toBeTruthy();
  });

  it("引き継ぎの値を変えて保存すると、その月の設定済みになる（BR4.1）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    await seedBudgets(book);
    renderBudget(book);
    const carried = await inputFor("日用品");
    await user.clear(carried);
    await user.type(carried, "6000");
    await user.click(screen.getByRole("button", { name: "日用品の予算を保存" }));
    expect(await screen.findByText("✓ 日用品の予算を保存しました")).toBeInTheDocument();
    await waitFor(() => expect(within(rowOf(carried)).getByText("設定済み")).toBeInTheDocument());
  });

  it.each([
    ["-1", "負の数"],
    ["12.5", "小数"],
    ["abc", "数字以外"],
  ])("入力エラー（%s、%s）は行の下に出し、入力欄へフォーカスを残す（US9.3）", async (value) => {
    const user = userEvent.setup();
    const book = await readyBook();
    await seedBudgets(book);
    const onSaveSpy = vi.spyOn(book, "setBudget");
    renderBudget(book);
    const food = await inputFor("食費");
    await user.clear(food);
    await user.type(food, value);
    await user.click(screen.getByRole("button", { name: "食費の予算を保存" }));
    expect(await within(rowOf(food)).findByText(/^予算額：/)).toBeInTheDocument();
    expect(food).toHaveAttribute("aria-invalid", "true");
    expect(food).toHaveFocus();
    expect(food).toHaveValue(value);
    expect(onSaveSpy).toHaveBeenCalledTimes(1);
  });

  it("空欄での保存は受け付けず、設定の解除を案内する（BR4.2）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    await seedBudgets(book);
    const setSpy = vi.spyOn(book, "setBudget");
    renderBudget(book);
    const food = await inputFor("食費");
    await user.clear(food);
    await user.click(screen.getByRole("button", { name: "食費の予算を保存" }));
    expect(
      await screen.findByText("設定を外すには［設定を外す］を使ってください"),
    ).toBeInTheDocument();
    expect(setSpy).not.toHaveBeenCalled();
    expect(food).toHaveFocus();
  });

  it("0円の保存は「設定済み 0円」になる（AC4.3.2）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    await seedBudgets(book);
    renderBudget(book);
    const none = await inputFor("交通費");
    await user.type(none, "0");
    await user.click(screen.getByRole("button", { name: "交通費の予算を保存" }));
    expect(await screen.findByText("✓ 交通費の予算を保存しました")).toBeInTheDocument();
    await waitFor(() => expect(within(rowOf(none)).getByText("設定済み")).toBeInTheDocument());
    expect(none).toHaveValue("0");
  });

  it("Enter で、その行の予算を保存する（キーボードだけで操作できる。US9.1）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    await seedBudgets(book);
    renderBudget(book);
    const none = await inputFor("交通費");
    await user.type(none, "9000{Enter}");
    expect(await screen.findByText("✓ 交通費の予算を保存しました")).toBeInTheDocument();
  });

  it("設定を外すと、引き継ぎ先があれば「引き継ぎます」、なければ「予算なしに戻ります」と示す（BR4.3）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    await seedBudgets(book, { foodAug: true });
    renderBudget(book);
    await inputFor("食費");
    await user.click(screen.getByRole("button", { name: "食費の設定を外す" }));
    expect(
      await screen.findByText("✓ 食費の設定を外しました（2026年8月の予算を引き継ぎます）"),
    ).toBeInTheDocument();
    const food = await inputFor("食費");
    expect(within(rowOf(food)).getByText("引き継ぎ(2026年8月)")).toBeInTheDocument();
  });

  it("引き継ぎ先がないときは「予算なしに戻ります」と示す", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    const categories = await loadCategories(book);
    await book.setBudget(categoryIdNamed(categories, "娯楽"), "2026-10", "3000");
    renderBudget(book);
    await user.click(await screen.findByRole("button", { name: "娯楽の設定を外す" }));
    expect(
      await screen.findByText("✓ 娯楽の設定を外しました（予算なしに戻ります）"),
    ).toBeInTheDocument();
  });

  it("設定が既にないときの設定を外すは「この月には設定がありません」と示す（BR4.3）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    await seedBudgets(book);
    vi.spyOn(book, "clearBudget").mockResolvedValue({
      ok: false,
      error: { kind: "rule", violation: { code: "budget-not-set" } },
    });
    renderBudget(book);
    await user.click(await screen.findByRole("button", { name: "食費の設定を外す" }));
    expect(await screen.findByText("この月には設定がありません")).toBeInTheDocument();
  });

  it("保存に失敗したら行の下に理由を出し、入力は残す（BR8.3）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    await seedBudgets(book);
    vi.spyOn(book, "setBudget").mockResolvedValue({
      ok: false,
      error: { kind: "storage", message: "保存できませんでした" },
    });
    renderBudget(book);
    const food = await inputFor("食費");
    await user.clear(food);
    await user.type(food, "7000");
    await user.click(screen.getByRole("button", { name: "食費の予算を保存" }));
    expect(
      await screen.findByText("保存できませんでした。入力内容はそのまま残っています。"),
    ).toBeInTheDocument();
    expect(food).toHaveValue("7000");
  });

  it("読み込み中は読み込み中を示し、保存の操作は出さない（BR8.1）", async () => {
    const book = await readyBook();
    await seedBudgets(book);
    vi.spyOn(book, "getEffectiveBudgets").mockReturnValue(new Promise(() => undefined));
    renderBudget(book);
    await waitFor(() => expect(screen.getByText("予算を読み込み中…")).toBeInTheDocument());
    expect(screen.queryByRole("textbox", { name: "食費の2026年10月の予算（円）" })).toBeNull();
  });

  it("読み込みに失敗したら再試行を出し、押すと読み直す（BR8.2）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    await seedBudgets(book);
    const spy = vi
      .spyOn(book, "getEffectiveBudgets")
      .mockResolvedValueOnce({ ok: false, error: { kind: "storage", message: "読めません" } });
    renderBudget(book);
    expect(await screen.findByText("データを読み込めませんでした")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "再試行" }));
    await waitFor(() => expect(spy.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(await inputFor("食費")).toHaveValue("25000");
  });

  it("自動のアクセシビリティ検査で違反がない（NFR2.2）", async () => {
    const book = await readyBook();
    await seedBudgets(book);
    const { container } = renderBudget(book);
    await inputFor("食費");
    await expectNoAxeViolations(container);
  });
});
