// テスト用の架空データと、IndexedDB の差し込み（NFR8.2：実在の名前・口座・取引は使わない）。
import { IDBFactory as FakeIDBFactory } from "fake-indexeddb";
import type { Budget, Category, Transaction } from "../data-contract";

let sequence = 0;

/** テストごとに別のデータベース名を返す（テスト間でデータを共有しない）。 */
export function uniqueDbName(): string {
  sequence += 1;
  return `架空の家計簿-${sequence}`;
}

/** テストごとに新しい fake-indexeddb を用意する。 */
export function newFactory(): IDBFactory {
  return new FakeIDBFactory();
}

export function fakeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx-001",
    date: "2026-04-15",
    type: "expense",
    categoryId: "cat-food",
    amount: 1200,
    memo: "架空のランチ",
    createdAt: "2026-04-15T12:00:00+09:00",
    updatedAt: "2026-04-15T12:00:00+09:00",
    ...overrides,
  };
}

export function fakeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: "cat-food",
    type: "expense",
    name: "架空の食費",
    sortOrder: 1,
    createdAt: "2026-04-01T09:00:00+09:00",
    ...overrides,
  };
}

export function fakeBudget(overrides: Partial<Budget> = {}): Budget {
  return {
    categoryId: "cat-food",
    month: "2026-04",
    amount: 30000,
    updatedAt: "2026-04-01T09:00:00+09:00",
    ...overrides,
  };
}

/**
 * 決まった規則で作った架空の収支（乱数を使わず再現できる）。
 * months に並べた月へ順に割り当てる。
 */
export function fakeTransactions(count: number, months: readonly string[]): Transaction[] {
  return Array.from({ length: count }, (_, i) => {
    const month = months[i % months.length] ?? "2026-01";
    const day = String((i % 28) + 1).padStart(2, "0");
    return fakeTransaction({
      id: `tx-${String(i).padStart(5, "0")}`,
      date: `${month}-${day}`,
      categoryId: i % 3 === 0 ? "cat-food" : "cat-daily",
      amount: 100 + (i % 50) * 10,
      memo: `架空の支出 ${i}`,
    });
  });
}

/** 次の周回（タイマー）まで待つ。IndexedDB の処理は、要求のないままここを越えると自動で確定する。 */
export function nextTurn(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
