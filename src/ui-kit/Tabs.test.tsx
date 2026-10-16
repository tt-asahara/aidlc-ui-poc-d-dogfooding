// Tabs のテスト（BR8.1〜BR8.3、W2、NFR2.1〜NFR2.3）。実装の後に書くテスト（Testing Contract の ordering）。
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";
import { Tabs, type TabItem } from "./Tabs";
import { expectNoAxeViolations } from "./test-fixtures";

const TABS: TabItem[] = [
  { id: "transactions", label: "収支" },
  { id: "summary", label: "月次集計" },
  { id: "budgets", label: "予算" },
  { id: "categories", label: "カテゴリ" },
  { id: "csv", label: "CSV" },
];

function TabsHarness({ onSelect }: { onSelect?: (id: string) => void }) {
  const [selectedId, setSelectedId] = useState("transactions");
  return (
    <Tabs
      label="画面の切り替え"
      tabs={TABS}
      selectedId={selectedId}
      onSelect={(id) => {
        onSelect?.(id);
        setSelectedId(id);
      }}
      renderPanel={(id) => <Button>{`${id} の架空の操作`}</Button>}
    />
  );
}

describe("Tabs", () => {
  it("tablist・tab・tabpanel の役割を持ち、選択中のタブだけが aria-selected と tabindex=0 を持つ（BR8.1）", () => {
    render(<TabsHarness />);
    expect(screen.getByRole("tablist", { name: "画面の切り替え" })).toBeInTheDocument();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.getAttribute("tabindex"))).toEqual(["0", "-1", "-1", "-1", "-1"]);
    expect(screen.getByRole("tab", { name: "収支" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "予算" })).toHaveAttribute("aria-selected", "false");

    // tabpanel は選択中のタブで名前が付き、タブの aria-controls と結ばれる。
    const panel = screen.getByRole("tabpanel", { name: "収支" });
    expect(screen.getByRole("tab", { name: "収支" })).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveTextContent("transactions の架空の操作");
  });

  it("右・左の矢印で移ると同時に選択し、端では反対の端へ回り込む（BR8.2）", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TabsHarness onSelect={onSelect} />);
    await user.tab();
    expect(screen.getByRole("tab", { name: "収支" })).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "月次集計" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "月次集計" })).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "CSV" })).toHaveFocus();
    expect(screen.getByRole("tabpanel", { name: "CSV" })).toHaveTextContent("csv の架空の操作");

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "収支" })).toHaveFocus();
    expect(onSelect.mock.calls.map(([id]) => id as string)).toEqual([
      "summary",
      "transactions",
      "csv",
      "transactions",
    ]);
  });

  it("Home で先頭、End で末尾へ移り、ほかのキーでは選択が変わらない（BR8.2）", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TabsHarness onSelect={onSelect} />);
    await user.tab();

    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "CSV" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "収支" })).toHaveFocus();
    await user.keyboard("{ArrowDown}a");
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("tab", { name: "収支" })).toHaveAttribute("aria-selected", "true");
  });

  it("クリックで選択でき、Tab ではタブ列から内容の最初の操作要素へ移る（W2）", async () => {
    const user = userEvent.setup();
    render(<TabsHarness />);
    await user.click(screen.getByRole("tab", { name: "予算" }));
    expect(screen.getByRole("tab", { name: "予算" })).toHaveAttribute("aria-selected", "true");

    await user.tab();
    expect(screen.getByRole("button", { name: "budgets の架空の操作" })).toHaveFocus();
  });

  it("selectedId が一覧にないときも、先頭のタブに Tab で入れる", async () => {
    const user = userEvent.setup();
    render(
      <Tabs
        label="画面の切り替え"
        tabs={TABS}
        selectedId="unknown"
        onSelect={vi.fn()}
        renderPanel={() => "架空の内容"}
      />,
    );
    await user.tab();
    expect(screen.getByRole("tab", { name: "収支" })).toHaveFocus();
  });

  it("選択中のタブは色以外の印（選択の属性による下線・太字の対象）を持ち、axe の違反が0件（BR8.3、NFR2.1）", async () => {
    const { container } = render(<TabsHarness />);
    // ui-kit.css は .uk-tab[aria-selected="true"] に下線と太字を付ける。
    expect(container.querySelectorAll('.uk-tab[aria-selected="true"]')).toHaveLength(1);
    await expectNoAxeViolations(container);
  });
});
