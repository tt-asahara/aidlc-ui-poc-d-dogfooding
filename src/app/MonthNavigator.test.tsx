// 対象月の移動（BR1.4）。2000-01〜2099-12 の外へは動けない。
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { expectNoAxeViolations } from "../ui-kit/test-fixtures";
import { MonthNavigator } from "./MonthNavigator";

describe("MonthNavigator", () => {
  it("対象月を見出しの形式で表示し、前後のボタンに移動先の月を名前として持たせる", () => {
    render(<MonthNavigator month="2026-10" onChange={vi.fn()} />);
    expect(screen.getByText("2026年10月")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "前月（2026年9月）" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "翌月（2026年11月）" })).toBeEnabled();
  });

  it("前月と翌月のボタンで対象月を1か月ずらして通知する", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MonthNavigator month="2026-10" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "翌月（2026年11月）" }));
    expect(onChange).toHaveBeenLastCalledWith("2026-11");
    await user.click(screen.getByRole("button", { name: "前月（2026年9月）" }));
    expect(onChange).toHaveBeenLastCalledWith("2026-09");
  });

  it("範囲の端（2000-01 と 2099-12）では外へ動かせない", () => {
    const { unmount } = render(<MonthNavigator month="2000-01" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^前月/ })).toBeDisabled();
    unmount();
    render(<MonthNavigator month="2099-12" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^翌月/ })).toBeDisabled();
  });

  it("disabled のときは両方のボタンを押せない（読み込み中）", () => {
    render(<MonthNavigator month="2026-10" onChange={vi.fn()} disabled />);
    expect(screen.getByRole("button", { name: /^前月/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^翌月/ })).toBeDisabled();
  });

  it("自動のアクセシビリティ検査で違反がない", async () => {
    const { container } = render(<MonthNavigator month="2026-10" onChange={vi.fn()} />);
    await expectNoAxeViolations(container);
  });
});
