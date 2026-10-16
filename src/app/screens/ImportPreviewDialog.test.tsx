// 取り込みプレビュー（D3、US7.1、US7.2、US7.4、US9.2、BR7.2〜BR7.5）。全件表示、行番号と理由、既存と同じ内容の注記、0件の確定の無効、キャンセルと Esc、フォーカス。
import { createRef } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ImportPreview } from "../../csv-exchange";
import { expectNoAxeViolations } from "../../ui-kit/test-fixtures";
import { ImportPreviewDialog, type ImportPreviewDialogProps } from "./ImportPreviewDialog";

// 架空の取り込み内容（実在の名前・口座は使わない）。
const preview: ImportPreview = {
  fileName: "架空の家計簿.csv",
  validRows: [
    {
      line: 2,
      date: "2026-10-01",
      type: "expense",
      categoryId: "c-food",
      categoryName: "食費",
      amount: 1200,
      memo: "架空のランチ",
      sameAsExisting: false,
    },
    {
      line: 4,
      date: "2026-10-02",
      type: "expense",
      categoryId: "c-transport",
      categoryName: "交通費",
      amount: 3000,
      memo: "架空の定期代",
      sameAsExisting: true,
    },
  ],
  invalidRows: [
    {
      line: 3,
      reasons: ['金額が数値ではありません（"abc"）'],
      raw: ["2026-10-02", "expense", "食費", "abc", ""],
    },
  ],
};

function renderDialog(overrides: Partial<ImportPreviewDialogProps> = {}) {
  const props: ImportPreviewDialogProps = {
    open: true,
    preview,
    busy: false,
    error: null,
    returnFocusRef: createRef<HTMLElement>(),
    onConfirm: vi.fn<() => void>(),
    onCancel: vi.fn<() => void>(),
    ...overrides,
  };
  return { ...render(<ImportPreviewDialog {...props} />), props };
}

describe("取り込みプレビュー（D3）", () => {
  it("件数の要約と、ファイル名つきの題名を出す（US7.1）", () => {
    renderDialog();
    expect(
      screen.getByRole("dialog", { name: "取り込みの確認：架空の家計簿.csv" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/取り込める行：2件/)).toBeInTheDocument();
    expect(screen.getByText(/取り込めない行：1件/)).toBeInTheDocument();
  });

  it("取り込めない行は行番号と理由を示す（BR7.2）", () => {
    renderDialog();
    expect(screen.getByText('3行目：金額が数値ではありません（"abc"）')).toBeInTheDocument();
  });

  it("取り込める行は全件を表で示し、既存と同じ内容には注記だけを付ける（BR7.2、BR7.3）", () => {
    renderDialog();
    const table = screen.getByRole("table", { name: "取り込める行" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[1] as HTMLElement).getByText("既存と同じ内容")).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).queryByText("既存と同じ内容")).toBeNull();
    expect(screen.getByRole("button", { name: "2件を取り込む" })).toBeEnabled();
  });

  it("確定は件数つきのボタンで、押すと onConfirm を呼ぶ（BR7.4）", async () => {
    const user = userEvent.setup();
    const { props } = renderDialog();
    await user.click(screen.getByRole("button", { name: "2件を取り込む" }));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });

  it("取り込める行が0件なら確定を無効にし、その旨を示す（BR7.2）", () => {
    renderDialog({ preview: { ...preview, validRows: [] } });
    expect(screen.getByText("取り込める行がありません")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "0件を取り込む" })).toBeDisabled();
  });

  it("処理中は「取り込み中…」にし、キャンセルも無効にする（BR7.4）", () => {
    renderDialog({ busy: true });
    // 処理中の確定は disabled ではなく aria-disabled で示す（U2 の Button。フォーカスを保つため）。
    expect(screen.getByRole("button", { name: "取り込み中…" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: "キャンセル" })).toBeDisabled();
  });

  it("キャンセルと Esc は保存に触れず、onCancel だけを呼ぶ（BR7.5）", async () => {
    const user = userEvent.setup();
    const { props } = renderDialog();
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
    const nativeDialog = document.querySelector("dialog");
    if (nativeDialog === null) throw new Error("テストの前提のダイアログがありません");
    fireEvent(nativeDialog, new Event("cancel", { cancelable: true }));
    expect(props.onCancel).toHaveBeenCalledTimes(2);
  });

  it("開いたときは件数の要約へフォーカスを置く（US9.2）", () => {
    renderDialog();
    expect(screen.getByText(/取り込める行：2件/)).toHaveFocus();
  });

  it("確定の失敗の文言を D3 の中に出す（BR7.4）", () => {
    renderDialog({ error: "取り込めませんでした。1件も追加していません" });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "取り込めませんでした。1件も追加していません",
    );
  });

  it("CSV 由来の値は文字として表示し、要素を作らない（NFR8.1）", () => {
    const hostile: ImportPreview = {
      ...preview,
      validRows: [{ ...preview.validRows[0]!, memo: "<script>alert(1)</script>" }],
    };
    const { container } = renderDialog({ preview: hostile });
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
  });

  it("自動のアクセシビリティ検査で違反がない（NFR2.2）", async () => {
    renderDialog();
    await expectNoAxeViolations(document.body);
  });
});
