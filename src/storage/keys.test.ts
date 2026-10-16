// キーの比較と取り出しのテスト（IndexedDB のキーの比較と同じ意味であること）。
import { describe, expect, it } from "vitest";
import {
  assertIndex,
  assertKey,
  compareKeys,
  indexValueOf,
  keyId,
  primaryKeyOf,
  type StoreKey,
} from "./keys";
import { fakeBudget, fakeCategory, fakeTransaction } from "./test-fixtures";

describe("compareKeys", () => {
  it("文字列どうしは符号単位の順に比べる（大文字は小文字より前、短い方が前）", () => {
    expect(compareKeys("a", "b")).toBeLessThan(0);
    expect(compareKeys("b", "a")).toBeGreaterThan(0);
    expect(compareKeys("B", "a")).toBeLessThan(0);
    expect(compareKeys("tx", "tx-1")).toBeLessThan(0);
    expect(compareKeys("同じ", "同じ")).toBe(0);
  });

  it("配列は文字列より大きい", () => {
    expect(compareKeys("zzz", ["a"])).toBeLessThan(0);
    expect(compareKeys(["a"], "zzz")).toBeGreaterThan(0);
  });

  it("配列どうしは要素ごとに比べ、すべて等しければ短い方が前", () => {
    expect(compareKeys(["cat-a", "2026-05"], ["cat-b", "2026-01"])).toBeLessThan(0);
    expect(compareKeys(["cat-a", "2026-05"], ["cat-a", "2026-04"])).toBeGreaterThan(0);
    expect(compareKeys(["cat-a"], ["cat-a", "2026-04"])).toBeLessThan(0);
    expect(compareKeys(["cat-a", "2026-04"], ["cat-a", "2026-04"])).toBe(0);
  });

  it("並べ替えに使うと IndexedDB と同じ順になる", () => {
    const keys: StoreKey[] = [["b", "1"], "b", ["a", "2"], "a", ["a", "1"]];
    expect([...keys].sort(compareKeys)).toEqual(["a", "b", ["a", "1"], ["a", "2"], ["b", "1"]]);
  });
});

describe("keyId", () => {
  it("文字列と、同じ文字を持つ配列を区別する", () => {
    expect(keyId("a")).not.toBe(keyId(["a"]));
    expect(keyId(["cat-a", "2026-04"])).toBe(keyId(["cat-a", "2026-04"]));
  });
});

describe("assertKey・primaryKeyOf", () => {
  it("保存領域ごとの主キーを取り出す", () => {
    expect(primaryKeyOf("transactions", { ...fakeTransaction() })).toBe("tx-001");
    expect(primaryKeyOf("categories", { ...fakeCategory() })).toBe("cat-food");
    expect(primaryKeyOf("budgets", { ...fakeBudget() })).toEqual(["cat-food", "2026-04"]);
    expect(primaryKeyOf("meta", { key: "schema" })).toBe("schema");
  });

  it("キーの形が違えば例外にする", () => {
    expect(() => assertKey("transactions", 1)).toThrow("transactions のキーは文字列です");
    expect(() => assertKey("budgets", "cat-food")).toThrow("budgets のキーは");
    expect(() => assertKey("budgets", ["cat-food"])).toThrow("budgets のキーは");
    expect(() => primaryKeyOf("categories", { name: "架空の名前" })).toThrow();
  });
});

describe("indexValueOf・assertIndex", () => {
  it("byMonth は date の先頭7文字、byCategory は categoryId", () => {
    const tx = { ...fakeTransaction({ date: "2026-12-31" }) };
    expect(indexValueOf("transactions", "byMonth", tx)).toBe("2026-12");
    expect(indexValueOf("transactions", "byCategory", tx)).toBe("cat-food");
    expect(indexValueOf("budgets", "byCategory", { ...fakeBudget({ categoryId: "cat-x" }) })).toBe(
      "cat-x",
    );
  });

  it("定義にない索引は例外にする", () => {
    expect(() => assertIndex("categories", "byCategory")).toThrow(
      "保存領域 categories に索引 byCategory はありません",
    );
    expect(() => assertIndex("budgets", "byMonth")).toThrow();
    expect(() => indexValueOf("transactions", "byAmount", {})).toThrow();
  });
});
