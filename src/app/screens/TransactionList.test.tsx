// 収支一覧（US2.3、US2.4、US2.5、US8.1、US8.2、NFR8.1）。並びは U4 のまま。0件の案内、読み込み中、表示の安全を確かめる。
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Category, Transaction } from "../../data-contract";
import { expectNoAxeViolations } from "../../ui-kit/test-fixtures";
import {
  TransactionList,
  deleteButtonKey,
  editButtonKey,
  type TransactionListProps,
} from "./TransactionList";

// 架空の収支（実在の名前・口座は使わない）。
const categories: Category[] = [
  {
    id: "c-food",
    type: "expense",
    name: "食費",
    sortOrder: 0,
    createdAt: "2026-10-01T00:00:00.000Z",
  },
  {
    id: "c-salary",
    type: "income",
    name: "給与",
    sortOrder: 0,
    createdAt: "2026-10-01T00:00:00.000Z",
  },
];

function transaction(overrides: Partial<Transaction> & Pick<Transaction, "id">): Transaction {
  return {
    date: "2026-10-01",
    type: "expense",
    categoryId: "c-food",
    amount: 1200,
    memo: "架空のランチ",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

function renderList(overrides: Partial<TransactionListProps> = {}) {
  const props: TransactionListProps = {
    month: "2026-10",
    transactions: [],
    categories,
    editingId: null,
    busy: false,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onGoToForm: vi.fn(),
    registerButton: vi.fn(),
    ...overrides,
  };
  return { ...render(<TransactionList {...props} />), props };
}

const rows = [
  transaction({
    id: "t-3",
    date: "2026-10-15",
    type: "expense",
    categoryId: "c-food",
    amount: 3000,
    memo: "架空の定期代",
  }),
  transaction({
    id: "t-2",
    date: "2026-10-01",
    type: "income",
    categoryId: "c-salary",
    amount: 250000,
    memo: "",
  }),
  transaction({
    id: "t-1",
    date: "2026-10-01",
    type: "expense",
    categoryId: "c-food",
    amount: 1200,
    memo: "架空のランチ",
  }),
];

describe("収支一覧", () => {
  it("U4 の並びのまま表示し、件数を見出しの文字で示す（BR2.3）", () => {
    renderList({ transactions: rows });
    expect(screen.getByRole("table", { name: "2026年10月の収支 3件" })).toBeInTheDocument();
    const bodyRows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(bodyRows.map((row) => within(row).getAllByRole("cell")[0]?.textContent)).toEqual([
      "2026-10-15",
      "2026-10-01",
      "2026-10-01",
    ]);
  });

  it("金額は 3 桁区切りで右寄せにし、種別は文字で示す（NFR5.1、BR2.3）", () => {
    renderList({ transactions: rows });
    expect(screen.getByText("250,000")).toHaveClass("app-amount");
    expect(screen.getByText("3,000")).toBeInTheDocument();
    expect(screen.getAllByText("収入")).toHaveLength(1);
  });

  it("0件のときは案内と登録欄への導線を出し、導線を押すと onGoToForm を呼ぶ（BR2.3）", async () => {
    const user = userEvent.setup();
    const { props } = renderList({ transactions: [] });
    expect(screen.getByText("この月の収支はまだありません。")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "登録欄へ移動" }));
    expect(props.onGoToForm).toHaveBeenCalledTimes(1);
  });

  it("読み直しの間に0件のときは「まだありません」を出さず読み込み中を示す（BR8.1）", () => {
    renderList({ transactions: [], busy: true });
    expect(screen.getByText("収支を読み込み中…")).toBeInTheDocument();
    expect(screen.queryByText("この月の収支はまだありません。")).toBeNull();
  });

  it("編集と削除のボタンは対象の内容を名前に含め、押すと対象の収支を渡す（US2.4、US2.5）", async () => {
    const user = userEvent.setup();
    const { props } = renderList({ transactions: rows });
    await user.click(screen.getByRole("button", { name: "2026-10-01 食費 1,200円 を編集" }));
    expect(props.onEdit).toHaveBeenLastCalledWith(rows[2]);
    await user.click(screen.getByRole("button", { name: "2026-10-15 食費 3,000円 を削除" }));
    expect(props.onDelete).toHaveBeenLastCalledWith(rows[0]);
  });

  it("編集中の行には「編集中」と示し、操作ボタンを親へ登録する（BR2.4）", () => {
    const registerButton = vi.fn();
    renderList({ transactions: rows, editingId: "t-1", registerButton });
    expect(screen.getByText("編集中")).toBeInTheDocument();
    expect(registerButton).toHaveBeenCalledWith(
      editButtonKey("t-1"),
      expect.any(HTMLButtonElement),
    );
    expect(registerButton).toHaveBeenCalledWith(
      deleteButtonKey("t-3"),
      expect.any(HTMLButtonElement),
    );
  });

  it("メモに HTML の文字を入れても、文字として表示し、要素を作らない（NFR8.1、AC2.3.3）", () => {
    const hostile = transaction({ id: "t-x", memo: "<script>alert(1)</script>" });
    const { container } = renderList({ transactions: [hostile] });
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
  });

  it("自動のアクセシビリティ検査で違反がない（NFR2.2）", async () => {
    const { container } = renderList({ transactions: rows });
    await expectNoAxeViolations(container);
  });
});
