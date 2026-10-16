// タブ（BR9.1、BR8.2）。矢印キー・Home・End で移動し、移動と同時に選択する。内容は選ばれたタブだけ。
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { expectNoAxeViolations } from "../ui-kit/test-fixtures";
import { TabNav, toScreenId } from "./TabNav";

function renderTabs(
  selected: "transactions" | "summary" | "budgets" | "categories" | "csv" = "transactions",
  onSelect = vi.fn(),
) {
  const view = render(
    <TabNav selected={selected} onSelect={onSelect} renderPanel={(id) => <p>{`${id}の中身`}</p>} />,
  );
  return { ...view, onSelect };
}

describe("TabNav", () => {
  it("5つのタブを順に表示し、選ばれたタブの中身だけを出す", () => {
    renderTabs("summary");
    const tablist = screen.getByRole("tablist", { name: "画面の切り替え" });
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "収支",
      "月次集計",
      "予算",
      "カテゴリ",
      "CSV",
    ]);
    expect(screen.getByRole("tab", { name: "月次集計" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("summaryの中身");
  });

  it("右の矢印で次のタブへ移動し、フォーカスと選択を同時に移す", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderTabs("transactions");
    screen.getByRole("tab", { name: "収支" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(onSelect).toHaveBeenLastCalledWith("summary");
    expect(screen.getByRole("tab", { name: "月次集計" })).toHaveFocus();
  });

  it("左の矢印は先頭で末尾へ回り込み、Home と End で先頭と末尾へ移る", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderTabs("transactions");
    screen.getByRole("tab", { name: "収支" }).focus();
    await user.keyboard("{ArrowLeft}");
    expect(onSelect).toHaveBeenLastCalledWith("csv");
    await user.keyboard("{End}");
    expect(onSelect).toHaveBeenLastCalledWith("csv");
    await user.keyboard("{Home}");
    expect(onSelect).toHaveBeenLastCalledWith("transactions");
  });

  it("選ばれていないタブは Tab の到達先にしない（tabindex -1）", () => {
    renderTabs("transactions");
    expect(screen.getByRole("tab", { name: "収支" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "CSV" })).toHaveAttribute("tabindex", "-1");
  });

  it("タブの識別子に使えない値は画面に変換しない", () => {
    expect(toScreenId("csv")).toBe("csv");
    expect(toScreenId("unknown")).toBeNull();
  });

  it("自動のアクセシビリティ検査で違反がない", async () => {
    const { container } = renderTabs("budgets");
    await expectNoAxeViolations(container);
  });
});
