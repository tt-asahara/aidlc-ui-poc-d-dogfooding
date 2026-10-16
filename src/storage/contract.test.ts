// 本物と差し替えに同じ契約テストを流す（BR5.2、ADR-004）。
// 本物は fake-indexeddb の新しい IDBFactory と、テストごとに別のデータベース名で開く。差し替えは毎回新しく作る。
import { runStorageContract } from "./contract";
import { openStorage } from "./idbStorage";
import { createMemoryStorage } from "./memoryStorage";
import { newFactory, uniqueDbName } from "./test-fixtures";

runStorageContract("本物（openStorage + fake-indexeddb）", () =>
  openStorage({ indexedDB: newFactory(), dbName: uniqueDbName() }),
);

runStorageContract("差し替え（createMemoryStorage）", () => createMemoryStorage());
