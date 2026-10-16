// 本物の保存（openStorage）。IndexedDB を開き、版を確かめ、read・write の窓口を返す（W1〜W3）。
// 書き込みは「まとめて保存」：put・delete は work の間は溜めるだけで、work が成功を返した後に続けて要求する
// （security-design.md 1章）。これにより、work が途中で失敗しても一部だけ保存されることはない。
import { SCHEMA_VERSION, toYearMonth, type Result } from "../data-contract";
import {
  classifyOpenError,
  describeError,
  MESSAGES,
  newerVersion,
  openFailed,
  readFailed,
  unavailable,
  writeFailed,
  writeFailedFrom,
} from "./errors";
import type { StoreKey, StoredValue } from "./keys";
import { createTxContext, Pending, type BaseReader, type PendingOperation } from "./pending";
import { DEFAULT_DB_NAME, upgradeSchema } from "./schema";
import type {
  OpenStorageOptions,
  StorageError,
  StorageHandle,
  StorageOpenError,
  StoreName,
  TxContext,
  WriteError,
} from "./types";

const DEFAULT_BLOCKED_TIMEOUT_MS = 5000;

type OpenOutcome = Result<IDBDatabase, StorageOpenError | { kind: "version" }>;

/** 保存領域を開く。失敗しても例外を投げず、種類を区別して返す（BR1.1、BR1.4、BR1.5、BR3.2）。 */
export async function openStorage(
  options: OpenStorageOptions = {},
): Promise<Result<StorageHandle, StorageOpenError>> {
  const factory = options.indexedDB ?? (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  if (factory === undefined || factory === null) return unavailable();
  const dbName = options.dbName ?? DEFAULT_DB_NAME;

  let request: IDBOpenDBRequest;
  try {
    request = factory.open(dbName, SCHEMA_VERSION);
  } catch {
    // 開く要求自体が例外になる環境は、利用を拒否された環境として扱う（BR1.1）。
    return unavailable();
  }
  const outcome = await waitForOpen(request, {
    now: options.now ?? (() => new Date()),
    blockedTimeoutMs: options.blockedTimeoutMs ?? DEFAULT_BLOCKED_TIMEOUT_MS,
  });
  if (outcome.ok) return { ok: true, value: new IdbStorageHandle(outcome.value) };
  if (outcome.error.kind === "version") return probeNewerVersion(factory, dbName);
  return { ok: false, error: outcome.error };
}

function waitForOpen(
  request: IDBOpenDBRequest,
  settings: { now: () => Date; blockedTimeoutMs: number },
): Promise<OpenOutcome> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let upgradeFailure: string | undefined;
    const settle = (outcome: OpenOutcome): boolean => {
      if (settled) return false;
      settled = true;
      clearTimeout(timer);
      resolve(outcome);
      return true;
    };

    request.onupgradeneeded = (event) => {
      const tx = request.transaction;
      try {
        if (tx === null) throw new Error("版の更新の処理を開けませんでした");
        upgradeSchema({
          db: request.result,
          tx,
          oldVersion: event.oldVersion,
          newVersion: SCHEMA_VERSION,
          now: settings.now,
        });
      } catch (error) {
        // 版の更新を取り消すと、開く要求は error になる。その時に open-failed として理由を返す（BR1.5）。
        upgradeFailure = `保存領域を準備できませんでした（${describeError(error)}）`;
        safeAbort(tx);
      }
    };
    request.onblocked = () => {
      // 古い接続が閉じるのを待つ。決めた時間を過ぎたら open-failed（BR3.2）。
      timer ??= setTimeout(() => settle(openFailed(MESSAGES.blocked)), settings.blockedTimeoutMs);
    };
    request.onsuccess = () => {
      const db = request.result;
      // 時間切れで open-failed を返した後に遅れて開けた接続は、使わずにすぐ閉じる。
      if (!settle({ ok: true, value: db })) db.close();
    };
    request.onerror = () => {
      const error = request.error;
      if (upgradeFailure !== undefined) {
        settle(openFailed(upgradeFailure));
        return;
      }
      const kind = classifyOpenError(error);
      if (kind === "newer-version") settle({ ok: false, error: { kind: "version" } });
      else if (kind === "unavailable") settle(unavailable());
      else settle(openFailed(`保存領域を開けませんでした（${describeError(error)}）`));
    };
  });
}

