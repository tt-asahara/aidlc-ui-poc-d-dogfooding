// DataTable のテスト（BR4.1・BR4.2、NFR2.1、NFR8.1）。実装の後に書くテスト（Testing Contract の ordering）。
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";
import { DataTable, type DataTableColumn } from "./DataTable";
import { expectNoAxeViolations } from "./test-fixtures";

interface FakeRow {
  id: string;
  date: string;
  category: string;
  amount: number;
}

const rows: FakeRow[] = [
  { id: "t1", date: "10/01", category: "架空の食費", amount: 1200 },
  { id: "t2", date: "10/03", category: "架空の交通費", amount: 480 },
];

const columns: DataTableColumn<FakeRow>[] = [
  { key: "date", header: "日付", render: (row) => row.date },
  { key: "category", header: "カテゴリ", render: (row) => row.category },
  {
    key: "amount",
    header: "金額(円)",
    align: "end",
    render: (row) => row.amount.toLocaleString("ja-JP"),
  },
];

describe("DataTable", () => {
  it("caption と列見出し（scope=col）を持ち、行ごとに列の値を表示する（BR4.1）", () => {
    render(
      <DataTable
        caption="2026年10月の収支 2件"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
      />,
    );
    const table = screen.getByRole("table", { name: "2026年10月の収支 2件" });
    const headers = within(table).getAllByRole("columnheader");
    expect(headers.map((header) => header.textContent)).toEqual(["日付", "カテゴリ", "金額(円)"]);
    for (const header of headers) expect(header).toHaveAttribute("scope", "col");

    const bodyRows = within(table).getAllByRole("row").slice(1);
    expect(bodyRows).toHaveLength(2);
    expect(within(bodyRows[0]!).getByRole("cell", { name: "1,200" })).toBeInTheDocument();
    expect(table).not.toHaveAttribute("aria-busy");
  });

  it("align=end の列は見出しとセルが右寄せの印を持ち、狭い幅のカード表示用に列見出しを data-label に持つ（BR4.1・BR4.2）", () => {
    render(<DataTable caption="架空の一覧" columns={columns} rows={rows} rowKey={(r) => r.id} />);
    expect(screen.getByRole("columnheader", { name: "金額(円)" })).toHaveClass(
      "uk-table__cell--end",
    );
    const amountCell = screen.getByRole("cell", { name: "480" });
    expect(amountCell).toHaveClass("uk-table__cell--end");
    expect(amountCell).toHaveAttribute("data-label", "金額(円)");
    expect(screen.getByRole("cell", { name: "架空の交通費" })).not.toHaveClass(
      "uk-table__cell--end",
    );
  });

  it("0件のときは見出しだけを表示し、行は描画しない（空の表示は呼び出し側の StatusPanel が担う）", () => {
    render(<DataTable caption="架空の一覧 0件" columns={columns} rows={[]} rowKey={(r) => r.id} />);
    const table = screen.getByRole("table", { name: "架空の一覧 0件" });
    expect(within(table).getAllByRole("row")).toHaveLength(1);
    expect(within(table).queryAllByRole("cell")).toHaveLength(0);
  });

  it("<script> を含む文字列を HTML ではなく文字として表示する（NFR8.1）", () => {
    const hostile: FakeRow = {
      id: "x",
      date: "10/05",
      category: "<script>alert(1)</script>",
      amount: 1,
    };
    const { container } = render(
      <DataTable caption="架空の一覧" columns={columns} rows={[hostile]} rowKey={(r) => r.id} />,
    );
    expect(screen.getByRole("cell", { name: "<script>alert(1)</script>" })).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
  });

  it("busy のとき aria-busy を真にする", () => {
    render(
      <DataTable caption="架空の一覧" columns={columns} rows={rows} rowKey={(r) => r.id} busy />,
    );
    expect(screen.getByRole("table", { name: "架空の一覧" })).toHaveAttribute("aria-busy", "true");
  });

  it("行の操作ボタンを置いた状態と busy の状態で axe の違反が0件（NFR2.1）", async () => {
    const withActions: DataTableColumn<FakeRow>[] = [
      ...columns,
      {
        key: "actions",
        header: "操作",
        render: (row) => (
          <Button
            variant="danger"
            aria-label={`${row.date} ${row.category} を削除`}
            onClick={vi.fn()}
          >
            削除
          </Button>
        ),
      },
    ];
    const { container } = render(
      <>
        <DataTable caption="架空の一覧" columns={withActions} rows={rows} rowKey={(r) => r.id} />
        <DataTable
          caption="架空の読み込み中"
          columns={columns}
          rows={[]}
          rowKey={(r) => r.id}
          busy
        />
      </>,
    );
    await expectNoAxeViolations(container);
  });
});
