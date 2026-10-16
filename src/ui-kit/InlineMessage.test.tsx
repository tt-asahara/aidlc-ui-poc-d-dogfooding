// InlineMessage のテスト（BR6.3・BR6.4、W3、NFR2.1、NFR2.3）。実装の後に書くテスト（Testing Contract の ordering）。
// 時間は Vitest の偽のタイマーで進める。
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AUTO_HIDE_MS, InlineMessage } from "./InlineMessage";
import { expectNoAxeViolations } from "./test-fixtures";

describe("InlineMessage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("success は「✓」と文を aria-live=polite で表示し、5,000ms 後に消えて onHidden を呼ぶ（BR6.3）", () => {
    const onHidden = vi.fn();
    render(
      <InlineMessage tone="success" onHidden={onHidden}>
        登録しました
      </InlineMessage>,
    );
    const message = screen.getByRole("status");
    expect(message).toHaveAttribute("aria-live", "polite");
    expect(message).toHaveTextContent("✓登録しました");
    expect(screen.getByText("✓")).toHaveAttribute("aria-hidden", "true");

    act(() => {
      vi.advanceTimersByTime(DEFAULT_AUTO_HIDE_MS - 1);
    });
    expect(screen.getByText(/登録しました/)).toBeInTheDocument();
    expect(onHidden).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText(/登録しました/)).toBeNull();
    expect(onHidden).toHaveBeenCalledTimes(1);
  });

  it("error は「⚠」と文を role=alert で表示し、時間がたっても消えない（BR6.4）", () => {
    render(
      <InlineMessage tone="error" autoHideMs={100}>
        保存できませんでした。もう一度お試しください
      </InlineMessage>,
    );
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "⚠保存できませんでした。もう一度お試しください",
    );
  });

  it("文言が変われば再び表示して時間を数え直す（BR6.3）", () => {
    const { rerender } = render(<InlineMessage tone="success">登録しました</InlineMessage>);
    act(() => {
      vi.advanceTimersByTime(DEFAULT_AUTO_HIDE_MS);
    });
    expect(screen.queryByRole("status")).toBeNull();

    rerender(<InlineMessage tone="success">削除しました</InlineMessage>);
    expect(screen.getByRole("status")).toHaveTextContent("削除しました");
    act(() => {
      vi.advanceTimersByTime(DEFAULT_AUTO_HIDE_MS - 1);
    });
    expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("描画のたびに新しい onHidden を渡されても時間を数え直さない", () => {
    const onHidden = vi.fn();
    const { rerender } = render(
      <InlineMessage tone="success" autoHideMs={1000} onHidden={() => void onHidden()}>
        保存しました
      </InlineMessage>,
    );
    act(() => {
      vi.advanceTimersByTime(600);
    });
    rerender(
      <InlineMessage tone="success" autoHideMs={1000} onHidden={() => void onHidden()}>
        保存しました
      </InlineMessage>,
    );
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(onHidden).toHaveBeenCalledTimes(1);
  });

  it("消える前に画面から外れたらタイマーを取り消し、onHidden を呼ばない", () => {
    const onHidden = vi.fn();
    const { unmount } = render(
      <InlineMessage tone="success" onHidden={onHidden}>
        登録しました
      </InlineMessage>,
    );
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(DEFAULT_AUTO_HIDE_MS);
    });
    expect(onHidden).not.toHaveBeenCalled();
  });
});

describe("InlineMessage のアクセシビリティ", () => {
  it("success と error の状態で axe の違反が0件（NFR2.1）", async () => {
    const { container } = render(
      <>
        <InlineMessage tone="success">架空の食費の予算を保存しました</InlineMessage>
        <InlineMessage tone="error">保存できませんでした。もう一度お試しください</InlineMessage>
      </>,
    );
    await expectNoAxeViolations(container);
  });
});
