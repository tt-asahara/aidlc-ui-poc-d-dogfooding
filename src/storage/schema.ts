// 保存領域・索引・メタ情報の定義と、版ごとの移行（BR1.2、BR1.3、BR1.5）。
import type { MetaRecord, StoreName } from "./types";

export const DEFAULT_DB_NAME = "budget-webapp";
export const META_KEY = "schema";
export const STORE_NAMES: readonly StoreName[] = ["transactions", "categories", "budgets", "meta"];

export interface IndexDef {
  name: string;
  keyPath: string;
}

export interface StoreDef {
  keyPath: string | string[];
  indexes: readonly IndexDef[];
}

/** entities.md の ObjectStore の instances。transactions の month は date の先頭7文字（BR1.3）。 */
export const STORE_DEFS: Readonly<Record<StoreName, StoreDef>> = {
  transactions: {
    keyPath: "id",
    indexes: [
      { name: "byMonth", keyPath: "month" },
      { name: "byCategory", keyPath: "categoryId" },
    ],
  },
  categories: { keyPath: "id", indexes: [] },
  budgets: {
    keyPath: ["categoryId", "month"],
    indexes: [{ name: "byCategory", keyPath: "categoryId" }],
  },
  meta: { keyPath: "key", indexes: [] },
};

/** 版 n へ上げる移行（キーは移行後の版）。版の更新の処理の中で同期的に要求を出す。 */
export type Migration = (db: IDBDatabase, tx: IDBTransaction) => void;

function createInitialStores(db: IDBDatabase): void {
  for (const name of STORE_NAMES) {
    const def = STORE_DEFS[name];
    const store = db.createObjectStore(name, { keyPath: def.keyPath });
    for (const index of def.indexes) {
      store.createIndex(index.name, index.keyPath);
    }
  }
}

/** 初版（1）は作成だけで、移行はない。版を上げるときはここに n: 移行関数 を足す。 */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  1: (db) => createInitialStores(db),
};

export interface UpgradeParams {
  db: IDBDatabase;
  tx: IDBTransaction;
  oldVersion: number;
  newVersion: number;
  now: () => Date;
  migrations?: Readonly<Record<number, Migration>>;
}

/**
 * 版 oldVersion から newVersion へ、版ごとの移行を順に適用し、meta を書く。
 * 移行がない版があれば例外を投げる（呼び出し側が処理を取り消し、open-failed にする）。
 */
export function upgradeSchema(params: UpgradeParams): void {
  const { db, tx, oldVersion, newVersion, now } = params;
  const migrations = params.migrations ?? MIGRATIONS;
  for (let version = oldVersion + 1; version <= newVersion; version++) {
    const migrate = migrations[version];
    if (migrate === undefined) {
      throw new Error(`版 ${version} への移行が定義されていません`);
    }
    migrate(db, tx);
  }
  const metaStore = tx.objectStore("meta");
  if (oldVersion === 0) {
    const meta: MetaRecord = {
      key: META_KEY,
      schemaVersion: newVersion,
      initializedAt: now().toISOString(),
    };
    metaStore.put(meta);
    return;
  }
  // 既存の初期化日時は残し、版だけを上げる。
  const request = metaStore.get(META_KEY);
  request.onsuccess = () => {
    const current = request.result as MetaRecord | undefined;
    const initializedAt = current?.initializedAt ?? now().toISOString();
    metaStore.put({ key: META_KEY, schemaVersion: newVersion, initializedAt });
  };
}
