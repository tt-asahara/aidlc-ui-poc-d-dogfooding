// Button のテスト（BR2.1〜BR2.4、NFR2.1、NFR2.2）。実装の後に書くテスト（Testing Contract の ordering）。
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { Button, DEFAULT_BUSY_LABEL } from "./Button";
import { expectNoAxeViolations } from "./test-fixtures";

describe("Button", () => {
  it("クリック・Enter・Space のどれでも onClick が呼ばれる（BR2.2）", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>登録する</Button>);
    const button = screen.getByRole("button", { name: "登録する" });

    await user.click(button);
    button.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");

    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("既定は type=button・副ボタンで、variant ごとの見た目の印が付く", () => {
    render(
      <>
        <Button>キャンセル</Button>
        <Button variant="primary" type="submit">
          保存する
        </Button>
        <Button variant="danger">削除する</Button>
      </>,
    );
    const cancel = screen.getByRole("button", { name: "キャンセル" });
    expect(cancel).toHaveAttribute("type", "button");
    expect(cancel).toHaveClass("uk-button--secondary");
    expect(screen.getByRole("button", { name: "保存する" })).toHaveAttribute("type", "submit");
    expect(screen.getByRole("button", { name: "削除する" })).toHaveClass("uk-button--danger");
  });

  it("処理中は押しても onClick が呼ばれず、文言が「処理中…」に変わり aria-busy が付く（BR2.1）", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(
      <Button busy onClick={onClick}>
        登録する
      </Button>,
    );
    const button = screen.getByRole("button", { name: DEFAULT_BUSY_LABEL });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");

    await user.click(button);
    button.focus();
    await user.keyboard("{Enter}");
    expect(onClick).not.toHaveBeenCalled();
    // 処理中でもフォーカスは失われない（disabled 属性を使わないため）。
    expect(button).toHaveFocus();

    // 終われば元の文言に戻り、押せるようになる。
    rerender(<Button onClick={onClick}>登録する</Button>);
    await user.click(screen.getByRole("button", { name: "登録する" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("処理中の submit ボタンはフォームを送信しない", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <form onSubmit={onSubmit} aria-label="架空の登録フォーム">
        <Button type="submit" busy busyLabel="保存中…">
          保存する
        </Button>
      </form>,
    );
    await user.click(screen.getByRole("button", { name: "保存中…" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disabled のときは押せない", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        前月
      </Button>,
    );
    const button = screen.getByRole("button", { name: "前月" });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("aria-label で名前を付けられ、DOM 要素への参照を受け取れる（BR2.4）", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Button ref={ref} aria-label="2026-10-01 架空の食費 1,200円 を削除">
        削除
      </Button>,
    );
    const button = screen.getByRole("button", { name: "2026-10-01 架空の食費 1,200円 を削除" });
    expect(ref.current).toBe(button);
  });

  it("通常・処理中・無効の状態で axe の違反が0件（NFR2.1）", async () => {
    const { container } = render(
      <>
        <Button variant="primary">登録する</Button>
        <Button busy>登録する</Button>
        <Button disabled>削除する</Button>
      </>,
    );
    await expectNoAxeViolations(container);
  });
});