/**
 * 保存データの版がアプリより新しいとき、版を指定せずに開き直して版を読み、すぐ閉じる（データには触れない、BR1.4）。
 * 読めなければ found を推測せず open-failed にする。
 */
function probeNewerVersion(
  factory: IDBFactory,
  dbName: string,
): Promise<Result<never, StorageOpenError>> {
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(dbName);
    } catch (error) {
      resolve(openFailed(`保存データの版を確かめられませんでした（${describeError(error)}）`));
      return;
    }
    // データベースが消えていた場合に新しく作らないよう、版の更新は取り消す。
    request.onupgradeneeded = () => safeAbort(request.transaction);
    request.onsuccess = () => {
      const db = request.result;
      const found = db.version;
      db.close();
      if (found > SCHEMA_VERSION) {
        resolve({ ok: false, error: { kind: "newer-version", found, supported: SCHEMA_VERSION } });
      } else {
        resolve(openFailed("保存データの版が変わりました。もう一度開いてください"));
      }
    };
    request.onerror = () =>
      resolve(
        openFailed(`保存データの版を確かめられませんでした（${describeError(request.error)}）`),
      );
  });
}

/**
 * 安全な取り消し。確定済み・取り消し済みの処理への abort は例外になるが、取り消すものがないため何もしない。
 * この Unit で例外を握る唯一の箇所（security-design.md 1.2 節）。
 */
export function safeAbort(tx: IDBTransaction | null): void {
  if (tx === null) return;
  try {
    tx.abort();
  } catch {
    // 確定済み・取り消し済み：取り消すものはない。
  }
}

type TxOutcome = { type: "complete" } | { type: "abort"; error: DOMException | null };

interface TxWatch {
  /** complete・abort の知らせを受けたら true。 */
  finished: boolean;
  settled: Promise<TxOutcome>;
}

function watchTransaction(tx: IDBTransaction): TxWatch {
  const watch: TxWatch = { finished: false, settled: Promise.resolve({ type: "complete" }) };
  watch.settled = new Promise((resolve) => {
    tx.addEventListener("complete", () => {
      watch.finished = true;
      resolve({ type: "complete" });
    });
    tx.addEventListener("abort", () => {
      watch.finished = true;
      resolve({ type: "abort", error: tx.error });
    });
  });
  return watch;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("要求に失敗しました"));
  });
}

function toIdbKey(key: StoreKey): IDBValidKey {
  return typeof key === "string" ? key : [...key];
}

/** 収支には索引用の month（date の先頭7文字）を加えて保存する（BR1.3）。 */
function toStored(store: StoreName, value: StoredValue): StoredValue {
  if (store !== "transactions") return value;
  return { ...value, month: toYearMonth(String(value.date)) };
}

/** 読み出した収支から month を除き、C1 の Transaction の形にする（BR1.3）。 */
function fromStored(store: StoreName, value: unknown): StoredValue {
  const record = { ...(value as StoredValue) };
  if (store === "transactions") delete record.month;
  return record;
}

function idbReader(tx: IDBTransaction): BaseReader {
  return {
    async get(store, key) {
      const value: unknown = await requestResult(tx.objectStore(store).get(toIdbKey(key)));
      return value === undefined ? undefined : fromStored(store, value);
    },
    async getAll(store) {
      const values = await requestResult(tx.objectStore(store).getAll());
      return values.map((value) => fromStored(store, value));
    },
    async getAllByIndex(store, index, value) {
      const values = await requestResult(tx.objectStore(store).index(index).getAll(value));
      return values.map((record) => fromStored(store, record));
    },
  };
}

