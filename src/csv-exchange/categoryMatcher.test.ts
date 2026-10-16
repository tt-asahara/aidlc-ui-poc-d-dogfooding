// カテゴリの照合（BR3.3、FD Q1 = A、AC7.1.2）。テストを先に書く（CSV 変換のレイヤー）。
import { describe, expect, it } from "vitest";
import type { Category, EntryType } from "../data-contract";
import { createCategoryMatcher } from "./categoryMatcher";

function category(id: string, type: EntryType, name: string, sortOrder = 0): Category {
  return { id, type, name, sortOrder, createdAt: "2026-04-01T00:00:00.000Z" };
}

const CATEGORIES: Category[] = [
  category("c-food", "expense", "food"),
  category("c-daily", "expense", "架空の日用品", 1),
  category("c-misc-out", "expense", "架空のその他", 2),
  category("c-salary", "income", "架空の給与"),
  category("c-misc-in", "income", "架空のその他", 1),
];

describe("createCategoryMatcher（BR3.3）", () => {
  it("同じ種別の同じ名前のカテゴリを引き、id とアプリ側の名前を返す", () => {
    const matcher = createCategoryMatcher(CATEGORIES);
    expect(matcher.find("expense", "架空の日用品")).toEqual({
      kind: "found",
      category: CATEGORIES[1],
    });
    expect(matcher.find("income", "架空の給与")).toEqual({
      kind: "found",
      category: CATEGORIES[3],
    });
  });

  it("全角・大文字小文字・前後の空白の違いを吸収し、名前はアプリ側の現在の表記を返す（Q1 = A）", () => {
    const matcher = createCategoryMatcher(CATEGORIES);
    for (const written of ["ＦＯＯＤ", "Food", "  FOOD  ", "　ｆｏｏｄ　"]) {
      const match = matcher.find("expense", written);
      expect(match.kind === "found" && match.category.id).toBe("c-food");
      expect(match.kind === "found" && match.category.name).toBe("food");
    }
  });

  it("両方の種別に同じ名前があるときは、行の種別のカテゴリを返す", () => {
    const matcher = createCategoryMatcher(CATEGORIES);
    const out = matcher.find("expense", "架空のその他");
    const income = matcher.find("income", "架空のその他");
    expect(out.kind === "found" && out.category.id).toBe("c-misc-out");
    expect(income.kind === "found" && income.category.id).toBe("c-misc-in");
  });

  it("別の種別にだけある名前は type-mismatch", () => {
    const matcher = createCategoryMatcher(CATEGORIES);
    expect(matcher.find("income", "ＦＯＯＤ")).toEqual({ kind: "type-mismatch" });
    expect(matcher.find("expense", "架空の給与")).toEqual({ kind: "type-mismatch" });
  });

  it("どの種別にもない名前は not-found", () => {
    const matcher = createCategoryMatcher(CATEGORIES);
    expect(matcher.find("expense", "架空の存在しないカテゴリ")).toEqual({ kind: "not-found" });
    expect(matcher.find("income", "foods")).toEqual({ kind: "not-found" });
  });

  it("カテゴリが0件なら、どの名前も not-found", () => {
    const matcher = createCategoryMatcher([]);
    expect(matcher.find("expense", "food")).toEqual({ kind: "not-found" });
  });

  it("照合表は作った時点のカテゴリで決まる（元の配列を後で変えても結果は変わらない）", () => {
    const source = [...CATEGORIES];
    const matcher = createCategoryMatcher(source);
    source.length = 0;
    expect(matcher.find("expense", "food").kind).toBe("found");
  });
});
