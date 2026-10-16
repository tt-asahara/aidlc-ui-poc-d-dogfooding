// FileInput のテスト（BR7.1、BR2.4、NFR2.1）。実装の後に書くテスト（Testing Contract の ordering）。
// OS のファイル選択画面の中の操作は自動テストの対象外とし、架空の CSV を入力に直接与える（accessibility-checklist 第2章）。
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { FileInput } from "./FileInput";
import { expectNoAxeViolations } from "./test-fixtures";

function fakeCsv(name = "架空の収支.csv"): File {
  return new File(["date,type,category,amount,memo\n2026-10-01,expense,架空の食費,1200,\n"], name, {
    type: "text/csv",
  });
}

describe("FileInput", () => {
  it("見えるラベルで file 入力が見つかり、accept が付く（BR7.1）", () => {
    render(
      <FileInput id="csv-file" label="ファイルを選ぶ" accept=".csv,text/csv" onSelect={vi.fn()} />,
    );
    const input = screen.getByLabelText("ファイルを選ぶ");
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("accept", ".csv,text/csv");
  });

  it("選んだファイルを onSelect に渡し、入力を空に戻して同じファイルをもう一度選べる（BR7.1）", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <FileInput id="csv-file" label="ファイルを選ぶ" accept=".csv,text/csv" onSelect={onSelect} />,
    );
    const input = screen.getByLabelText<HTMLInputElement>("ファイルを選ぶ");
    const file = fakeCsv();

    await user.upload(input, file);
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(file);
    expect(input.value).toBe("");

    await user.upload(input, file);
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it("複数のファイルが来ても最初の1件だけを渡す", () => {
    const onSelect = vi.fn();
    render(
      <FileInput id="csv-file" label="ファイルを選ぶ" accept=".csv,text/csv" onSelect={onSelect} />,
    );
    const input = screen.getByLabelText("ファイルを選ぶ");
    const first = fakeCsv("架空の1.csv");
    fireEvent.change(input, { target: { files: [first, fakeCsv("架空の2.csv")] } });
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(first);
  });

  it("ファイルが選ばれなかった（選択画面を閉じただけ）ときは onSelect を呼ばない", () => {
    const onSelect = vi.fn();
    render(
      <FileInput id="csv-file" label="ファイルを選ぶ" accept=".csv,text/csv" onSelect={onSelect} />,
    );
    fireEvent.change(screen.getByLabelText("ファイルを選ぶ"), { target: { files: [] } });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("disabled のときは選べず、DOM 要素への参照を受け取れる（BR2.4）", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const ref = createRef<HTMLInputElement>();
    render(
      <FileInput
        ref={ref}
        id="csv-file"
        label="ファイルを選ぶ"
        accept=".csv,text/csv"
        onSelect={onSelect}
        disabled
      />,
    );
    const input = screen.getByLabelText("ファイルを選ぶ");
    expect(ref.current).toBe(input);
    expect(input).toBeDisabled();
    await user.upload(input, fakeCsv());
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("Tab で到達でき、axe の違反が0件（NFR2.1、NFR2.2）", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <FileInput id="csv-file" label="ファイルを選ぶ" accept=".csv,text/csv" onSelect={vi.fn()} />,
    );
    await user.tab();
    expect(screen.getByLabelText("ファイルを選ぶ")).toHaveFocus();
    await expectNoAxeViolations(container);
  });
});
