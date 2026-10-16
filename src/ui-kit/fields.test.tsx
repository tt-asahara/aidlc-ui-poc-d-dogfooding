// 入力欄（TextField・Select・RadioGroup・FieldError）のテスト（BR3.1〜BR3.3、BR2.4、NFR2.1〜NFR2.3）。
// 実装の後に書くテスト（Testing Contract の ordering）。
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { FieldError, formatFieldError, RadioGroup, Select, TextField } from "./fields";
import { expectNoAxeViolations } from "./test-fixtures";

function ControlledTextField(props: { onEnter?: () => void }) {
  const [value, setValue] = useState("");
  return (
    <TextField id="memo" label="メモ" value={value} onChange={setValue} onEnter={props.onEnter} />
  );
}

describe("TextField", () => {
  it("見えるラベルと入力欄が結び付き、入力した文字が onChange で渡る（BR3.1）", async () => {
    const user = userEvent.setup();
    render(<ControlledTextField />);
    const input = screen.getByLabelText("メモ");
    await user.type(input, "架空のランチ");
    expect(input).toHaveValue("架空のランチ");
  });

  it("必須の項目は「*」を見せ、aria-required を付ける（BR3.1）", () => {
    render(<TextField id="amount" label="金額" value="" onChange={vi.fn()} required />);
    const input = screen.getByRole("textbox", { name: "金額" });
    expect(input).toHaveAttribute("aria-required", "true");
    expect(screen.getByText("*")).toHaveAttribute("aria-hidden", "true");
  });

  it("エラーがあると aria-invalid と aria-describedby（補足とエラー）が付き、直下に「⚠ 項目名：直し方」を表示する（BR3.2）", () => {
    render(
      <TextField
        id="amount"
        label="金額"
        value="abc"
        onChange={vi.fn()}
        hint="円・整数"
        inputMode="numeric"
        error="1〜99,999,999 の整数で入力してください"
      />,
    );
    const input = screen.getByRole("textbox", { name: "金額" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "amount-hint amount-error");
    expect(input).toHaveAttribute("inputmode", "numeric");
    // 記号「⚠」は aria-hidden のため、読み上げの説明には含まれない。
    expect(input).toHaveAccessibleDescription(
      "円・整数 金額：1〜99,999,999 の整数で入力してください",
    );
    expect(screen.getByText("⚠")).toHaveAttribute("aria-hidden", "true");
  });

  it("エラーが空文字ならエラーなしとして扱う", () => {
    render(<TextField id="memo" label="メモ" value="" onChange={vi.fn()} error="" />);
    const input = screen.getByRole("textbox", { name: "メモ" });
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("Enter で onEnter が呼ばれ、日本語の変換の確定中の Enter では呼ばれない", async () => {
    const user = userEvent.setup();
    const onEnter = vi.fn();
    render(<ControlledTextField onEnter={onEnter} />);
    const input = screen.getByLabelText("メモ");

    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(onEnter).not.toHaveBeenCalled();

    await user.type(input, "架空{Enter}");
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it("maxLength を渡すと入力できる長さが制限され、DOM 要素への参照を受け取れる（BR2.4）", () => {
    const ref = createRef<HTMLInputElement>();
    render(
      <TextField ref={ref} id="memo" label="メモ" value="" onChange={vi.fn()} maxLength={200} />,
    );
    expect(ref.current).toBe(screen.getByRole("textbox", { name: "メモ" }));
    expect(ref.current).toHaveAttribute("maxlength", "200");
  });
});

describe("Select", () => {
  const options = [
    { value: "c-food", label: "架空の食費" },
    { value: "c-rent", label: "架空の家賃" },
  ];

  it("ラベルで選べ、選んだ値が onChange で渡る", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const ref = createRef<HTMLSelectElement>();
    render(
      <Select
        ref={ref}
        id="category"
        label="カテゴリ"
        value="c-food"
        options={options}
        onChange={onChange}
      />,
    );
    const select = screen.getByRole("combobox", { name: "カテゴリ" });
    expect(ref.current).toBe(select);
    await user.selectOptions(select, "c-rent");
    expect(onChange).toHaveBeenCalledWith("c-rent");
  });

  it("エラーがあると aria-invalid と aria-describedby が付く（BR3.2）", () => {
    render(
      <Select
        id="category"
        label="カテゴリ"
        value=""
        options={[{ value: "", label: "選んでください" }, ...options]}
        onChange={vi.fn()}
        error="カテゴリを選んでください"
      />,
    );
    const select = screen.getByRole("combobox", { name: "カテゴリ" });
    expect(select).toHaveAttribute("aria-invalid", "true");
    // 項目名から始まる文は項目名を重ねない。
    expect(select).toHaveAccessibleDescription("カテゴリを選んでください");
    expect(screen.getByText(/カテゴリを選んでください/)).toHaveTextContent(
      "⚠カテゴリを選んでください",
    );
  });
});

describe("RadioGroup", () => {
  const options = [
    { value: "expense", label: "支出" },
    { value: "income", label: "収入" },
  ] as const;

  function ControlledRadioGroup() {
    const [value, setValue] = useState<"expense" | "income">("expense");
    return (
      <RadioGroup
        legend="種別"
        name="type"
        value={value}
        options={[...options]}
        onChange={setValue}
      />
    );
  }

  it("fieldset と legend で囲まれ、矢印キーで選択が移る（BR3.3）", async () => {
    const user = userEvent.setup();
    render(<ControlledRadioGroup />);
    expect(screen.getByRole("group", { name: "種別" })).toBeInTheDocument();
    const expense = screen.getByRole("radio", { name: "支出" });
    const income = screen.getByRole("radio", { name: "収入" });
    expect(expense).toBeChecked();

    await user.tab();
    expect(expense).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(income).toBeChecked();
    expect(income).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(expense).toBeChecked();
  });

  it("参照は選択中のラジオに、どれも選ばれていなければ先頭のラジオに結び付く（BR2.4）", () => {
    const ref = createRef<HTMLInputElement>();
    const { rerender } = render(
      <RadioGroup
        ref={ref}
        legend="種別"
        name="type"
        value="income"
        options={[...options]}
        onChange={vi.fn()}
      />,
    );
    expect(ref.current).toBe(screen.getByRole("radio", { name: "収入" }));

    rerender(
      <RadioGroup
        ref={ref}
        legend="種別"
        name="type"
        value={"unknown" as "income"}
        options={[...options]}
        onChange={vi.fn()}
      />,
    );
    expect(ref.current).toBe(screen.getByRole("radio", { name: "支出" }));
  });
});

describe("FieldError", () => {
  it("記号は読み上げから外し、「項目名：直し方」を文で示す（BR3.2、NFR2.3）", () => {
    render(
      <FieldError
        id="date-error"
        field="日付"
        message="存在する日付を YYYY-MM-DD で入力してください"
      />,
    );
    const error = screen.getByText(/日付：存在する日付/);
    expect(error).toHaveAttribute("id", "date-error");
    expect(error).toHaveTextContent("⚠日付：存在する日付を YYYY-MM-DD で入力してください");
  });

  it("項目名から始まる文には項目名を重ねない", () => {
    expect(formatFieldError("金額", "金額：1〜99,999,999 の整数で入力してください")).toBe(
      "金額：1〜99,999,999 の整数で入力してください",
    );
    expect(formatFieldError("金額", "金額を入力してください")).toBe("金額を入力してください");
    expect(formatFieldError("メモ", "200文字以内で入力してください")).toBe(
      "メモ：200文字以内で入力してください",
    );
  });
});

describe("入力欄のアクセシビリティ", () => {
  it("通常・必須・エラーの状態で axe の違反が0件（NFR2.1）", async () => {
    const { container } = render(
      <form aria-label="架空の収支の登録">
        <TextField id="date" label="日付" value="2026-10-01" onChange={vi.fn()} hint="YYYY-MM-DD" />
        <TextField
          id="amount"
          label="金額"
          value=""
          onChange={vi.fn()}
          required
          error="金額を入力してください"
        />
        <Select
          id="category"
          label="カテゴリ"
          value="c-food"
          options={[{ value: "c-food", label: "架空の食費" }]}
          onChange={vi.fn()}
          error="カテゴリを選んでください"
        />
        <RadioGroup
          legend="種別"
          name="type"
          value="expense"
          options={[
            { value: "expense", label: "支出" },
            { value: "income", label: "収入" },
          ]}
          onChange={vi.fn()}
        />
      </form>,
    );
    await expectNoAxeViolations(container);
  });
});
