// 本物（openStorage）だけのテスト：開く・版・切断・妨げ・利用不可・容量超過（W1、BR1.1〜BR1.5、BR3.1、BR3.2、NFR4.3、NFR4.4、NFR7.1）。
import { IDBObjectStore as FakeIDBObjectStore } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SCHEMA_VERSION } from "../data-contract";
import { MESSAGES } from "./errors";
import { openStorage, safeAbort } from "./idbStorage";
import { fakeCategory, fakeTransaction, newFactory, uniqueDbName } from "./test-fixtures";
import type { StorageHandle } from "./types";

const FIXED_NOW = () => new Date("2026-04-01T00:00:00.000Z");

afterEach(() => {
  vi.restoreAllMocks();
});

async function openOk(
  factory: IDBFactory,
  dbName: string,
  now = FIXED_NOW,
): Promise<StorageHandle> {
  const opened = await openStorage({ indexedDB: factory, dbName, now });
  if (!opened.ok) throw new Error(`開けませんでした: ${opened.error.kind}`);
  return opened.value;
}

/** 「別のタブ」として、版を指定してデータベースを直接開く。 */
function openRaw(
  factory: IDBFactory,
  dbName: string,
  version?: number,
  onUpgrade?: (db: IDBDatabase) => void,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = version === undefined ? factory.open(dbName) : factory.open(dbName, version);
    request.onupgradeneeded = () => onUpgrade?.(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("開けませんでした"));
  });
}

/** 開く要求の振る舞いを台本どおりに起こす、テスト用の IDBFactory の差し込み。 */
interface ScriptedRequest {
  result: unknown;
  error: DOMException | null;
  transaction: IDBTransaction | null;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
  onblocked: (() => void) | null;
  onupgradeneeded: ((event: { oldVersion: number }) => void) | null;
}

function scriptedFactory(script: (request: ScriptedRequest, call: number) => void): IDBFactory {
  let call = 0;
  const factory = {
    open: () => {
      const request: ScriptedRequest = {
        result: undefined,
        error: null,
        transaction: null,
        onsuccess: null,
        onerror: null,
        onblocked: null,
        onupgradeneeded: null,
      };
      const current = call++;
      setTimeout(() => script(request, current), 0);
      return request;
    },
  };
  return factory as unknown as IDBFactory;
}

type PutMethod = (
  this: IDBObjectStore,
  value: unknown,
  key?: IDBValidKey,
) => IDBRequest<IDBValidKey>;

/** 差し替える前の fake-indexeddb の put（呼ぶときに this を渡す）。 */
function originalPutMethod(): PutMethod {
  const descriptor = Object.getOwnPropertyDescriptor(FakeIDBObjectStore.prototype, "put");
  if (typeof descriptor?.value !== "function") throw new Error("put が見つかりません");
  return descriptor.value as PutMethod;
}

function failWith(name: string, message = "架空の失敗") {
  return (request: ScriptedRequest) => {
    request.error = new DOMException(message, name);
    request.onerror?.();
  };
}

describe("openStorage: 初回の作成と2回目", () => {
  it("初回は保存領域とメタ情報（初期化日時は差し込んだ時計）を作り、2回目は作り直さない", async () => {
    const factory = newFactory();
    const dbName = uniqueDbName();
    const first = await openOk(factory, dbName);
    await first.write(["categories"], async (tx) => {
      await tx.put("categories", fakeCategory());
      return { ok: true, value: undefined };
    });
    first.close();

    const second = await openOk(factory, dbName, () => new Date("2030-01-01T00:00:00.000Z"));
    const result = await second.read(["meta", "categories"], async (tx) => ({
      meta: await tx.get("meta", "schema"),
      categories: await tx.getAll("categories"),
    }));
    expect(result).toEqual({
      ok: true,
      value: {
        meta: {
          key: "schema",
          schemaVersion: SCHEMA_VERSION,
          initializedAt: "2026-04-01T00:00:00.000Z",
        },
        categories: [fakeCategory()],
      },
    });
    second.close();
  });

  it("閉じて開き直した後も同じ収支が読める（往復、AC1.2.1 の保存の層の確認）", async () => {
    const factory = newFactory();
    const dbName = uniqueDbName();
    const transactions = [
      fakeTransaction({ id: "tx-1", date: "2026-04-01" }),
      fakeTransaction({ id: "tx-2", date: "2026-05-10", amount: 5400 }),
    ];
    const handle = await openOk(factory, dbName);
    await handle.write(["transactions"], async (tx) => {
      for (const transaction of transactions) await tx.put("transactions", transaction);
      return { ok: true, value: undefined };
    });
    handle.close();

    const reopened = await openOk(factory, dbName);
    const result = await reopened.read(["transactions"], (tx) =>
      tx.getAllByIndex("transactions", "byMonth", "2026-05"),
    );
    expect(result).toEqual({ ok: true, value: [transactions[1]] });
    reopened.close();
  });

  it("既定のデータベース名・時計でも開ける", async () => {
    const opened = await openStorage({ indexedDB: newFactory() });
    expect(opened.ok).toBe(true);
    if (opened.ok) opened.value.close();
  });
});

