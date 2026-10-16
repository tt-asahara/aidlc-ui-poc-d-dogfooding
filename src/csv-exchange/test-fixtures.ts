// テスト用の架空データと Book の作り方（NFR8.4：実在の名前・口座・取引は使わない）。
// - Book は U4 の openBook に U3 の差し替え（createMemoryStorage）を渡して作る（NFR6.3、security-design.md 6.1 節）。
// - 書き込みの失敗は、途中から切り替えられる保存で起こす（プレビューの後の確定だけを失敗させるため）。
// - 偽のタイマーは使わない（U3 の差し替えが実際のタイマーで待ちを再現しているため）。
import type { Category, Result, TransactionInput } from "../data-contract";
import { openBook } from "../bookkeeping-core";
import type { Book, ImportRow } from "../bookkeeping-core";
import { createMemoryStorage } from "../storage";
import type { StorageError, StorageHandle, StoreName, TxContext, WriteError } from "../storage";

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

/** 途中から書き込み・読み取りを失敗させられる保存。失敗の値は U3 の差し替えの failWrites・failReads が返す。 */
export interface SwitchableStorage {
  open: () => Promise<Result<StorageHandle, never>>;
  failWrites: boolean;
  failReads: boolean;
}

async function memoryHandle(options: {
  failWrites?: boolean;
  failReads?: boolean;
  delayMs?: number;
}): Promise<StorageHandle> {
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
      healthy.close();
    },
  };
  const state: SwitchableStorage = {
    open: () => Promise.resolve({ ok: true, value: proxy }),
    failWrites: false,
    failReads: false,
  };
  return state;
}

/** 差し替えで開いた Book と、その保存。初回の架空の初期カテゴリ（支出7・収入3）が入っている。 */
export async function memoryBook(
  options: { delayMs?: number; idPrefix?: string } = {},
): Promise<{ book: Book; storage: SwitchableStorage }> {
  const storage = await switchableStorage({ delayMs: options.delayMs });
  const opened = await openBook({
    storage: storage.open,
    now: fixedNow(),
    newId: sequentialIds(options.idPrefix),
  });
  if (opened.status !== "ready") throw new Error(`家計簿を開けませんでした: ${opened.status}`);
  return { book: opened.book, storage };
}

/** 成功を前提に値を取り出す（失敗ならテストを失敗させる）。 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`失敗が返りました: ${JSON.stringify(result.error)}`);
  return result.value;
}

export async function categoriesOf(book: Book): Promise<Category[]> {
  return unwrap(await book.listCategories());
}

/** 種別と名前でカテゴリを引く（なければテストを失敗させる）。 */
export async function categoryNamed(book: Book, name: string): Promise<Category> {
  const found = (await categoriesOf(book)).find((c) => c.name === name);
  if (found === undefined) throw new Error(`カテゴリがありません: ${name}`);
  return found;
}

/** 架空の収支を1件追加する。 */
export async function addFakeTransaction(
  book: Book,
  input: Omit<TransactionInput, "categoryId"> & { categoryName: string },
): Promise<void> {
  const category = await categoryNamed(book, input.categoryName);
  unwrap(
    await book.addTransaction({
      date: input.date,
      type: input.type,
      categoryId: category.id,
      amount: input.amount,
      memo: input.memo,
    }),
  );
}

/** 見出し行と、各行の値（配列はカンマでつなぐ）から CSV の文字列を作る。改行は CRLF。 */
export function csvText(rows: readonly string[], options: { bom?: boolean } = {}): string {
  const body = ["date,type,category,amount,memo", ...rows].join("\r\n") + "\r\n";
  return (options.bom === true ? String.fromCharCode(0xfeff) : "") + body;
}

/** CSV の文字列から File を作る。 */
export function csvFile(text: string, name = "架空の家計簿.csv"): File {
  return new File([text], name, { type: "text/csv" });
}

/** バイト列から File を作る。 */
export function bytesFile(bytes: Uint8Array, name = "架空の家計簿.csv"): File {
  return new File([bytes.slice()], name, { type: "text/csv" });
}

/** arrayBuffer が reject する File（ファイルを読めない場合の再現）。arrayBuffer を呼んだ回数を数える。 */
export class RejectingFile extends File {
  arrayBufferCalls = 0;

  constructor(content = "date,type,category,amount,memo\r\n", name = "架空の読めない家計簿.csv") {
    super([content], name, { type: "text/csv" });
  }

  override arrayBuffer(): Promise<ArrayBuffer> {
    this.arrayBufferCalls += 1;
    return Promise.reject(new Error("架空の読み取りの失敗"));
  }
}

/** arrayBuffer を呼んだ回数を数える File（大きすぎるファイルの中身を読まないことの確認）。 */
export class CountingFile extends File {
  arrayBufferCalls = 0;

  override arrayBuffer(): Promise<ArrayBuffer> {
    this.arrayBufferCalls += 1;
    return super.arrayBuffer();
  }
}

/** Book の一部の操作を差し替えた Book（それ以外は元の Book に任せる）。 */
export function overrideBook(base: Book, overrides: Partial<Book>): Book {
  return new Proxy(base, {
    get(target, property, receiver) {
      if (
        typeof property === "string" &&
        Object.prototype.hasOwnProperty.call(overrides, property)
      ) {
        return overrides[property as keyof Book];
      }
      const value: unknown = Reflect.get(target, property, receiver);
      return typeof value === "function"
        ? (value as (...args: unknown[]) => unknown).bind(target)
        : value;
    },
  });
}

/** 指定した操作を呼ぶと例外を投げる Book（想定外の例外の変換の確認）。 */
export function throwingBook(base: Book, methods: readonly (keyof Book)[]): Book {
  const thrower = (): never => {
    throw new Error("架空の想定外の例外");
  };
  return overrideBook(base, Object.fromEntries(methods.map((m) => [m, thrower])));
}

/** 決まった規則で作った架空の取り込み行（乱数を使わない）。line は 2 から始まる。 */
export function fakeImportRows(count: number, categories: readonly Category[]): ImportRow[] {
  return Array.from({ length: count }, (_, i) => {
    const category = categories[i % categories.length] as Category;
    const month = String((i % 12) + 1).padStart(2, "0");
    return {
      line: i + 2,
      input: {
        date: `2026-${month}-${String((i % 28) + 1).padStart(2, "0")}`,
        type: category.type,
        categoryId: category.id,
        amount: 100 + (i % 50) * 10,
        memo: `架空の明細 ${i}`,
      },
    };
  });
}

/** 初期カテゴリ10件（支出7・収入3）に、架空のカテゴリを足して支出24・収入6にする。 */
export async function addCategoriesTo30(book: Book): Promise<Category[]> {
  for (let i = 1; i <= 17; i++) unwrap(await book.addCategory("expense", `架空の支出${i}`));
  for (let i = 1; i <= 3; i++) unwrap(await book.addCategory("income", `架空の収入${i}`));
  return categoriesOf(book);
}
