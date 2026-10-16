// テスト用の架空データと Book の作り方（NFR8.2：実在の名前・口座・取引は使わない）。
// - 主なテストは U3 の差し替え（createMemoryStorage）で行う。
// - 別のタブ・版上げ・性能のテストは U3 の openStorage に fake-indexeddb を差し込む。
// - 偽のタイマーは使わない（U3 の差し替えの自動確定の再現が実際のタイマーに依存するため）。
import { IDBFactory as FakeIDBFactory } from "fake-indexeddb";
import type { Budget, Category, Transaction, TransactionInput } from "../data-contract";
import { createMemoryStorage, openStorage } from "../storage";
import type {
  MemoryStorageOptions,
  StorageError,
  StorageHandle,
  StoreName,
  TxContext,
  WriteError,
} from "../storage";
import type { Result } from "../data-contract";
import type { Book, OpenBookOptions } from "./types";

export const FIXED_NOW_ISO = "2026-10-16T01:02:03.000Z";

/** 固定の時計。 */
export function fixedNow(iso: string = FIXED_NOW_ISO): () => Date {
  return () => new Date(iso);
}

/** 呼ぶたびに1秒進む時計（登録日時の並びを確かめる）。 */
export function steppingNow(startIso: string = FIXED_NOW_ISO): () => Date {
  let current = new Date(startIso).getTime();
  return () => {
    const value = new Date(current);
    current += 1000;
    return value;
  };
}

/** 決まった順の id（id-0001、id-0002、…）。 */
export function sequentialIds(prefix = "id-"): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `${prefix}${String(n).padStart(4, "0")}`;
  };
}

export function fakeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: "cat-架空の食費",
    type: "expense",
    name: "架空の食費",
    sortOrder: 0,
    createdAt: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

export function fakeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx-0001",
    date: "2026-10-05",
    type: "expense",
    categoryId: "cat-架空の食費",
    amount: 1200,
    memo: "架空のランチ",
    createdAt: "2026-10-05T03:00:00.000Z",
    updatedAt: "2026-10-05T03:00:00.000Z",
    ...overrides,
  };
}

export function fakeBudget(overrides: Partial<Budget> = {}): Budget {
  return {
    categoryId: "cat-架空の食費",
    month: "2026-10",
    amount: 30000,
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

export function fakeInput(overrides: Partial<TransactionInput> = {}): TransactionInput {
  return {
    date: "2026-10-05",
    type: "expense",
    categoryId: "cat-架空の食費",
    amount: "1200",
    memo: "架空のランチ",
    ...overrides,
  };
}

/** 書き込み・読み取りの失敗を途中から起こせる保存。失敗の値は U3 の差し替えの failWrites・failReads が返す。 */
export interface SwitchableStorage {
  /** 正常な保存（保存領域の中身を確かめるのに使う）。 */
  readonly handle: StorageHandle;
  /** openBook の storage 引数に渡す関数。 */
  open: () => Promise<Result<StorageHandle, never>>;
  failWrites: boolean;
  failReads: boolean;
  /** close が呼ばれた回数。 */
  readonly closeCount: number;
}

async function memoryHandle(options: MemoryStorageOptions = {}): Promise<StorageHandle> {
  const opened = await createMemoryStorage(options);
  if (!opened.ok) throw new Error(`差し替えを開けませんでした: ${opened.error.kind}`);
  return opened.value;
}

export async function switchableStorage(
  options: { delayMs?: number } = {},
): Promise<SwitchableStorage> {
  const healthy = await memoryHandle(options);
  const failingWrites = await memoryHandle({ failWrites: true });
  const failingReads = await memoryHandle({ failReads: true });
  let closeCount = 0;
  const proxy: StorageHandle = {
    read<T>(
      stores: readonly StoreName[],
      work: (tx: TxContext) => Promise<T>,
    ): Promise<Result<T, StorageError>> {
      return (state.failReads ? failingReads : healthy).read(stores, work);
    },
    write<T, E>(
      stores: readonly StoreName[],
      work: (tx: TxContext) => Promise<Result<T, E>>,
    ): Promise<Result<T, WriteError<E>>> {
      return (state.failWrites ? failingWrites : healthy).write(stores, work);
    },
    close() {
      closeCount += 1;
      healthy.close();
    },
  };
  const state: SwitchableStorage = {
    handle: healthy,
    open: () => Promise.resolve({ ok: true, value: proxy }),
    failWrites: false,
    failReads: false,
    get closeCount() {
      return closeCount;
    },
  };
  return state;
}

/** 開けた Book を返す（開けなければテストを失敗させる）。 */
export async function readyBook(options: OpenBookOptions): Promise<Book> {
  // 部品（持ち主）だけのテストが book.ts を読み込まずに済むよう、使うときに読み込む。
  const { openBook } = await import("./book");
  const opened = await openBook(options);
  if (opened.status !== "ready") throw new Error(`家計簿を開けませんでした: ${opened.status}`);
  return opened.book;
}

/** 差し替えで開いた Book と、その保存。 */
export async function memoryBook(
  options: Omit<OpenBookOptions, "storage"> = {},
): Promise<{ book: Book; storage: SwitchableStorage }> {
  const storage = await switchableStorage();
  const book = await readyBook({
    now: fixedNow(),
    newId: sequentialIds(),
    ...options,
    storage: storage.open,
  });
  return { book, storage };
}

/** 保存領域の中身（収支・カテゴリ・予算）をそのまま読む。失敗の後に何も変わらないことを確かめる。 */
export async function dumpStores(
  handle: StorageHandle,
): Promise<{ transactions: Transaction[]; categories: Category[]; budgets: Budget[] }> {
  const result = await handle.read(["transactions", "categories", "budgets"], async (tx) => ({
    transactions: await tx.getAll("transactions"),
    categories: await tx.getAll("categories"),
    budgets: await tx.getAll("budgets"),
  }));
  if (!result.ok) throw new Error(`保存領域を読めませんでした: ${result.error.kind}`);
  return result.value;
}

let dbSequence = 0;

/** テストごとに別のデータベース名を返す（テスト間でデータを共有しない）。 */
export function uniqueDbName(): string {
  dbSequence += 1;
  return `架空の家計簿-u4-${dbSequence}`;
}

/** テストごとに新しい fake-indexeddb を用意する。 */
export function newFactory(): IDBFactory {
  return new FakeIDBFactory();
}

/** 同じ IDBFactory と dbName を開く関数（別のタブの再現では、2つの openBook にこれを渡す）。 */
export function idbOpener(
  factory: IDBFactory,
  dbName: string,
): NonNullable<OpenBookOptions["storage"]> {
  return () => openStorage({ indexedDB: factory, dbName });
}

/** 月の一覧（例: monthsOf(2026, 12) → 2026-01〜2026-12）。 */
export function monthsOf(year: number, count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const y = year + Math.floor(i / 12);
    return `${y}-${String((i % 12) + 1).padStart(2, "0")}`;
  });
}
