// 性能の目安（NFR3.1、security-design.md 4.3 節）。fake-indexeddb 上の時間は実ブラウザの値ではなく、
// 保存の層の大きな遅れを見つけるための目安とする。測定値は出力に記録する。
// 合格条件は設計どおり（書き込み 2,000ms、1か月の読み出し 300ms・偏り 1,000ms）。不安定でも条件は緩めない。
import { describe, expect, it } from "vitest";
import { openStorage } from "./idbStorage";
import { fakeTransactions, newFactory, uniqueDbName } from "./test-fixtures";
import type { StorageHandle } from "./types";

const TWELVE_MONTHS = Array.from(
  { length: 12 },
  (_, i) => `2026-${String(i + 1).padStart(2, "0")}`,
);

async function openOk(): Promise<StorageHandle> {
  const opened = await openStorage({ indexedDB: newFactory(), dbName: uniqueDbName() });
  if (!opened.ok) throw new Error(`開けませんでした: ${opened.error.kind}`);
  return opened.value;
}

async function measure<T>(work: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const start = performance.now();
  const value = await work();
  return { value, ms: performance.now() - start };
}

async function writeAll(handle: StorageHandle, months: readonly string[]) {
  const transactions = fakeTransactions(5000, months);
  return measure(() =>
    handle.write(["transactions"], async (tx) => {
      for (const transaction of transactions) await tx.put("transactions", transaction);
      return { ok: true, value: transactions.length };
    }),
  );
}

function readMonth(handle: StorageHandle, month: string) {
  return measure(() =>
    handle.read(["transactions"], (tx) => tx.getAllByIndex("transactions", "byMonth", month)),
  );
}

describe("性能の目安（fake-indexeddb）", () => {
  it("5,000件を1回の write で保存し（2,000ms 以内）、1か月分を読み出す（300ms 以内）", async () => {
    const handle = await openOk();
    const written = await writeAll(handle, TWELVE_MONTHS);
    const read = await readMonth(handle, "2026-03");
    console.info(
      `[性能] 5,000件の書き込み: ${written.ms.toFixed(1)}ms / 1か月分（12か月に均等）の読み出し: ${read.ms.toFixed(1)}ms`,
    );
    expect(written.value).toEqual({ ok: true, value: 5000 });
    expect(read.value.ok && read.value.value.length).toBe(417);
    expect(written.ms).toBeLessThan(2000);
    expect(read.ms).toBeLessThan(300);
    handle.close();
  });

  it("5,000件がすべて同じ月でも、1か月分を 1,000ms 以内に読み出す", async () => {
    const handle = await openOk();
    const written = await writeAll(handle, ["2026-07"]);
    const read = await readMonth(handle, "2026-07");
    console.info(
      `[性能] 5,000件の書き込み（同じ月）: ${written.ms.toFixed(1)}ms / 1か月分（集中）の読み出し: ${read.ms.toFixed(1)}ms`,
    );
    expect(written.value.ok).toBe(true);
    expect(read.value.ok && read.value.value.length).toBe(5000);
    expect(read.ms).toBeLessThan(1000);
    handle.close();
  });
});
