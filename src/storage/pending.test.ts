// 変更の溜め場所と、読み取りへの重ね方のテスト（security-design.md 1.3 節の表の各行）。
import { describe, expect, it } from "vitest";
import type { StoredValue } from "./keys";
import { createTxContext, Pending, type BaseReader } from "./pending";
import { fakeBudget, fakeCategory, fakeTransaction } from "./test-fixtures";

const asStored = (value: object): StoredValue => ({ ...value });

describe("Pending: 溜め方", () => {
  it("空の溜め場所は操作がなく、保存済みの値をそのまま返す", () => {
    const pending = new Pending(["categories"], "readwrite");
    const base = [asStored(fakeCategory())];
    expect(pending.operations()).toEqual([]);
    expect(pending.overlayAll("categories", base)).toEqual(base);
    expect(pending.overlayGet("categories", "cat-food", base[0])).toEqual(base[0]);
    expect(pending.overlayGet("categories", "cat-none", undefined)).toBeUndefined();
  });

  it("同じキーに put・delete を繰り返すと最後の操作だけが残る", () => {
    const pending = new Pending(["categories"], "readwrite");
    pending.put("categories", fakeCategory({ name: "架空の一回目" }));
    pending.put("categories", fakeCategory({ name: "架空の二回目" }));
    expect(pending.operations()).toEqual([
      {
        type: "put",
        store: "categories",
        key: "cat-food",
        value: fakeCategory({ name: "架空の二回目" }),
      },
    ]);
    pending.delete("categories", "cat-food");
    expect(pending.operations()).toEqual([
      { type: "delete", store: "categories", key: "cat-food" },
    ]);
    pending.put("categories", fakeCategory({ name: "架空の三回目" }));
    expect(pending.operations()).toHaveLength(1);
    expect(pending.operations()[0]).toMatchObject({ type: "put" });
  });

  it("put は受け取った時点で複製する（元の値や返った値を書き換えても溜め場所は変わらない）", () => {
    const pending = new Pending(["categories"], "readwrite");
    const original = fakeCategory();
    pending.put("categories", original);
    original.name = "書き換えた架空の名前";
    const first = pending.overlayGet("categories", "cat-food", undefined);
    expect(first?.name).toBe("架空の食費");
    (first as { name: string }).name = "返った値を書き換え";
    expect(pending.overlayGet("categories", "cat-food", undefined)?.name).toBe("架空の食費");
  });

  it("複製できない値・オブジェクトでない値は溜めずにその場で失敗にする", () => {
    const pending = new Pending(["categories"], "readwrite");
    const uncloneable = { ...fakeCategory(), extra: () => "関数" };
    expect(() => pending.put("categories", uncloneable)).toThrow();
    expect(() => pending.put("categories", "文字列")).toThrow("オブジェクトだけ");
    expect(() => pending.put("categories", { name: "キーなし" })).toThrow();
    expect(pending.operations()).toEqual([]);
  });

  it("指定外の保存領域・終了後の操作・読み取り専用での書き込みは失敗にする", () => {
    const pending = new Pending(["categories"], "readwrite");
    expect(() => pending.put("transactions", fakeTransaction())).toThrow(
      "指定していない保存領域 transactions は操作できません",
    );
    pending.finish();
    expect(() => pending.put("categories", fakeCategory())).toThrow(
      "処理が終わった後の TxContext は使えません",
    );
    expect(pending.isFinished).toBe(true);

    const readOnly = new Pending(["categories"], "readonly");
    expect(() => readOnly.delete("categories", "cat-food")).toThrow(
      "読み取りの処理では書き込めません",
    );
  });

  it("finish の理由は最初の1回だけを残す", () => {
    const pending = new Pending(["meta"], "readwrite");
    pending.finish("最初の理由");
    pending.finish("二回目の理由");
    expect(() => pending.assertUsable("meta")).toThrow("最初の理由");
  });
});

