// アプリの枠（BR1.2、BR1.4、BR1.6、BR8.4、BR9.1、BR10.1）。起動の4つの状態、S0-a と S0-b の表示でタブを出さないこと、再試行、月の共有。
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { BookOpenResult } from "../bookkeeping-core";
import { expectNoAxeViolations } from "../ui-kit/test-fixtures";
import { App } from "./App";
import { useShell } from "./appState";
import { fixedNow, openTestBook } from "./test-fixtures";
import type { ScreenId } from "./types";

/** 各タブの中身。現在の対象月と、月の変更・タブの移動・newer-version の操作を持つ。 */
function Probe({ screenId }: { screenId: ScreenId }) {
  const shell = useShell();
  return (
    <div>
      <p>{`${screenId}:${shell.month}`}</p>
      <button onClick={() => shell.setMonth("2026-11")}>対象月を11月にする</button>
      <button onClick={() => shell.navigate("summary")}>集計へ</button>
      <button onClick={shell.onNewerVersion}>新しい版へ切り替える</button>
    </div>
  );
}

function renderApp(open: () => Promise<BookOpenResult> = openTestBook) {
  return render(<App open={open} renderScreen={(id) => <Probe screenId={id} />} now={fixedNow} />);
}

describe("アプリの枠", () => {
  it("起動中は保存データの読み込み中を示し、タブは出さない", () => {
    renderApp(() => new Promise<BookOpenResult>(() => undefined));
    expect(screen.getByText("保存データを読み込み中…")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("ready のときヘッダーに架空データの表示、本文へのリンク、5つのタブを出す（BR10.1、BR9.1）", async () => {
    renderApp();
    expect(await screen.findByRole("tablist", { name: "画面の切り替え" })).toBeInTheDocument();
    expect(screen.getByText("※架空データ専用")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "本文へ移動" })).toHaveAttribute(
      "href",
      "#main-content",
    );
    expect(screen.getAllByRole("tab")).toHaveLength(5);
  });

  it("保存の場所が使えないと、タブと入力を出さず理由と再読み込みだけを出す（BR8.4）", async () => {
    renderApp(() => Promise.resolve({ status: "unavailable" }));
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("この環境ではデータを保存できません")).toBeInTheDocument();
    expect(screen.getByText("通常のウィンドウで開き直してください。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "再読み込み" })).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).toBeNull();
    await expectNoAxeViolations(document.body);
  });

  it("保存データが新しい版のときは S0-b を表示し、タブを出さない（BR1.2）", async () => {
    renderApp(() => Promise.resolve({ status: "newer-version" }));
    expect(
      await screen.findByText("新しい版で保存されたデータのため開けません"),
    ).toBeInTheDocument();
    expect(screen.getByText(/データは変更していません。/)).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("読み込みに失敗したら再試行を出し、押すと openBook を呼び直す（BR1.2）", async () => {
    const user = userEvent.setup();
    const open = vi
      .fn<() => Promise<BookOpenResult>>()
      .mockResolvedValueOnce({ status: "load-failed", message: "データを読み込めませんでした" })
      .mockImplementation(() => openTestBook());
    renderApp(open);
    expect(await screen.findByText("データを読み込めませんでした")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).toBeNull();
    await user.click(screen.getByRole("button", { name: "再試行" }));
    expect(await screen.findByRole("tablist")).toBeInTheDocument();
    expect(open).toHaveBeenCalledTimes(2);
  });

  it("起動の処理が例外で失敗したら、読み込み失敗として再試行を出す（黙って捨てない）", async () => {
    renderApp(() => Promise.reject(new Error("想定外")));
    expect(await screen.findByText("データを読み込めませんでした")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "再試行" })).toBeInTheDocument();
  });

  it("対象月は初期値が今月で、タブを移っても同じ月が選ばれている（BR1.4）", async () => {
    const user = userEvent.setup();
    renderApp();
    expect(await screen.findByText("transactions:2026-10")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "対象月を11月にする" }));
    expect(screen.getByText("transactions:2026-11")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "月次集計" }));
    expect(screen.getByText("summary:2026-11")).toBeInTheDocument();
  });

  it("操作の途中で newer-version が返ったら S0-b に切り替え、以後のタブを出さない（BR1.6）", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(await screen.findByRole("button", { name: "新しい版へ切り替える" }));
    expect(
      await screen.findByText("新しい版で保存されたデータのため開けません"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("画面の中から別のタブへ移れる（導線）", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(await screen.findByRole("button", { name: "集計へ" }));
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "月次集計" })).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
  });

  it("ready の枠は自動のアクセシビリティ検査で違反がない（NFR2.2）", async () => {
    const { container } = renderApp();
    await screen.findByRole("tablist");
    await expectNoAxeViolations(container);
  });
});
