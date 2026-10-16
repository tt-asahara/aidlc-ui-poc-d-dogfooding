// カテゴリの持ち主のテスト（US3.1〜US3.4、BR1.2、BR3.1〜BR3.4）。
import { describe, expect, it } from "vitest";
import {
  buildInitialCategories,
  checkCategoryDeletion,
  INITIAL_CATEGORY_NAMES,
  isEntryType,
  needsInitialCategories,
  nextSortOrder,
  prepareNewCategory,
  prepareRename,
  sortCategories,
} from "./categoryCatalog";
import { fakeCategory, sequentialIds } from "./test-fixtures";

const food = fakeCategory({ id: "c-food", name: "架空の食費", sortOrder: 0 });
const daily = fakeCategory({ id: "c-daily", name: "Daily", sortOrder: 3 });
const salary = fakeCategory({ id: "c-salary", type: "income", name: "架空の給与", sortOrder: 0 });

describe("初期カテゴリ（BR1.2、AC3.1.1）", () => {
  it("支出7件・収入3件の順に、種別ごとに sortOrder 0 から作る", () => {
    const created = buildInitialCategories("2026-10-16T00:00:00.000Z", sequentialIds("c-"));
    expect(created.map((c) => [c.type, c.name, c.sortOrder])).toEqual([
      ["expense", "食費", 0],
      ["expense", "日用品", 1],
      ["expense", "住居費", 2],
      ["expense", "水道光熱費", 3],
      ["expense", "交通費", 4],
      ["expense", "娯楽", 5],
      ["expense", "その他支出", 6],
      ["income", "給与", 0],
      ["income", "副収入", 1],
      ["income", "その他収入", 2],
    ]);
    expect(new Set(created.map((c) => c.id)).size).toBe(10);
    expect(created.every((c) => c.createdAt === "2026-10-16T00:00:00.000Z")).toBe(true);
    expect(INITIAL_CATEGORY_NAMES.expense).toHaveLength(7);
  });

  it("0件のときだけ作る（空データ）", () => {
    expect(needsInitialCategories([])).toBe(true);
    expect(needsInitialCategories([salary])).toBe(false);
  });
});

describe("カテゴリの追加（BR3.2、AC3.2.1〜AC3.2.3）", () => {
  it("同じ種別の末尾（最大の sortOrder + 1）に加え、名前の前後の空白を除く", () => {
    const result = prepareNewCategory("expense", "  架空の趣味  ", [food, daily, salary]);
    expect(result).toEqual({
      ok: true,
      value: { type: "expense", name: "架空の趣味", sortOrder: 4 },
    });
    expect(nextSortOrder([food, daily, salary], "income")).toBe(1);
    expect(nextSortOrder([food], "income")).toBe(0);
  });

  it("全角・大文字小文字の違いだけの名前は重複になる", () => {
    for (const name of ["ＤＡＩＬＹ", "daily", " DAILY "]) {
      const result = prepareNewCategory("expense", name, [food, daily]);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error[0]?.code).toBe("duplicate-name");
    }
  });

  it("別の種別に同じ名前があっても重複にならない", () => {
    expect(prepareNewCategory("income", "架空の食費", [food]).ok).toBe(true);
  });

  it("空白だけの名前と21文字の名前は検証エラー（入力エラー）", () => {
    const blank = prepareNewCategory("expense", "   ", [food]);
    const tooLong = prepareNewCategory("expense", "架".repeat(21), [food]);
    expect(blank.ok === false && blank.error[0]?.code).toBe("blank");
    expect(tooLong.ok === false && tooLong.error[0]?.code).toBe("too-long");
    expect(prepareNewCategory("expense", "架".repeat(20), [food]).ok).toBe(true);
  });

  it("isEntryType は income・expense だけを受け付ける", () => {
    expect(isEntryType("income")).toBe(true);
    expect(isEntryType("expense")).toBe(true);
    expect(isEntryType("Income")).toBe(false);
    expect(isEntryType(undefined)).toBe(false);
  });
});

describe("カテゴリの名前変更（BR3.3、AC3.3.1・AC3.3.2）", () => {
  it("名前だけを置き換え、種別・並び・作成日時は変えない", () => {
    const result = prepareRename(daily, "架空の日用品", [food, daily]);
    expect(result).toEqual({ ok: true, value: { ...daily, name: "架空の日用品" } });
  });

  it("自分自身は重複の比較から除く（大文字小文字だけの変更は通る）", () => {
    expect(prepareRename(daily, "DAILY", [food, daily])).toEqual({
      ok: true,
      value: { ...daily, name: "DAILY" },
    });
  });

  it("同じ種別のほかのカテゴリと重複する名前・空白は検証エラー", () => {
    const duplicate = prepareRename(daily, "架空の食費", [food, daily]);
    const blank = prepareRename(daily, "", [food, daily]);
    expect(duplicate.ok === false && duplicate.error[0]?.code).toBe("duplicate-name");
    expect(blank.ok === false && blank.error[0]?.code).toBe("blank");
  });
});

describe("カテゴリの削除の判定（BR3.4、AC3.4.1・AC3.4.3）", () => {
  it("存在しなければ not-found（使用中・最後の1件より先に判定する）", () => {
    expect(checkCategoryDeletion(undefined, 5, [salary])).toEqual({ code: "not-found" });
  });

  it("収支から使われていれば category-in-use（件数付き。最後の1件より先に判定する）", () => {
    expect(checkCategoryDeletion(salary, 2, [salary])).toEqual({
      code: "category-in-use",
      count: 2,
    });
  });

  it("同じ種別の最後の1件なら last-category-of-type", () => {
    expect(checkCategoryDeletion(salary, 0, [food, daily, salary])).toEqual({
      code: "last-category-of-type",
      type: "income",
    });
  });

  it("どれでもなければ削除できる", () => {
    expect(checkCategoryDeletion(daily, 0, [food, daily, salary])).toBeUndefined();
  });
});

describe("カテゴリの一覧の並び（BR3.1）", () => {
  it("支出の後に収入、sortOrder → createdAt → id の昇順。元の配列は変えない", () => {
    const later = fakeCategory({ id: "c-b", sortOrder: 0, createdAt: "2026-05-01T00:00:00.000Z" });
    const sameTimeA = fakeCategory({
      id: "c-a",
      sortOrder: 0,
      createdAt: "2026-05-01T00:00:00.000Z",
    });
    const input = [salary, daily, later, sameTimeA, food];
    const sorted = sortCategories(input);
    expect(sorted.map((c) => c.id)).toEqual(["c-food", "c-a", "c-b", "c-daily", "c-salary"]);
    expect(input[0]).toBe(salary);
    expect(sortCategories([])).toEqual([]);
  });
});