describe("Pending: 読み取りへの重ね方", () => {
  it("getAll: 消す予定・書く予定のキーを除き、書く予定の値を加えてキーの順に並べる", () => {
    const pending = new Pending(["categories"], "readwrite");
    const base = ["cat-b", "cat-d", "cat-a"].map((id) => asStored(fakeCategory({ id })));
    pending.delete("categories", "cat-d");
    pending.put("categories", fakeCategory({ id: "cat-c", name: "架空の追加" }));
    pending.put("categories", fakeCategory({ id: "cat-a", name: "架空の更新" }));
    const result = pending.overlayAll("categories", base);
    expect(result.map((c) => c.id)).toEqual(["cat-a", "cat-b", "cat-c"]);
    expect(result[0]?.name).toBe("架空の更新");
  });

  it("get: 消す予定なら undefined、書く予定ならその値、どちらでもなければ保存済みの値", () => {
    const pending = new Pending(["transactions"], "readwrite");
    const saved = asStored(fakeTransaction({ id: "tx-1" }));
    pending.delete("transactions", "tx-1");
    expect(pending.overlayGet("transactions", "tx-1", saved)).toBeUndefined();
    pending.put("transactions", fakeTransaction({ id: "tx-1", amount: 999 }));
    expect(pending.overlayGet("transactions", "tx-1", saved)?.amount).toBe(999);
    expect(pending.overlayGet("transactions", "tx-2", saved)).toBe(saved);
  });

  it("getAllByIndex: 書く予定の値で索引の値が変わったものは外し、一致するものだけを主キーの順に返す", () => {
    const pending = new Pending(["transactions"], "readwrite");
    const base = [
      asStored(fakeTransaction({ id: "tx-2", date: "2026-04-02" })),
      asStored(fakeTransaction({ id: "tx-1", date: "2026-04-01" })),
    ];
    pending.put("transactions", fakeTransaction({ id: "tx-2", date: "2026-05-02" }));
    pending.put("transactions", fakeTransaction({ id: "tx-0", date: "2026-04-30" }));
    pending.put("transactions", fakeTransaction({ id: "tx-9", date: "2026-06-01" }));
    const april = pending.overlayIndex("transactions", "byMonth", "2026-04", base);
    expect(april.map((t) => t.id)).toEqual(["tx-0", "tx-1"]);
  });

  it("budgets の配列のキーも [categoryId, month] の順に並べる", () => {
    const pending = new Pending(["budgets"], "readwrite");
    pending.put("budgets", fakeBudget({ categoryId: "cat-b", month: "2026-01" }));
    pending.put("budgets", fakeBudget({ categoryId: "cat-a", month: "2026-02" }));
    pending.put("budgets", fakeBudget({ categoryId: "cat-a", month: "2026-01" }));
    const result = pending.overlayAll("budgets", []);
    expect(result.map((b) => [b.categoryId, b.month])).toEqual([
      ["cat-a", "2026-01"],
      ["cat-a", "2026-02"],
      ["cat-b", "2026-01"],
    ]);
    expect(pending.overlayIndex("budgets", "byCategory", "cat-a", [])).toHaveLength(2);
  });
});

describe("createTxContext", () => {
  const base: BaseReader = {
    get: (_store, key) =>
      Promise.resolve(key === "cat-food" ? asStored(fakeCategory()) : undefined),
    getAll: () => Promise.resolve([asStored(fakeCategory())]),
    getAllByIndex: () =>
      Promise.resolve([
        asStored(fakeTransaction({ id: "tx-1" })),
        asStored(fakeTransaction({ id: "tx-2" })),
      ]),
  };

  it("保存済みの値に溜め場所の変更を重ねて返し、count は件数を返す", async () => {
    const pending = new Pending(["categories", "transactions"], "readwrite");
    const tx = createTxContext(pending, base);
    await tx.put("categories", fakeCategory({ id: "cat-new", name: "架空の新規" }));
    await tx.delete("transactions", "tx-2");
    expect((await tx.getAll("categories")).map((c) => c.id)).toEqual(["cat-food", "cat-new"]);
    expect(await tx.get("categories", "cat-food")).toEqual(fakeCategory());
    expect(await tx.count("transactions", "byCategory", "cat-food")).toBe(1);
  });

  it("範囲外・終了後・定義にない索引の操作は reject する", async () => {
    const pending = new Pending(["transactions"], "readwrite");
    const tx = createTxContext(pending, base);
    await expect(tx.getAll("categories")).rejects.toThrow("指定していない保存領域");
    await expect(tx.getAllByIndex("transactions", "byAmount" as "byMonth", "100")).rejects.toThrow(
      "索引 byAmount はありません",
    );
    pending.finish();
    await expect(tx.put("transactions", fakeTransaction())).rejects.toThrow("処理が終わった後");
    await expect(tx.get("transactions", "tx-1")).rejects.toThrow("処理が終わった後");
  });
});
