// キーの比較と取り出し。IndexedDB のキーの比較と同じ意味にする（この Unit が使うキーは文字列と文字列の配列だけ）。
// - 文字列どうしは UTF-16 の符号単位で比べる。
// - 配列は文字列より大きい。配列どうしは要素ごとに比べ、すべて等しければ短い方が小さい。
import type { StoreName } from "./types";

export type StoreKey = string | readonly string[];

/** 保存する値の内部での形（構造化複製できる普通のオブジェクト）。 */
export type StoredValue = Readonly<Record<string, unknown>>;

export function compareKeys(a: StoreKey, b: StoreKey): number {
  if (typeof a === "string" && typeof b === "string") {
    return compareStrings(a, b);
  }
  if (typeof a === "string") return -1;
  if (typeof b === "string") return 1;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const order = compareStrings(a[i] as string, b[i] as string);
    if (order !== 0) return order;
  }
  return a.length - b.length;
}

function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** 溜め場所の Map で使う、キーを一意に表す文字列（文字列と配列を区別する）。 */
export function keyId(key: StoreKey): string {
  return JSON.stringify(key);
}

/** 呼び出し元から来たキーが、その保存領域のキーの形かを確かめる（違えば例外）。 */
export function assertKey(store: StoreName, key: unknown): StoreKey {
  if (store === "budgets") {
    if (
      Array.isArray(key) &&
      key.length === 2 &&
      key.every((part): part is string => typeof part === "string")
    ) {
      return key;
    }
    throw new Error("budgets のキーは [categoryId, month] の文字列の組です");
  }
  if (typeof key === "string") return key;
  throw new Error(`${store} のキーは文字列です`);
}

/** 保存する値から主キーを取り出す（キーがなければ例外）。 */
export function primaryKeyOf(store: StoreName, value: StoredValue): StoreKey {
  switch (store) {
    case "transactions":
    case "categories":
      return assertKey(store, value.id);
    case "budgets":
      return assertKey(store, [value.categoryId, value.month]);
    case "meta":
      return assertKey(store, value.key);
  }
}

/** 定義にある索引かを確かめる（なければ例外）。 */
export function assertIndex(store: StoreName, index: string): void {
  const known =
    (store === "transactions" && (index === "byMonth" || index === "byCategory")) ||
    (store === "budgets" && index === "byCategory");
  if (!known) {
    throw new Error(`保存領域 ${store} に索引 ${index} はありません`);
  }
}

/** 索引の値を取り出す。byMonth は date の先頭7文字（BR1.3）。定義にない索引は例外。 */
export function indexValueOf(store: StoreName, index: string, value: StoredValue): unknown {
  assertIndex(store, index);
  if (index === "byMonth") {
    return typeof value.date === "string" ? value.date.slice(0, 7) : undefined;
  }
  return value.categoryId;
}
