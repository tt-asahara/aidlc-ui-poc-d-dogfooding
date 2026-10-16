// 保存領域の定義と版ごとの移行のテスト（BR1.2、BR1.5）。fake-indexeddb の上で版の更新を直接起こす。
import { describe, expect, it } from "vitest";
import { MIGRATIONS, STORE_DEFS, STORE_NAMES, upgradeSchema, type Migration } from "./schema";
import type { MetaRecord } from "./types";
import { newFactory, uniqueDbName } from "./test-fixtures";

const FIXED_NOW = () => new Date("2026-04-01T00:00:00.000Z");
const LATER_NOW = () => new Date("2026-09-01T00:00:00.000Z");

/** 版 version で開き、版の更新があれば upgradeSchema を呼ぶ。失敗は reject。 */
function openWith(
  factory: IDBFactory,
  name: string,
  version: number,
  migrations: Readonly<Record<number, Migration>>,
  now: () => Date,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, version);
    request.onupgradeneeded = (event) => {
      const tx = request.transaction;
      if (tx === null) throw new Error("版の更新の処理がありません");
      try {
        upgradeSchema({
          db: request.result,
          tx,
          oldVersion: event.oldVersion,
          newVersion: version,
          now,
          migrations,
        });
      } catch (error) {
        tx.abort();
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("開けませんでした"));
  });
}

function readMeta(db: IDBDatabase): Promise<MetaRecord | undefined> {
  return new Promise((resolve, reject) => {
    const request = db.transaction("meta", "readonly").objectStore("meta").get("schema");
    request.onsuccess = () => resolve(request.result as MetaRecord | undefined);
    request.onerror = () => reject(request.error ?? new Error("読めませんでした"));
  });
}

describe("upgradeSchema", () => {
  it("初版の作成で4つの保存領域・3つの索引・メタ情報ができる", async () => {
    const db = await openWith(newFactory(), uniqueDbName(), 1, MIGRATIONS, FIXED_NOW);
    expect([...db.objectStoreNames].sort()).toEqual([...STORE_NAMES].sort());
    const tx = db.transaction([...STORE_NAMES], "readonly");
    expect([...tx.objectStore("transactions").indexNames].sort()).toEqual([
      "byCategory",
      "byMonth",
    ]);
    expect([...tx.objectStore("budgets").indexNames]).toEqual(["byCategory"]);
    expect(tx.objectStore("budgets").keyPath).toEqual(STORE_DEFS.budgets.keyPath);
    expect(await readMeta(db)).toEqual({
      key: "schema",
      schemaVersion: 1,
      initializedAt: "2026-04-01T00:00:00.000Z",
    });
    db.close();
  });

  it("古い版からは版ごとの移行を順に適用し、初期化日時を残して版だけを上げる", async () => {
    const factory = newFactory();
    const name = uniqueDbName();
    (await openWith(factory, name, 1, MIGRATIONS, FIXED_NOW)).close();
    const applied: number[] = [];
    const migrations: Record<number, Migration> = {
      ...MIGRATIONS,
      2: () => applied.push(2),
      3: () => applied.push(3),
    };
    const db = await openWith(factory, name, 3, migrations, LATER_NOW);
    expect(applied).toEqual([2, 3]);
    expect(await readMeta(db)).toEqual({
      key: "schema",
      schemaVersion: 3,
      initializedAt: "2026-04-01T00:00:00.000Z",
    });
    db.close();
  });

  it("移行が定義されていない版があれば例外になり、版の更新は取り消される", async () => {
    const factory = newFactory();
    const name = uniqueDbName();
    (await openWith(factory, name, 1, MIGRATIONS, FIXED_NOW)).close();
    await expect(openWith(factory, name, 2, MIGRATIONS, LATER_NOW)).rejects.toThrow(
      "版 2 への移行が定義されていません",
    );
    const db = await openWith(factory, name, 1, MIGRATIONS, LATER_NOW);
    expect(db.version).toBe(1);
    db.close();
  });
});