describe("openStorage: 版（NFR4.3）", () => {
  it("保存データの版が新しいと newer-version（found・supported）で、データは変わらない", async () => {
    const factory = newFactory();
    const dbName = uniqueDbName();
    const newerVersion = SCHEMA_VERSION + 1;
    const other = await openRaw(factory, dbName, newerVersion, (db) => {
      db.createObjectStore("future", { keyPath: "id" }).put({ id: "架空の新しい形" });
    });
    other.close();

    const opened = await openStorage({ indexedDB: factory, dbName });
    expect(opened).toEqual({
      ok: false,
      error: { kind: "newer-version", found: newerVersion, supported: SCHEMA_VERSION },
    });

    const check = await openRaw(factory, dbName);
    expect(check.version).toBe(newerVersion);
    expect([...check.objectStoreNames]).toEqual(["future"]);
    const stored = await new Promise((resolve) => {
      const request = check.transaction("future").objectStore("future").get("架空の新しい形");
      request.onsuccess = () => resolve(request.result);
    });
    expect(stored).toEqual({ id: "架空の新しい形" });
    check.close();
  });

  it("別のタブが版を上げると接続を閉じ、以後の read・write は newer-version", async () => {
    const factory = newFactory();
    const dbName = uniqueDbName();
    const handle = await openOk(factory, dbName);
    const other = await openRaw(factory, dbName, SCHEMA_VERSION + 1);
    const read = await handle.read(["categories"], (tx) => tx.getAll("categories"));
    const write = await handle.write(["categories"], () =>
      Promise.resolve({ ok: true as const, value: undefined }),
    );
    expect(read).toEqual({ ok: false, error: { kind: "newer-version" } });
    expect(write).toEqual({ ok: false, error: { kind: "newer-version" } });
    other.close();
    handle.close();
    const afterClose = await handle.read(["categories"], (tx) => tx.getAll("categories"));
    expect(afterClose.ok === false && afterClose.error.kind).toBe("read-failed");
  });

  it("版を確かめる開き直しが失敗したら found を推測せず open-failed", async () => {
    const factory = scriptedFactory((request, call) =>
      call === 0 ? failWith("VersionError")(request) : failWith("UnknownError")(request),
    );
    const opened = await openStorage({ indexedDB: factory });
    expect(opened.ok === false && opened.error.kind).toBe("open-failed");
    expect(
      opened.ok === false && opened.error.kind === "open-failed" && opened.error.message,
    ).toContain("版を確かめられませんでした");
  });

  it("開き直したときに版が新しくなかった（途中で変わった）場合も open-failed", async () => {
    const closed = vi.fn();
    const factory = scriptedFactory((request, call) => {
      if (call === 0) {
        failWith("VersionError")(request);
        return;
      }
      request.result = { version: SCHEMA_VERSION, close: closed };
      request.onsuccess?.();
    });
    const opened = await openStorage({ indexedDB: factory });
    expect(opened.ok === false && opened.error.kind).toBe("open-failed");
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it("版の更新の準備に失敗したら open-failed（理由つき）", async () => {
    const factory = scriptedFactory((request) => {
      request.onupgradeneeded?.({ oldVersion: 0 });
      failWith("AbortError")(request);
    });
    const opened = await openStorage({ indexedDB: factory });
    expect(
      opened.ok === false && opened.error.kind === "open-failed" && opened.error.message,
    ).toContain("保存領域を準備できませんでした");
  });
});

describe("openStorage: 妨げ（BR3.2）", () => {
  it("妨げで決めた時間を過ぎたら open-failed、遅れて開けた接続はすぐ閉じる", async () => {
    const closed = vi.fn();
    let lateSuccess: Promise<void> = Promise.resolve();
    const factory = scriptedFactory((request) => {
      request.onblocked?.();
      lateSuccess = new Promise((resolve) =>
        setTimeout(() => {
          request.result = { close: closed, onversionchange: null };
          request.onsuccess?.();
          resolve();
        }, 40),
      );
    });
    const opened = await openStorage({ indexedDB: factory, blockedTimeoutMs: 10 });
    expect(opened).toEqual({
      ok: false,
      error: { kind: "open-failed", message: MESSAGES.blocked },
    });
    await lateSuccess;
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it("妨げの後、時間内に開ければ使える", async () => {
    const factory = scriptedFactory((request) => {
      request.onblocked?.();
      request.onblocked?.();
      request.result = { close: vi.fn(), onversionchange: null };
      request.onsuccess?.();
    });
    const opened = await openStorage({ indexedDB: factory, blockedTimeoutMs: 1000 });
    expect(opened.ok).toBe(true);
  });
});

describe("openStorage: 利用不可（BR1.1、NFR7.1）", () => {
  it("IndexedDB がない環境では unavailable", async () => {
    expect(globalThis.indexedDB).toBeUndefined();
    expect(await openStorage()).toEqual({ ok: false, error: { kind: "unavailable" } });
  });

  it("開く要求自体が例外を投げると unavailable", async () => {
    const factory = {
      open: () => {
        throw new DOMException("架空の拒否", "SecurityError");
      },
    } as unknown as IDBFactory;
    expect(await openStorage({ indexedDB: factory })).toEqual({
      ok: false,
      error: { kind: "unavailable" },
    });
  });

  it.each(["SecurityError", "InvalidStateError"])(
    "開く要求が %s になると unavailable",
    async (name) => {
      const opened = await openStorage({ indexedDB: scriptedFactory(failWith(name)) });
      expect(opened).toEqual({ ok: false, error: { kind: "unavailable" } });
    },
  );

  it("それ以外の開く失敗は open-failed（理由つき）", async () => {
    const opened = await openStorage({
      indexedDB: scriptedFactory(failWith("UnknownError", "架空の故障")),
    });
    expect(opened).toEqual({
      ok: false,
      error: {
        kind: "open-failed",
        message: "保存領域を開けませんでした（UnknownError: 架空の故障）",
      },
    });
  });
});

describe("write: 保存の失敗（NFR4.4）", () => {
  it("容量超過で処理が取り消されると write-failed（容量超過の理由）で、何も書かれない", async () => {
    const handle = await openOk(newFactory(), uniqueDbName());
    const originalPut = originalPutMethod();
    vi.spyOn(FakeIDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey,
    ) {
      const request = originalPut.call(this, value, key);
      // 本物のブラウザで保存の確定時に容量が足りなかったときと同じく、処理を QuotaExceededError で取り消す。
      (this.transaction as unknown as { _abort(name: string): void })._abort("QuotaExceededError");
      return request;
    });
    const result = await handle.write(["categories"], async (tx) => {
      await tx.put("categories", fakeCategory());
      return { ok: true, value: undefined };
    });
    vi.restoreAllMocks();
    expect(result).toEqual({
      ok: false,
      error: { kind: "write-failed", message: MESSAGES.quotaExceeded },
    });
    const after = await handle.read(["categories"], (tx) => tx.getAll("categories"));
    expect(after).toEqual({ ok: true, value: [] });
    handle.close();
  });

  it("まとめて保存の2件目の要求が例外を投げると取り消し、1件目も残らない", async () => {
    const handle = await openOk(newFactory(), uniqueDbName());
    const originalPut = originalPutMethod();
    let calls = 0;
    vi.spyOn(FakeIDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey,
    ) {
      calls += 1;
      if (calls === 2) throw new DOMException("架空の容量超過", "QuotaExceededError");
      return originalPut.call(this, value, key);
    });
    const result = await handle.write(["transactions"], async (tx) => {
      await tx.put("transactions", fakeTransaction({ id: "tx-1" }));
      await tx.put("transactions", fakeTransaction({ id: "tx-2" }));
      return { ok: true, value: undefined };
    });
    vi.restoreAllMocks();
    expect(result).toEqual({
      ok: false,
      error: { kind: "write-failed", message: MESSAGES.quotaExceeded },
    });
    const after = await handle.read(["transactions"], (tx) => tx.getAll("transactions"));
    expect(after).toEqual({ ok: true, value: [] });
    handle.close();
  });

  it("容量超過以外の要求の失敗は write-failed（理由つき）", async () => {
    const handle = await openOk(newFactory(), uniqueDbName());
    vi.spyOn(FakeIDBObjectStore.prototype, "delete").mockImplementation(() => {
      throw new DOMException("架空の故障", "UnknownError");
    });
    const result = await handle.write(["categories"], async (tx) => {
      await tx.delete("categories", "cat-food");
      return { ok: true, value: undefined };
    });
    vi.restoreAllMocks();
    expect(result).toEqual({
      ok: false,
      error: {
        kind: "write-failed",
        message: "保存の要求に失敗しました（UnknownError: 架空の故障）",
      },
    });
    handle.close();
  });

  it("処理を開けない保存領域の名前は read-failed・write-failed", async () => {
    const handle = await openOk(newFactory(), uniqueDbName());
    const read = await handle.read([], () => Promise.resolve(0));
    const write = await handle.write([], () => Promise.resolve({ ok: true as const, value: 0 }));
    expect(read.ok === false && read.error.kind).toBe("read-failed");
    expect(write.ok === false && write.error.kind).toBe("write-failed");
    handle.close();
  });
});

describe("safeAbort", () => {
  it("確定済みの処理への取り消しは何もしない（例外を外に出さない）", async () => {
    const db = await openRaw(newFactory(), uniqueDbName(), 1, (created) => {
      created.createObjectStore("categories", { keyPath: "id" });
    });
    const tx = db.transaction("categories", "readonly");
    await new Promise((resolve) => tx.addEventListener("complete", resolve));
    expect(() => safeAbort(tx)).not.toThrow();
    expect(() => safeAbort(null)).not.toThrow();
    db.close();
  });
});
