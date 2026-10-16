// 契約 C2（保存）の型。contract-summary.md の C2 と一致させる。
import type { Budget, Category, Result, Transaction } from "../data-contract";

export type StoreName = "transactions" | "categories" | "budgets" | "meta";

/** 保存領域の版と初期化の記録（key は常に "schema"）。持ち主は U3。 */
export interface MetaRecord {
  key: string;
  schemaVersion: number;
  /** ISO 8601（オフセット付き） */
  initializedAt: string;
}

export type RecordOf<S extends StoreName> = S extends "transactions"
  ? Transaction
  : S extends "categories"
    ? Category
    : S extends "budgets"
      ? Budget
      : MetaRecord;

/** budgets は [categoryId, month]、それ以外は文字列のキー。 */
export type KeyOf<S extends StoreName> = S extends "budgets" ? [string, string] : string;

export type StorageOpenError =
  | { kind: "unavailable" }
  | { kind: "newer-version"; found: number; supported: number }
  | { kind: "open-failed"; message: string };

export type StorageError =
  | { kind: "read-failed"; message: string }
  | { kind: "write-failed"; message: string }
  | { kind: "newer-version" };

/** write が返す失敗。work の { ok: false } は aborted.reason としてそのまま返す。 */
export type WriteError<E> = StorageError | { kind: "aborted"; reason: E };

/**
 * 1回の読み取り・書き込みの処理の中だけで使える操作。
 * 書き込みでは put・delete はその場で保存せず、work が成功を返した後にまとめて保存する。
 * work の中で TxContext 以外（タイマーなど、別の周回に進む待ち）を待つと、その write は write-failed になる。
 */
export interface TxContext {
  getAll<S extends StoreName>(store: S): Promise<RecordOf<S>[]>;
  get<S extends StoreName>(store: S, key: KeyOf<S>): Promise<RecordOf<S> | undefined>;
  getAllByIndex(
    store: "transactions",
    index: "byMonth" | "byCategory",
    value: string,
  ): Promise<Transaction[]>;
  getAllByIndex(store: "budgets", index: "byCategory", value: string): Promise<Budget[]>;
  count(store: "transactions", index: "byCategory", value: string): Promise<number>;
  put<S extends StoreName>(store: S, record: RecordOf<S>): Promise<void>;
  delete<S extends StoreName>(store: S, key: KeyOf<S>): Promise<void>;
}

export interface StorageHandle {
  read<T>(
    stores: readonly StoreName[],
    work: (tx: TxContext) => Promise<T>,
  ): Promise<Result<T, StorageError>>;
  write<T, E = unknown>(
    stores: readonly StoreName[],
    work: (tx: TxContext) => Promise<Result<T, E>>,
  ): Promise<Result<T, WriteError<E>>>;
  close(): void;
}

export interface OpenStorageOptions {
  /** 既定 "budget-webapp"。テストではテストごとに別名にする。 */
  dbName?: string;
  /** 既定 globalThis.indexedDB。 */
  indexedDB?: IDBFactory;
  /** 初期化日時に使う時計。既定は実際の時計。 */
  now?: () => Date;
  /** 版の更新が妨げられたときに待つ時間（ミリ秒）。既定 5000。 */
  blockedTimeoutMs?: number;
}

export interface MemoryStorageOptions {
  failOpen?: StorageOpenError;
  failReads?: boolean;
  failWrites?: boolean;
  /** openStorage・read・write の各呼び出しの前に待つ時間（ミリ秒）。既定 0。 */
  delayMs?: number;
}
