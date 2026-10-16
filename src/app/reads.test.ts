// 読み取りの窓口（BR1.4、BR8.1、BR8.2）。最新の要求の結果だけを反映し、古い結果は捨てる。
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { OperationError } from "../bookkeeping-core";
import type { Result } from "../data-contract";
import { READ_FAILED_ERROR, useLatestRead } from "./reads";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const noNewerVersion = () => undefined;

describe("読み取りの窓口（useLatestRead）", () => {
  it("読み取りの間は読み込み中、成功すると値を表示する", async () => {
    const read = (): Promise<Result<string, OperationError>> =>
      Promise.resolve({ ok: true, value: "架空の収支" });
    const { result } = renderHook(() => useLatestRead(read, "2026-10", noNewerVersion));
    expect(result.current.view.state).toBe("loading");
    await waitFor(() => expect(result.current.view.state).toBe("loaded"));
    expect(result.current.view).toEqual({ state: "loaded", data: "架空の収支" });
  });

  it("失敗は failed になり、そのエラーを持つ（BR8.2）", async () => {
    const error: OperationError = { kind: "storage", message: "読み込めません" };
    const read = (): Promise<Result<string, OperationError>> =>
      Promise.resolve({ ok: false, error });
    const { result } = renderHook(() => useLatestRead(read, "2026-10", noNewerVersion));
    await waitFor(() => expect(result.current.view.state).toBe("failed"));
    expect(result.current.view).toEqual({ state: "failed", error });
  });

  it("対象月が変わって遅れて返った古い結果は捨て、最新の結果だけを反映する（BR1.4）", async () => {
    const first = deferred<Result<string, OperationError>>();
    const second = deferred<Result<string, OperationError>>();
    const queue = [first, second];
    const read = () => {
      const next = queue.shift();
      if (next === undefined) throw new Error("読み取りの想定より多く呼ばれました");
      return next.promise;
    };
    const { result, rerender } = renderHook(
      ({ month }) => useLatestRead(read, month, noNewerVersion),
      { initialProps: { month: "2026-10" } },
    );
    rerender({ month: "2026-11" });
    await act(async () => {
      second.resolve({ ok: true, value: "11月の値" });
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.view).toEqual({ state: "loaded", data: "11月の値" }));
    await act(async () => {
      first.resolve({ ok: true, value: "10月の古い値" });
      await Promise.resolve();
    });
    expect(result.current.view).toEqual({ state: "loaded", data: "11月の値" });
  });

  it("読み直しの間は前の値を残して loading と示す（画面を空にしない）", async () => {
    const next = deferred<Result<string, OperationError>>();
    const queue: Promise<Result<string, OperationError>>[] = [
      Promise.resolve({ ok: true, value: "10月の値" }),
      next.promise,
    ];
    const read = () => {
      const pending = queue.shift();
      if (pending === undefined) throw new Error("読み取りの想定より多く呼ばれました");
      return pending;
    };
    const { result, rerender } = renderHook(
      ({ month }) => useLatestRead(read, month, noNewerVersion),
      { initialProps: { month: "2026-10" } },
    );
    await waitFor(() => expect(result.current.view.state).toBe("loaded"));
    rerender({ month: "2026-11" });
    expect(result.current.view).toEqual({ state: "loading", data: "10月の値" });
    await act(async () => {
      next.resolve({ ok: true, value: "11月の値" });
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.view.state).toBe("loaded"));
  });

  it("reload は同じ要求を読み直す（失敗の再試行と書き込みの後の更新。BR1.5）", async () => {
    const read = vi
      .fn<() => Promise<Result<number, OperationError>>>()
      .mockResolvedValueOnce({ ok: false, error: { kind: "storage", message: "失敗" } })
      .mockResolvedValueOnce({ ok: true, value: 3 });
    const { result } = renderHook(() => useLatestRead(read, "2026-10", noNewerVersion));
    await waitFor(() => expect(result.current.view.state).toBe("failed"));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.view).toEqual({ state: "loaded", data: 3 }));
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("newer-version が返ったら onNewerVersion を呼ぶ（BR1.6）", async () => {
    const onNewerVersion = vi.fn();
    const read = (): Promise<Result<string, OperationError>> =>
      Promise.resolve({ ok: false, error: { kind: "newer-version" } });
    const { result } = renderHook(() => useLatestRead(read, "2026-10", onNewerVersion));
    await waitFor(() => expect(result.current.view.state).toBe("failed"));
    expect(onNewerVersion).toHaveBeenCalledTimes(1);
  });

  it("読み取りが例外を投げたら、固定の文言の失敗にする（黙って捨てない）", async () => {
    const read = (): Promise<Result<string, OperationError>> => {
      throw new Error("想定外");
    };
    const { result } = renderHook(() => useLatestRead(read, "2026-10", noNewerVersion));
    await waitFor(() => expect(result.current.view.state).toBe("failed"));
    expect(result.current.view).toEqual({ state: "failed", error: READ_FAILED_ERROR });
  });
});
