// 変更の溜め場所と、読み取りへの重ね方（security-design.md 1.3 節）。本物（idbStorage）と差し替え（memoryStorage）で共用する。
// put・delete はその場で保存せず、ここに溜める。work が成功を返した後に、呼び出し側がまとめて保存する。
import {
  assertIndex,
  assertKey,
  compareKeys,
  indexValueOf,
  keyId,
  primaryKeyOf,
  type StoreKey,
  type StoredValue,
} from "./keys";
import type { StoreName, TxContext } from "./types";

interface Entry {
  key: StoreKey;
  value: StoredValue;
}

export type PendingOperation =
  | { type: "put"; store: StoreName; key: StoreKey; value: StoredValue }
  | { type: "delete"; store: StoreName; key: StoreKey };

export type TxMode = "readonly" | "readwrite";

const FINISHED_MESSAGE = "処理が終わった後の TxContext は使えません";

export class Pending {
  readonly mode: TxMode;
  private readonly stores: ReadonlySet<StoreName>;
  private readonly puts = new Map<StoreName, Map<string, Entry>>();
  private readonly deletes = new Map<StoreName, Map<string, StoreKey>>();
  private finishedMessage: string | undefined;

  constructor(stores: readonly StoreName[], mode: TxMode) {
    this.stores = new Set(stores);
    this.mode = mode;
  }

  /** 処理が終わった（または確定済みとみなした）ことを記録する。以後の操作は失敗する。 */
  finish(message: string = FINISHED_MESSAGE): void {
    this.finishedMessage ??= message;
  }

  get isFinished(): boolean {
    return this.finishedMessage !== undefined;
  }

  /** 終了後の操作・指定外の保存領域の操作は、溜めずにその場で失敗にする（BR2.3、BR2.4）。 */
  assertUsable(store: StoreName): void {
    if (this.finishedMessage !== undefined) {
      throw new Error(this.finishedMessage);
    }
    if (!this.stores.has(store)) {
      throw new Error(`指定していない保存領域 ${String(store)} は操作できません`);
    }
  }

  /** 受け取った時点で構造化複製して溜める。複製できない値はここで例外になる。 */
  put(store: StoreName, record: unknown): void {
    this.assertWritable(store);
    const value: unknown = structuredClone(record);
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error(`${store} に保存できるのはオブジェクトだけです`);
    }
    const stored = value as StoredValue;
    const key = primaryKeyOf(store, stored);
    const id = keyId(key);
    this.deletes.get(store)?.delete(id);
    mapFor(this.puts, store).set(id, { key, value: stored });
  }

  delete(store: StoreName, key: unknown): void {
    this.assertWritable(store);
    const checked = assertKey(store, key);
    const id = keyId(checked);
    this.puts.get(store)?.delete(id);
    mapFor(this.deletes, store).set(id, checked);
  }

  overlayGet(
    store: StoreName,
    key: StoreKey,
    base: StoredValue | undefined,
  ): StoredValue | undefined {
    const id = keyId(key);
    if (this.deletes.get(store)?.has(id)) return undefined;
    const put = this.puts.get(store)?.get(id);
    return put === undefined ? base : structuredClone(put.value);
  }

  overlayAll(store: StoreName, base: readonly StoredValue[]): StoredValue[] {
    return this.merge(store, base, () => true).sort((a, b) =>
      compareKeys(primaryKeyOf(store, a), primaryKeyOf(store, b)),
    );
  }

  /** getAll と同じ重ね方をして、索引の値が一致するものだけを「索引の値、次に主キー」の順で返す。 */
  overlayIndex(
    store: StoreName,
    index: string,
    value: string,
    base: readonly StoredValue[],
  ): StoredValue[] {
    assertIndex(store, index);
    const matches = (record: StoredValue) => indexValueOf(store, index, record) === value;
    return this.merge(store, base, matches).sort((a, b) => {
      const byIndex = compareKeys(
        String(indexValueOf(store, index, a)),
        String(indexValueOf(store, index, b)),
      );
      return byIndex !== 0 ? byIndex : compareKeys(primaryKeyOf(store, a), primaryKeyOf(store, b));
    });
  }

  /** まとめて保存するための操作の一覧（同じキーは最後の操作だけ）。 */
  operations(): PendingOperation[] {
    const result: PendingOperation[] = [];
    for (const [store, keys] of this.deletes) {
      for (const key of keys.values()) result.push({ type: "delete", store, key });
    }
    for (const [store, entries] of this.puts) {
      for (const entry of entries.values()) result.push({ type: "put", store, ...entry });
    }
    return result;
  }

  private assertWritable(store: StoreName): void {
    this.assertUsable(store);
    if (this.mode === "readonly") {
      throw new Error("読み取りの処理では書き込めません");
    }
  }

  private merge(
    store: StoreName,
    base: readonly StoredValue[],
    matches: (record: StoredValue) => boolean,
  ): StoredValue[] {
    const puts = this.puts.get(store);
    const deletes = this.deletes.get(store);
    const changed = (record: StoredValue) => {
      const id = keyId(primaryKeyOf(store, record));
      return puts?.has(id) === true || deletes?.has(id) === true;
    };
    const kept = base.filter((record) => !changed(record));
    const added = [...(puts?.values() ?? [])]
      .map((entry) => entry.value)
      .filter(matches)
      .map((record) => structuredClone(record));
    return [...kept, ...added];
  }
}

function mapFor<V>(maps: Map<StoreName, Map<string, V>>, store: StoreName): Map<string, V> {
  let map = maps.get(store);
  if (map === undefined) {
    map = new Map();
    maps.set(store, map);
  }
  return map;
}

/** 保存済みの値を読む部品。本物は IndexedDB から、差し替えはメモリから読む。返す値は呼び出しごとの写し。 */
export interface BaseReader {
  get(store: StoreName, key: StoreKey): Promise<StoredValue | undefined>;
  getAll(store: StoreName): Promise<StoredValue[]>;
  getAllByIndex(store: StoreName, index: string, value: string): Promise<StoredValue[]>;
}

/**
 * work に渡す TxContext を作る。保存済みの値に溜め場所の変更を重ねて返す。
 * 型の上の約束（RecordOf・KeyOf・索引の組み合わせ）は TxContext の型で呼び出し側に守らせ、
 * 中では値の形を実行時に確かめる。そのため、ここでは一度だけ型を TxContext に合わせる。
 */
export function createTxContext(pending: Pending, base: BaseReader): TxContext {
  const context = {
    async get(store: StoreName, key: unknown) {
      pending.assertUsable(store);
      const checked = assertKey(store, key);
      return pending.overlayGet(store, checked, await base.get(store, checked));
    },
    async getAll(store: StoreName) {
      pending.assertUsable(store);
      return pending.overlayAll(store, await base.getAll(store));
    },
    async getAllByIndex(store: StoreName, index: string, value: string) {
      pending.assertUsable(store);
      assertIndex(store, index);
      return pending.overlayIndex(
        store,
        index,
        value,
        await base.getAllByIndex(store, index, value),
      );
    },
    async count(store: StoreName, index: string, value: string) {
      return (await context.getAllByIndex(store, index, value)).length;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- 契約どおり Promise を返し、失敗は reject で伝える
    async put(store: StoreName, record: unknown) {
      pending.put(store, record);
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- 同上
    async delete(store: StoreName, key: unknown) {
      pending.delete(store, key);
    },
  };
  return context as unknown as TxContext;
}
