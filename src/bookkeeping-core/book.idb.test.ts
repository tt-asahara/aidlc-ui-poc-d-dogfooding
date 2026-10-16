// 本物の保存（U3 の openStorage と fake-indexeddb）での Book の結合テスト。
// 別のタブ（AC3.4.4・AC3.1.2、NFR4.2）、実行中の版上げ（NFR4.3、FD Q1 = A）、全書き込み操作の成功（NFR4.4）。
// 1つのテストの中で IDBFactory と dbName を1組だけ作り、2つの openBook の storage 引数に同じ組の opener を渡す。
import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "../data-contract";
import { openBook } from "./book";
import {
  fakeInput,
  idbOpener,
  newFactory,
  readyBook,
  sequentialIds,
  uniqueDbName,
} from "./test-fixtures";
import type { Book } from "./types";

async function categoryIdOf(book: Book, name: string): Promise<string> {
  const listed = await book.listCategories();
  const found = listed.ok ? listed.value.find((c) => c.name === name) : undefined;
  if (found === undefined) throw new Error(`カテゴリ ${name} がありません`);
  return found.id;
}

/** 別の接続で版を上げる（versionchange を起こす）。上げた接続はすぐ閉じる。 */
function bumpVersion(factory: IDBFactory, dbName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = factory.open(dbName, SCHEMA_VERSION + 1);
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error ?? new Error("版を上げられませんでした"));
    request.onblocked = () => reject(new Error("版の更新が妨げられました"));
  });
}

describe("別のタブ（同じ保存領域を2つの Book で開く）", () => {
  it("片方がカテゴリを消した後、もう片方のそのカテゴリへの収支の追加は category-missing（AC3.4.4）", async () => {
    const factory = newFactory();
    const dbName = uniqueDbName();
    const tabA = await readyBook({
      storage: idbOpener(factory, dbName),
      newId: sequentialIds("a-"),
    });
    const tabB = await readyBook({
      storage: idbOpener(factory, dbName),
      newId: sequentialIds("b-"),
    });
    const added = await tabA.addCategory("expense", "架空の趣味");
    if (!added.ok) throw new Error("追加できませんでした");
    // タブ B の画面には、まだ「架空の趣味」が表示されている。
    expect(await categoryIdOf(tabB, "架空の趣味")).toBe(added.value.id);
    expect(await tabA.deleteCategory(added.value.id)).toEqual({
      ok: true,
      value: { deletedBudgets: 0 },
    });
    expect(await tabB.addTransaction(fakeInput({ categoryId: added.value.id }))).toEqual({
      ok: false,
      error: { kind: "rule", violation: { code: "category-missing" } },
    });
    expect(await tabB.listAllTransactions("all")).toEqual({ ok: true, value: [] });
  });

  it("片方で収支を追加した後のもう片方のカテゴリの削除は、処理の中で数え直して category-in-use", async () => {
    const factory = newFactory();
    const dbName = uniqueDbName();
    const tabA = await readyBook({
      storage: idbOpener(factory, dbName),
      newId: sequentialIds("a-"),
    });
    const tabB = await readyBook({
      storage: idbOpener(factory, dbName),
      newId: sequentialIds("b-"),
    });
    const daily = await categoryIdOf(tabB, "日用品");
    const usageBefore = await tabB.getCategoryUsage();
    expect(usageBefore.ok && usageBefore.value[daily]).toEqual({ transactions: 0, budgets: 0 });
    expect((await tabA.addTransaction(fakeInput({ categoryId: daily }))).ok).toBe(true);
    expect(await tabB.deleteCategory(daily)).toEqual({
      ok: false,
      error: { kind: "rule", violation: { code: "category-in-use", count: 1 } },
    });
  });

  it("2つの Book が同時に開いても初期カテゴリは10件（AC3.1.2）", async () => {
    const factory = newFactory();
    const dbName = uniqueDbName();
    const [first, second] = await Promise.all([
      openBook({ storage: idbOpener(factory, dbName), newId: sequentialIds("a-") }),
      openBook({ storage: idbOpener(factory, dbName), newId: sequentialIds("b-") }),
    ]);
    expect(first.status).toBe("ready");
    expect(second.status).toBe("ready");
    if (first.status !== "ready") return;
    const listed = await first.book.listCategories();
    expect(listed.ok && listed.value).toHaveLength(10);
    const prefixes = new Set(listed.ok ? listed.value.map((c) => c.id.slice(0, 2)) : []);
    expect(prefixes.size).toBe(1);
  });
});

describe("実行中の版上げ（newer-version）", () => {
  it("別のタブで版が上がった後の読み取り・書き込みは newer-version（以後の操作も同じ）", async () => {
    const factory = newFactory();
    const dbName = uniqueDbName();
    const book = await readyBook({ storage: idbOpener(factory, dbName) });
    const food = await categoryIdOf(book, "食費");
    await bumpVersion(factory, dbName);
    const newer = { ok: false, error: { kind: "newer-version" } };
    expect(await book.listCategories()).toEqual(newer);
    expect(await book.addTransaction(fakeInput({ categoryId: food }))).toEqual(newer);
    expect(await book.setBudget(food, "2026-10", 100)).toEqual(newer);
    expect(await book.getEffectiveBudgets("2026-10")).toEqual(newer);
    // 版が上がった保存領域を開き直すと、開くときの newer-version になる。
    expect(await openBook({ storage: idbOpener(factory, dbName) })).toEqual({
      status: "newer-version",
    });
  });
});

describe("本物の保存での全書き込み操作（NFR4.4）", () => {
  it("書き込み9種がすべて成功し、読み取りに反映される", async () => {
    const book = await readyBook({ storage: idbOpener(newFactory(), uniqueDbName()) });
    const food = await categoryIdOf(book, "食費");
    const salary = await categoryIdOf(book, "給与");
    const added = await book.addTransaction(fakeInput({ categoryId: food }));
    if (!added.ok) throw new Error("追加できませんでした");
    expect(
      (await book.updateTransaction(added.value.id, fakeInput({ categoryId: food, amount: 900 })))
        .ok,
    ).toBe(true);
    const hobby = await book.addCategory("expense", "架空の趣味");
    if (!hobby.ok) throw new Error("カテゴリを追加できませんでした");
    expect((await book.renameCategory(hobby.value.id, "架空の娯楽費")).ok).toBe(true);
    expect((await book.setBudget(hobby.value.id, "2026-09", 4000)).ok).toBe(true);
    expect((await book.setBudget(food, "2026-09", 30000)).ok).toBe(true);
    expect((await book.clearBudget(food, "2026-09")).ok).toBe(true);
    expect(
      await book.importTransactions([
        { line: 2, input: fakeInput({ type: "income", categoryId: salary, amount: 200000 }) },
        { line: 3, input: fakeInput({ categoryId: food, date: "2026-10-06" }) },
      ]),
    ).toEqual({ ok: true, value: { added: 2 } });
    expect(await book.deleteTransaction(added.value.id)).toEqual({ ok: true, value: undefined });
    expect(await book.deleteCategory(hobby.value.id)).toEqual({
      ok: true,
      value: { deletedBudgets: 1 },
    });

    const october = await book.listTransactions("2026-10");
    expect(october.ok && october.value.map((t) => t.amount)).toEqual([1200, 200000]);
    const effective = await book.getEffectiveBudgets("2026-10");
    expect(effective.ok && effective.value.every((e) => e.source.kind === "none")).toBe(true);
    const categories = await book.listCategories();
    expect(categories.ok && categories.value).toHaveLength(10);
  });
});
