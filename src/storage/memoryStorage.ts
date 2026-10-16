// テスト用の差し替え（createMemoryStorage）。本物と同じ窓口と規則を、メモリ上の保存領域で守る（BR5.1）。
// - 溜め場所と重ね方の部品（pending.ts）を本物と共用する。
// - work が成功したら、溜めた変更を保存領域の写しに当ててから入れ替える（途中で失敗しても元のまま）。
// - 読み書きは1つずつ順に処理する（本物の IndexedDB で同じ保存領域の処理が順に進むのと合わせる）。
// - 本物の自動確定を再現する：work の実行中に別の周回（タイマー）に進んだら処理を確定済みとみなし、
//   その後の TxContext の操作とまとめて保存を失敗にする（何も書かれない）。
import { SCHEMA_VERSION, type Result } from "../data-contract";
import { MESSAGES, readFailed, writeFailed, writeFailedFrom, describeError } from "./errors";
import { compareKeys, indexValueOf, keyId, primaryKeyOf, type StoredValue } from "./keys";
import { createTxContext, Pending, type BaseReader, type PendingOperation } from "./pending";
import { META_KEY, STORE_NAMES } from "./schema";
import type {
  MemoryStorageOptions,
  MetaRecord,
  StorageError,
  StorageHandle,
  StorageOpenError,
  StoreName,
  TxContext,
  WriteError,
} from "./types";

type Table = ReadonlyMap<string, StoredValue>;
type Tables = ReadonlyMap<StoreName, Table>;

export async function createMemoryStorage(
  options: MemoryStorageOptions = {},
): Promise<Result<StorageHandle, StorageOpenError>> {
  const delayMs = Math.max(0, options.delayMs ?? 0);
  await wait(delayMs);
  if (options.failOpen !== undefined) return { ok: false, error: { ...options.failOpen } };
  return {
    ok: true,
    value: new MemoryStorageHandle({
      failReads: options.failReads === true,
      failWrites: options.failWrites === true,
      delayMs,
    }),
  };
}

function wait(ms: number): Promise<void> {
  if (ms === 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createTables(): Tables {
  const meta: MetaRecord = {
    key: META_KEY,
    schemaVersion: SCHEMA_VERSION,
    initializedAt: new Date().toISOString(),
  };
  const tables = new Map<StoreName, Table>(STORE_NAMES.map((name) => [name, new Map()]));
  tables.set("meta", new Map([[keyId(META_KEY), { ...meta }]]));
  return tables;
}

function sortByKey(store: StoreName, values: StoredValue[]): StoredValue[] {
  return values.sort((a, b) => compareKeys(primaryKeyOf(store, a), primaryKeyOf(store, b)));
}

/** 呼び出しごとに写しを返す（呼び出し側が書き換えても保存領域は変わらない）。 */
function memoryReader(tables: Tables): BaseReader {
  const table = (store: StoreName): Table => tables.get(store) ?? new Map();
  return {
    get: (store, key) => {
      const value = table(store).get(keyId(key));
      return Promise.resolve(value === undefined ? undefined : structuredClone(value));
    },
    getAll: (store) =>
      Promise.resolve(
        sortByKey(
          store,
          [...table(store).values()].map((v) => structuredClone(v)),
        ),
      ),
    getAllByIndex: (store, index, value) =>
      Promise.resolve(
        sortByKey(
          store,
          [...table(store).values()]
            .filter((record) => indexValueOf(store, index, record) === value)
            .map((record) => structuredClone(record)),
        ),
      ),
  };
}

/** 溜めた変更を保存領域の写しに当てる（元の保存領域は変えない）。 */
function applyOperations(tables: Tables, operations: readonly PendingOperation[]): Tables {
  const next = new Map(tables);
  const copies = new Map<StoreName, Map<string, StoredValue>>();
  for (const operation of operations) {
    let table = copies.get(operation.store);
    if (table === undefined) {
      table = new Map(tables.get(operation.store));
      copies.set(operation.store, table);
      next.set(operation.store, table);
    }
    const id = keyId(operation.key);
    if (operation.type === "put") table.set(id, operation.value);
    else table.delete(id);
  }
  return next;
}

interface MemorySettings {
  failReads: boolean;
  failWrites: boolean;
  delayMs: number;
}

/** work の実行中に別の周回に進んだら、処理を確定済みとみなす（本物の自動確定と同じ結果にする）。 */
function startAutoCommitWatch(pending: Pending): { readonly expired: boolean; stop(): void } {
  const watch = { expired: false, stop: () => clearTimeout(timer) };
  const timer = setTimeout(() => {
    watch.expired = true;
    pending.finish(MESSAGES.autoCommitted);
  }, 0);
  return watch;
}

class MemoryStorageHandle implements StorageHandle {
  private tables: Tables = createTables();
  private closed = false;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly settings: MemorySettings;

  constructor(settings: MemorySettings) {
    this.settings = settings;
  }

  async read<T>(
    stores: readonly StoreName[],
    work: (tx: TxContext) => Promise<T>,
  ): Promise<Result<T, StorageError>> {
    await wait(this.settings.delayMs);
    return this.enqueue(() => this.runRead(stores, work));
  }

  async write<T, E = unknown>(
    stores: readonly StoreName[],
    work: (tx: TxContext) => Promise<Result<T, E>>,
  ): Promise<Result<T, WriteError<E>>> {
    await wait(this.settings.delayMs);
    return this.enqueue(() => this.runWrite(stores, work));
  }

  close(): void {
    this.closed = true;
  }

  /** 読み書きを1つずつ順に処理する。各処理は Result を返し、reject しない。 */
  private enqueue<R>(task: () => Promise<R>): Promise<R> {
    const run = this.queue.then(task);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async runRead<T>(
    stores: readonly StoreName[],
    work: (tx: TxContext) => Promise<T>,
  ): Promise<Result<T, StorageError>> {
    if (this.closed) return readFailed(MESSAGES.closed);
    if (this.settings.failReads) return readFailed("読み取りに失敗しました（failReads の指定）");
    const pending = new Pending(stores, "readonly");
    const watch = startAutoCommitWatch(pending);
    try {
      return { ok: true, value: await work(createTxContext(pending, memoryReader(this.tables))) };
    } catch (error) {
      return readFailed(`読み取りに失敗しました（${describeError(error)}）`);
    } finally {
      watch.stop();
      pending.finish();
    }
  }

  private async runWrite<T, E>(
    stores: readonly StoreName[],
    work: (tx: TxContext) => Promise<Result<T, E>>,
  ): Promise<Result<T, WriteError<E>>> {
    if (this.closed) return writeFailed(MESSAGES.closed);
    if (this.settings.failWrites) return writeFailed("保存に失敗しました（failWrites の指定）");
    const pending = new Pending(stores, "readwrite");
    const watch = startAutoCommitWatch(pending);
    let result: Result<T, E>;
    try {
      result = await work(createTxContext(pending, memoryReader(this.tables)));
    } catch (error) {
      return writeFailedFrom(error, "書き込みの処理中に失敗しました");
    } finally {
      watch.stop();
      pending.finish();
    }
    if (!result.ok) return { ok: false, error: { kind: "aborted", reason: result.error } };
    if (watch.expired) return writeFailed(MESSAGES.autoCommitted);
    this.tables = applyOperations(this.tables, pending.operations());
    return { ok: true, value: result.value };
  }
}
