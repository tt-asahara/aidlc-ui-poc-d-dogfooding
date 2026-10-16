// 収支の持ち主のテスト（BR2.1〜BR2.5、BR5.1）。
import { describe, expect, it } from "vitest";
import {
  buildNewTransaction,
  buildUpdatedTransaction,
  checkCategoryForEntry,
  findImportCategoryProblems,
  sortNewestFirst,
  sortOldestFirst,
} from "./ledger";
import { fakeCategory, fakeTransaction } from "./test-fixtures";
import type { ValidTransaction } from "./types";

const valid: ValidTransaction = {
  date: "2026-10-05",
  type: "expense",
  categoryId: "cat-架空の食費",
  amount: 1200,
  memo: "架空のランチ",
};

describe("収支の値の組み立て（BR2.1、BR2.2）", () => {
  it("新しい収支に id・createdAt・updatedAt を付ける", () => {
    expect(buildNewTransaction(valid, "tx-1", "2026-10-16T00:00:00.000Z")).toEqual({
      ...valid,
      id: "tx-1",
      createdAt: "2026-10-16T00:00:00.000Z",
      updatedAt: "2026-10-16T00:00:00.000Z",
    });
  });

  it("更新では id と createdAt を残し、updatedAt と値を置き換える", () => {
    const existing = fakeTransaction({ id: "tx-9", createdAt: "2026-01-01T00:00:00.000Z" });
    const changed = { ...valid, date: "2026-11-02", amount: 3000, memo: "架空の夕食" };
    expect(buildUpdatedTransaction(existing, changed, "2026-10-16T00:00:00.000Z")).toEqual({
      ...changed,
      id: "tx-9",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-10-16T00:00:00.000Z",
    });
  });
});

describe("カテゴリの確認（BR2.1）", () => {
  const expense = fakeCategory({ id: "c-e", type: "expense" });

  it("存在して種別が一致すれば問題なし", () => {
    expect(checkCategoryForEntry(expense, "expense")).toBeUndefined();
  });

  it("ない → category-missing、種別が違う → category-type-mismatch", () => {
    expect(checkCategoryForEntry(undefined, "expense")).toEqual({ code: "category-missing" });
    expect(checkCategoryForEntry(expense, "income")).toEqual({ code: "category-type-mismatch" });
  });
});

describe("取り込みのカテゴリの確認（BR5.1）", () => {
  const categories = [
    fakeCategory({ id: "c-e", type: "expense" }),
    fakeCategory({ id: "c-i", type: "income" }),
  ];

  it("カテゴリがない行と種別が違う行の line を昇順で返す", () => {
    const rows = [
      { line: 9, value: { ...valid, categoryId: "c-消えた" } },
      { line: 2, value: { ...valid, categoryId: "c-e" } },
      { line: 4, value: { ...valid, categoryId: "c-i" } },
      { line: 3, value: { ...valid, type: "income" as const, categoryId: "c-i" } },
    ];
    expect(findImportCategoryProblems(rows, categories)).toEqual([4, 9]);
  });

  it("全行に問題がない・0行なら空の配列", () => {
    expect(
      findImportCategoryProblems([{ line: 2, value: { ...valid, categoryId: "c-e" } }], categories),
    ).toEqual([]);
    expect(findImportCategoryProblems([], categories)).toEqual([]);
  });
});

describe("一覧の並び（BR2.4、BR2.5、AC2.3.1・AC2.3.2）", () => {
  const a = fakeTransaction({ id: "b", date: "2026-10-05", createdAt: "2026-10-05T01:00:00.000Z" });
  const sameDateLater = fakeTransaction({
    id: "c",
    date: "2026-10-05",
    createdAt: "2026-10-05T02:00:00.000Z",
  });
  const sameAll = fakeTransaction({
    id: "a",
    date: "2026-10-05",
    createdAt: "2026-10-05T01:00:00.000Z",
  });
  const older = fakeTransaction({
    id: "z",
    date: "2026-10-01",
    createdAt: "2026-10-09T00:00:00.000Z",
  });

  it("新しい順: 日付 → 登録日時の新しい順 → 同じなら id の昇順", () => {
    const input = [older, a, sameDateLater, sameAll];
    expect(sortNewestFirst(input).map((t) => t.id)).toEqual(["c", "a", "b", "z"]);
    expect(input[0]).toBe(older);
  });

  it("古い順: 日付 → 登録日時の古い順 → 同じなら id の昇順", () => {
    expect(sortOldestFirst([sameDateLater, a, older, sameAll]).map((t) => t.id)).toEqual([
      "z",
      "a",
      "b",
      "c",
    ]);
  });

  it("id は符号単位の順で比べる（大文字が小文字より前）", () => {
    const upper = fakeTransaction({ id: "B" });
    const lower = fakeTransaction({ id: "a" });
    expect(sortNewestFirst([lower, upper]).map((t) => t.id)).toEqual(["B", "a"]);
  });

  it("空の配列はそのまま空（空データ）", () => {
    expect(sortNewestFirst([])).toEqual([]);
    expect(sortOldestFirst([])).toEqual([]);
  });
});
