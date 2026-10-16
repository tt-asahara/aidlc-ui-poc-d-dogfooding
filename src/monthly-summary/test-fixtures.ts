// テスト用の架空データと Book の作り方（NFR8.2：実在の名前・口座・取引は使わない）。
// - 計算のテストは配列だけで行う（保存は使わない）。
// - 取得のテストは U4 の openBook に U3 の差し替え（createMemoryStorage）を渡した Book と、メソッドを差し替えた Book を使う。
// - 性能のテストだけ U3 の openStorage に fake-indexeddb を差し込む。偽のタイマーは使わない。
import { IDBFactory as FakeIDBFactory } from "fake-indexeddb";
import type { Category, Result, Transaction, TransactionInput, YearMonth } from "../data-contract";
import { openBook } from "../bookkeeping-core";
import type { Book, EffectiveBudget, OpenBookOptions } from "../bookkeeping-core";
import { createMemoryStorage, openStorage } from "../storage";
import type {
  MemoryStorageOptions,
  StorageError,
  StorageHandle,
  StoreName,
  TxContext,
  WriteError,
} from "../storage";

export const FIXED_NOW_ISO = "2026-10-16T01:02:03.000Z";

/** 固定の時計。 */
export function fixedNow(iso: string = FIXED_NOW_ISO): () => Date {
  return () => new Date(iso);
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

/** 予算を設定した月の予算（出所 set）。 */
export function fakeEffectiveBudget(overrides: Partial<EffectiveBudget> = {}): EffectiveBudget {
  return {
    categoryId: "cat-架空の食費",
    month: "2026-10",
    amount: 30000,
    source: { kind: "set" },
    ...overrides,
  };
}

/** 予算なしの行。 */
export function noBudget(categoryId: string, month: YearMonth = "2026-10"): EffectiveBudget {
  return { categoryId, month, amount: null, source: { kind: "none" } };
}

/** 支出3件・収入2件の架空のカテゴリ（支出の後に収入、それぞれ sortOrder 順）。 */
export const FOOD = fakeCategory();
export const TRANSPORT = fakeCategory({
  id: "cat-架空の交通費",
  name: "架空の交通費",
  sortOrder: 1,
});
export const HOBBY = fakeCategory({ id: "cat-架空の趣味", name: "架空の趣味", sortOrder: 2 });
export const SALARY = fakeCategory({
  id: "cat-架空の給与",
  type: "income",
  name: "架空の給与",
  sortOrder: 0,
});
export const SIDE_INCOME = fakeCategory({
  id: "cat-架空の副収入",
  type: "income",
  name: "架空の副収入",
  sortOrder: 1,
});
export const SAMPLE_CATEGORIES: Category[] = [FOOD, TRANSPORT, HOBBY, SALARY, SIDE_INCOME];

let transactionSequence = 0;

/** 収支1件（id は呼ぶたびに別の値）。 */
export function tx(
  category: Category,
  amount: number,
  date = "2026-10-05",
  overrides: Partial<Transaction> = {},
): Transaction {
  transactionSequence += 1;
  return fakeTransaction({
    id: `tx-${String(transactionSequence).padStart(6, "0")}`,
    date,
    type: category.type,
    categoryId: category.id,
    amount,
    ...overrides,
  });
}

/** 差し替えで開いた Book と、読み取りの失敗を途中から起こせる保存。 */
export interface TestBook {
  book: Book;
  /** true にすると以降の読み取りが storage の失敗になる（U3 の差し替えの failReads）。 */
  setFailReads: (value: boolean) => void;
}

async function memoryHandle(options: MemoryStorageOptions): Promise<StorageHandle> {
  const opened = await createMemoryStorage(options);
  if (!opened.ok) throw new Error(`差し替えを開けませんでした: ${opened.error.kind}`);
  return opened.value;
}

/**
 * U4 の openBook に U3 の差し替えを渡した Book を作る。開くときの初期化は正常に行い、その後に読み取りの失敗を切り替えられる。
 * delayMs は読み取り・書き込みごとの待ち時間（読み込み中の再現）。
 */
export async function memoryBook(options: { delayMs?: number } = {}): Promise<TestBook> {
  const healthy = await memoryHandle(options);
  const failing = await memoryHandle({ failReads: true });
  let failReads = false;
  const proxy: StorageHandle = {
    read<T>(
      stores: readonly StoreName[],
      work: (txContext: TxContext) => Promise<T>,
    ): Promise<Result<T, StorageError>> {
      return (failReads ? failing : healthy).read(stores, work);
    },
    write<T, E>(
      stores: readonly StoreName[],
      work: (txContext: TxContext) => Promise<Result<T, E>>,
    ): Promise<Result<T, WriteError<E>>> {
      return healthy.write(stores, work);
    },
    close() {
      healthy.close();
    },
  };
  const opened = await openBook({
    storage: () => Promise.resolve({ ok: true, value: proxy }),
    now: fixedNow(),
    newId: sequentialIds(),
  });
  if (opened.status !== "ready") throw new Error(`家計簿を開けませんでした: ${opened.status}`);
  return {
    book: opened.book,
    setFailReads: (value: boolean) => {
      failReads = value;
    },
  };
}

/** 収支の入力（架空）。 */
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

/** 一部のメソッドだけ差し替えた Book（食い違い・例外の再現）。ほかのメソッドは元の Book に任せる。 */
export function stubbedBook(base: Book, overrides: Partial<Book>): Book {
  return new Proxy(base, {
    get(target, property, receiver) {
      const override = (overrides as Record<PropertyKey, unknown>)[property];
      if (override !== undefined) return override;
      const value: unknown = Reflect.get(target, property, receiver);
      return typeof value === "function"
        ? (value as (...a: unknown[]) => unknown).bind(target)
        : value;
    },
  });
}

let dbSequence = 0;

/** テストごとに別のデータベース名を返す（テスト間でデータを共有しない）。 */
export function uniqueDbName(): string {
  dbSequence += 1;
  return `架空の家計簿-u5-${dbSequence}`;
}

/** テストごとに新しい fake-indexeddb を用意する。 */
export function newFactory(): IDBFactory {
  return new FakeIDBFactory();
}

/** 同じ IDBFactory と dbName を開く関数（性能のテスト用）。 */
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
