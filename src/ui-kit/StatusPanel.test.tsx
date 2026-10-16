// StatusPanel のテスト（BR6.1・BR6.2、W4、NFR2.1、NFR2.3）。実装の後に書くテスト（Testing Contract の ordering）。
// 時間は Vitest の偽のタイマーで進める。
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SLOW_AFTER_MS, SLOW_LOADING_TEXT, StatusPanel } from "./StatusPanel";
import { expectNoAxeViolations } from "./test-fixtures";

describe("StatusPanel の文言と役割（BR6.1）", () => {
  it.each([
    ["loading", "status", "⏳収支を読み込み中…"],
    ["error", "alert", "⚠データを読み込めませんでした"],
    ["empty", "status", "収支はまだありません。"],
    ["unavailable", "alert", "⚠この環境ではデータを保存できません"],
    ["newer-version", "alert", "⚠新しい版で保存されたデータのため開けません"],
  ] as const)("%s は role=%s で「%s」を表示する", (kind, role, text) => {
    render(<StatusPanel kind={kind} subject="収支" />);
    const panel = screen.getByRole(role);
    expect(panel).toHaveTextContent(text);
    // 記号は読み上げから外す（NFR2.3: 意味は文でも示す）。
    for (const symbol of panel.querySelectorAll(".uk-symbol")) {
      expect(symbol).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("action を渡すとボタンを表示し、押すと onClick が呼ばれる", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<StatusPanel kind="error" subject="収支" action={{ label: "再試行", onClick }} />);
    await user.click(screen.getByRole("button", { name: "再試行" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("読み込み中・失敗・空（導線あり）の状態で axe の違反が0件（NFR2.1）", async () => {
    const { container } = render(
      <>
        <StatusPanel kind="loading" subject="集計" />
        <StatusPanel kind="error" subject="収支" action={{ label: "再試行", onClick: vi.fn() }} />
        <StatusPanel
          kind="empty"
          subject="この月の収支"
          action={{ label: "登録欄へ移動", onClick: vi.fn() }}
        />
      </>,
    );
    await expectNoAxeViolations(container);
  });
});

describe("StatusPanel の遅延の追記（BR6.2）", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("読み込み中のまま既定の 5,000ms を過ぎると追記し、その直前までは追記しない", () => {
    render(<StatusPanel kind="loading" subject="収支" />);
    act(() => {
      vi.advanceTimersByTime(DEFAULT_SLOW_AFTER_MS - 1);
    });
    expect(screen.queryByText(SLOW_LOADING_TEXT)).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("status")).toHaveTextContent(SLOW_LOADING_TEXT);
  });

  it("kind が変われば追記を消し、再び読み込み中になれば時間を数え直す", () => {
    const { rerender } = render(<StatusPanel kind="loading" subject="収支" slowAfterMs={1000} />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText(SLOW_LOADING_TEXT)).toBeInTheDocument();

    rerender(<StatusPanel kind="error" subject="収支" slowAfterMs={1000} />);
    expect(screen.queryByText(SLOW_LOADING_TEXT)).toBeNull();

    rerender(<StatusPanel kind="loading" subject="収支" slowAfterMs={1000} />);
    expect(screen.queryByText(SLOW_LOADING_TEXT)).toBeNull();
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(screen.queryByText(SLOW_LOADING_TEXT)).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText(SLOW_LOADING_TEXT)).toBeInTheDocument();
  });

  it("読み込み中以外ではタイマーを使わず、画面から外れたらタイマーを取り消す", () => {
    const { rerender, unmount } = render(<StatusPanel kind="empty" subject="収支" />);
    expect(vi.getTimerCount()).toBe(0);

    rerender(<StatusPanel kind="loading" subject="収支" />);
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("slowAfterMs に負の値が来ても 0ms として扱い、例外にならない", () => {
    render(<StatusPanel kind="loading" subject="収支" slowAfterMs={-10} />);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(screen.getByText(SLOW_LOADING_TEXT)).toBeInTheDocument();
  });
});
