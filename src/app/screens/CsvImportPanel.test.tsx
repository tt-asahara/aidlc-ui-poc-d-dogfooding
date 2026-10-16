// CSV の読み込みの欄（US7.1、US7.3、BR7.1）。ファイルの理由ごとの文言、「データがありません」を失敗と区別すること、ファイルを選ぶ操作を確かめる。
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ImportFileError } from "../../csv-exchange";
import { expectNoAxeViolations } from "../../ui-kit/test-fixtures";
import { CsvImportPanel, fileErrorView, type CsvImportPanelProps } from "./CsvImportPanel";

function renderPanel(overrides: Partial<CsvImportPanelProps> = {}) {
  const props: CsvImportPanelProps = {
    phase: "idle",
    fileError: null,
    notice: null,
    onFileSelected: vi.fn<(file: File) => void>(),
    fileInputRef: createRef<HTMLInputElement>(),
    ...overrides,
  };
  return { ...render(<CsvImportPanel {...props} />), props };
}

describe("理由ごとの文言（BR7.1）", () => {
  it("message を持つ理由（malformed）は行番号を前に付け、U6 の文言をそのまま使う", () => {
    const error: ImportFileError = {
      kind: "malformed",
      line: 4,
      message: "引用が閉じられていません",
    };
    expect(fileErrorView(error)).toEqual({
      tone: "error",
      text: "4行目：引用が閉じられていません",
    });
  });

  it("message を持つ読み取りの理由（read-failed）は U6 の文言をそのまま使う", () => {
    const error: ImportFileError = {
      kind: "read-failed",
      message: "ファイルを読み込めませんでした",
    };
    expect(fileErrorView(error)).toEqual({ tone: "error", text: "ファイルを読み込めませんでした" });
  });

  it("message を持たない理由は画面の固定の文言にする", () => {
    expect(fileErrorView({ kind: "header-mismatch" }).text).toBe(
      "見出し行の形式が違います（1行目が date,type,category,amount,memo ではありません）",
    );
    expect(fileErrorView({ kind: "too-large", limitBytes: 1048576 }).text).toBe(
      "1MB を超えるファイルは読み込めません",
    );
    expect(fileErrorView({ kind: "too-many-rows", limitRows: 5000 }).text).toBe(
      "5,000 行を超えるファイルは読み込めません",
    );
  });

  it("空のファイルは「データがありません」とし、失敗（tone error）とは区別する", () => {
    expect(fileErrorView({ kind: "empty" })).toEqual({
      tone: "status",
      text: "データがありません",
    });
  });
});

describe("CSV の読み込みの欄", () => {
  it("形式の説明と「ファイルを選ぶ」を出す", () => {
    renderPanel();
    expect(
      screen.getByText("形式：date,type,category,amount,memo（UTF-8、1MB・5,000行まで）"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("ファイルを選ぶ")).toHaveAttribute("type", "file");
  });

  it("ファイルを選ぶと、選んだファイルを親へ渡す（US7.1）", async () => {
    const user = userEvent.setup();
    const { props, container } = renderPanel();
    const input = container.querySelector('input[type="file"]');
    if (input === null) throw new Error("テストの前提のファイル入力がありません");
    const file = new File(["date,type,category,amount,memo\n"], "架空の家計簿.csv", {
      type: "text/csv",
    });
    await user.upload(input as HTMLInputElement, file);
    expect(props.onFileSelected).toHaveBeenCalledWith(file);
  });

  it("解析中は「ファイルを確認中…」を出し、ファイル入力を押せなくする（US7.1）", () => {
    const { container } = renderPanel({ phase: "analyzing" });
    expect(screen.getByRole("status")).toHaveTextContent("ファイルを確認中…");
    expect(container.querySelector('input[type="file"]')).toBeDisabled();
  });

  it("見出しの不一致は失敗として表示する（BR7.1）", () => {
    renderPanel({ phase: "fileError", fileError: { kind: "header-mismatch" } });
    expect(screen.getByRole("alert")).toHaveTextContent("見出し行の形式が違います");
  });

  it("空のファイルは失敗（alert）ではなく状態（status）として表示する（BR7.1）", () => {
    renderPanel({ phase: "fileError", fileError: { kind: "empty" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("データがありません");
  });

  it("自動のアクセシビリティ検査で違反がない（NFR2.2）", async () => {
    const { container } = renderPanel({
      phase: "fileError",
      fileError: { kind: "too-large", limitBytes: 1048576 },
    });
    await expectNoAxeViolations(container);
  });
});