/** 溜めた変更を、待ちを挟まずに続けて要求する。要求の失敗は処理全体の取り消しになる。 */
function applyOperations(tx: IDBTransaction, operations: readonly PendingOperation[]): void {
  for (const operation of operations) {
    const store = tx.objectStore(operation.store);
    if (operation.type === "put") store.put(toStored(operation.store, operation.value));
    else store.delete(toIdbKey(operation.key));
  }
}

type HandleState = "open" | "closed-by-upgrade" | "closed";

class IdbStorageHandle implements StorageHandle {
  private state: HandleState = "open";
  private readonly db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.db = db;
    // 別のタブが版を上げようとしたら、すぐに接続を閉じ、以後の読み書きを newer-version にする（BR3.1）。
    db.onversionchange = () => {
      db.close();
      if (this.state === "open") this.state = "closed-by-upgrade";
    };
  }

  async read<T>(
    stores: readonly StoreName[],
    work: (tx: TxContext) => Promise<T>,
  ): Promise<Result<T, StorageError>> {
    if (this.state === "closed-by-upgrade") return newerVersion();
    if (this.state === "closed") return readFailed(MESSAGES.closed);
    let tx: IDBTransaction;
    try {
      tx = this.db.transaction([...stores], "readonly");
    } catch (error) {
      return readFailed(`読み取りを始められませんでした（${describeError(error)}）`);
    }
    const pending = new Pending(stores, "readonly");
    try {
      return { ok: true, value: await work(createTxContext(pending, idbReader(tx))) };
    } catch (error) {
      safeAbort(tx);
      return readFailed(`読み取りに失敗しました（${describeError(error)}）`);
    } finally {
      pending.finish();
    }
  }

  async write<T, E = unknown>(
    stores: readonly StoreName[],
    work: (tx: TxContext) => Promise<Result<T, E>>,
  ): Promise<Result<T, WriteError<E>>> {
    if (this.state === "closed-by-upgrade") return newerVersion();
    if (this.state === "closed") return writeFailed(MESSAGES.closed);
    let tx: IDBTransaction;
    try {
      tx = this.db.transaction([...stores], "readwrite");
    } catch (error) {
      return writeFailed(`書き込みを始められませんでした（${describeError(error)}）`);
    }
    const watch = watchTransaction(tx);
    const pending = new Pending(stores, "readwrite");

    let result: Result<T, E>;
    try {
      result = await work(createTxContext(pending, idbReader(tx)));
    } catch (error) {
      pending.finish();
      safeAbort(tx);
      await watch.settled;
      return writeFailedFrom(error, "書き込みの処理中に失敗しました");
    }
    pending.finish();

    if (!result.ok) {
      safeAbort(tx);
      await watch.settled;
      return { ok: false, error: { kind: "aborted", reason: result.error } };
    }
    // work の中で別の周回に進む待ちがあり、処理がすでに確定していた（自動確定）。まだ何も書いていない。
    if (watch.finished) return writeFailed(MESSAGES.autoCommitted);

    try {
      applyOperations(tx, pending.operations());
    } catch (error) {
      // 要求中の例外：処理がまだ有効なら取り消し、それまでの要求も残さない。
      safeAbort(tx);
      const outcome = await watch.settled;
      const cause = outcome.type === "abort" && outcome.error !== null ? outcome.error : error;
      return writeFailedFrom(cause, "保存の要求に失敗しました");
    }
    const outcome = await watch.settled;
    if (outcome.type === "complete") return { ok: true, value: result.value };
    return writeFailedFrom(outcome.error, "保存に失敗しました");
  }

  close(): void {
    if (this.state !== "closed") this.db.close();
    this.state = "closed";
  }
}
