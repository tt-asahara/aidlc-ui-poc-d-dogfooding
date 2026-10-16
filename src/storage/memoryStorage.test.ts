// 差し替え（createMemoryStorage）だけのテスト：失敗の注入と待ち（BR5.1、読み込み中・保存失敗の観点）。
import { describe, expect, it } from "vitest";
import { createMemoryStorage } from "./memoryStorage";
import { fakeCategory } from "./test-fixtures";
import type { StorageHandle } from "./types";

async function openOk(
  options: Parameters<typeof createMemoryStorage>[0] = {},
): Promise<StorageHandle> {
  const opened = await createMemoryStorage(options);
  if (!opened.ok) throw new Error(`開けませんでした: ${opened.error.kind}`);
  return opened.value;
}

/** promise がまだ終わっていないかを確かめる（次の周回まで待ってから見る）。 */
async function isSettled(promise: Promise<unknown>): Promise<boolean> {
  let settled = false;
  void promise.then(
    () => (settled = true),
    () => (settled = true),
  );
  await new Promise((resolve) => setTimeout(resolve, 5));
  return settled;
}

describe("createMemoryStorage: 失敗の注入", () => {
  it("failOpen を指定するとその失敗を返す", async () => {
    expect(await createMemoryStorage({ failOpen: { kind: "unavailable" } })).toEqual({
      ok: false,
      error: { kind: "unavailable" },
    });
    expect(
      await createMemoryStorage({ failOpen: { kind: "newer-version", found: 2, supported: 1 } }),
    ).toEqual({ ok: false, error: { kind: "newer-version", found: 2, supported: 1 } });
  });

  it("failReads を指定すると read は work を呼ばずに read-failed", async () => {
    const handle = await openOk({ failReads: true });
    let called = false;
    const result = await handle.read(["categories"], (tx) => {
      called = true;
      return tx.getAll("categories");
    });
    expect(result.ok === false && result.error.kind).toBe("read-failed");
    expect(called).toBe(false);
  });

  it("failWrites を指定すると write は write-failed で、何も書かれない（保存失敗）", async () => {
    const handle = await openOk({ failWrites: true });
    const result = await handle.write(["categories"], async (tx) => {
      await tx.put("categories", fakeCategory());
      return { ok: true, value: undefined };
    });
    expect(result.ok === false && result.error.kind).toBe("write-failed");
    expect(await handle.read(["categories"], (tx) => tx.getAll("categories"))).toEqual({
      ok: true,
      value: [],
    });
  });
});

describe("createMemoryStorage: delayMs（読み込み中）", () => {
  it("delayMs の間は開く・読み取りの結果が未完了で、待った後に結果が返る", async () => {
    const opening = createMemoryStorage({ delayMs: 40 });
    expect(await isSettled(opening)).toBe(false);
    const opened = await opening;
    if (!opened.ok) throw new Error("開けませんでした");

    const reading = opened.value.read(["categories"], (tx) => tx.getAll("categories"));
    expect(await isSettled(reading)).toBe(false);
    expect(await reading).toEqual({ ok: true, value: [] });
  });

  it("delayMs は書き込みにも効き、待ちの後でも自動確定とみなさず保存する", async () => {
    const handle = await openOk({ delayMs: 20 });
    const writing = handle.write(["categories"], async (tx) => {
      await tx.put("categories", fakeCategory());
      return { ok: true, value: "保存済み" };
    });
    expect(await isSettled(writing)).toBe(false);
    expect(await writing).toEqual({ ok: true, value: "保存済み" });
  });

  it("負の delayMs は 0 として扱う", async () => {
    const handle = await openOk({ delayMs: -10 });
    expect((await handle.read(["meta"], (tx) => tx.get("meta", "schema"))).ok).toBe(true);
  });
});

describe("createMemoryStorage: 写し", () => {
  it("読み取った値を書き換えても保存領域は変わらない", async () => {
    const handle = await openOk();
    await handle.write(["categories"], async (tx) => {
      await tx.put("categories", fakeCategory());
      return { ok: true, value: undefined };
    });
    const first = await handle.read(["categories"], (tx) => tx.get("categories", "cat-food"));
    if (first.ok && first.value !== undefined) first.value.name = "書き換えた架空の名前";
    const second = await handle.read(["categories"], (tx) => tx.get("categories", "cat-food"));
    expect(second).toEqual({ ok: true, value: fakeCategory() });
  });
});
