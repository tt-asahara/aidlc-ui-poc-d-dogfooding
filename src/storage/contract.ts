// 契約テストの本体（BR5.2）。本物（openStorage）と差し替え（createMemoryStorage）に同じテストを流す。
// 作り方（open）を受け取り、テストごとに新しい保存領域を開く。
import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type Result } from "../data-contract";
import { fakeBudget, fakeCategory, fakeTransaction, nextTurn } from "./test-fixtures";
import type { StorageHandle, StorageOpenError, TxContext } from "./types";

export type OpenForContract = () => Promise<Result<StorageHandle, StorageOpenError>>;

export function runStorageContract(label: string, open: OpenForContract): void {
  async function openHandle(): Promise<StorageHandle> {
    const opened = await open();
    if (!opened.ok) throw new Error(`開けませんでした: ${opened.error.kind}`);
    return opened.value;
  }

  async function snapshot(handle: StorageHandle) {
    const result = await handle.read(["transactions", "categories", "budgets"], async (tx) => ({
      transactions: await tx.getAll("transactions"),
      categories: await tx.getAll("categories"),
      budgets: await tx.getAll("budgets"),
    }));
    if (!result.ok) throw new Error(`読めませんでした: ${result.error.kind}`);
    return result.value;
  }

  async function seed(handle: StorageHandle): Promise<void> {
    const result = await handle.write(["transactions", "categories"], async (tx) => {
      await tx.put("categories", fakeCategory());
      await tx.put("transactions", fakeTransaction({ id: "tx-seed", memo: "架空の既存データ" }));
      return { ok: true, value: undefined };
    });
    expect(result.ok).toBe(true);
  }

  describe(`契約テスト（${label}）`, () => {
    describe("正常", () => {
      it("開くとメタ情報に現在の版があり、保存領域は空（空データ）", async () => {
        const handle = await openHandle();
        const result = await handle.read(
          ["meta", "transactions", "categories", "budgets"],
          async (tx) => ({
            meta: await tx.get("meta", "schema"),
            transactions: await tx.getAll("transactions"),
            categories: await tx.getAll("categories"),
            budgets: await tx.getAll("budgets"),
            count: await tx.count("transactions", "byCategory", "cat-food"),
            missing: await tx.get("transactions", "tx-none"),
            byMonth: await tx.getAllByIndex("transactions", "byMonth", "2026-04"),
          }),
        );
        expect(result.ok && result.value.meta?.schemaVersion).toBe(SCHEMA_VERSION);
        expect(result.ok && typeof result.value.meta?.initializedAt).toBe("string");
        expect(result).toMatchObject({
          ok: true,
          value: { transactions: [], categories: [], budgets: [], count: 0, byMonth: [] },
        });
        expect(result.ok && result.value.missing).toBeUndefined();
        handle.close();
      });

      it("書いて読み直すと同じ値が返り、収支に索引用の month は含まれない", async () => {
        const handle = await openHandle();
        const transaction = fakeTransaction();
        const budget = fakeBudget();
        const written = await handle.write(
          ["transactions", "categories", "budgets"],
          async (tx) => {
            await tx.put("transactions", transaction);
            await tx.put("categories", fakeCategory());
            await tx.put("budgets", budget);
            return { ok: true, value: "保存済み" };
          },
        );
        expect(written).toEqual({ ok: true, value: "保存済み" });
        const read = await handle.read(["transactions", "budgets"], async (tx) => ({
          one: await tx.get("transactions", transaction.id),
          all: await tx.getAll("transactions"),
          budget: await tx.get("budgets", ["cat-food", "2026-04"]),
        }));
        expect(read).toEqual({
          ok: true,
          value: { one: transaction, all: [transaction], budget },
        });
        expect(read.ok && Object.keys(read.value.one ?? {})).not.toContain("month");
        handle.close();
      });

      it("対象月・カテゴリの索引で引け、カテゴリ別の件数を数えられる", async () => {
        const handle = await openHandle();
        await handle.write(["transactions", "budgets"], async (tx) => {
          await tx.put("transactions", fakeTransaction({ id: "tx-b", date: "2026-04-30" }));
          await tx.put("transactions", fakeTransaction({ id: "tx-a", date: "2026-04-01" }));
          await tx.put(
            "transactions",
            fakeTransaction({ id: "tx-c", date: "2026-05-01", categoryId: "cat-x" }),
          );
          await tx.put("budgets", fakeBudget({ categoryId: "cat-x", month: "2026-05" }));
          await tx.put("budgets", fakeBudget({ categoryId: "cat-food", month: "2026-05" }));
          return { ok: true, value: undefined };
        });
        const result = await handle.read(["transactions", "budgets"], async (tx) => ({
          april: (await tx.getAllByIndex("transactions", "byMonth", "2026-04")).map((t) => t.id),
          food: (await tx.getAllByIndex("transactions", "byCategory", "cat-food")).map((t) => t.id),
          budgetsX: await tx.getAllByIndex("budgets", "byCategory", "cat-x"),
          countFood: await tx.count("transactions", "byCategory", "cat-food"),
        }));
        expect(result).toEqual({
          ok: true,
          value: {
            april: ["tx-a", "tx-b"],
            food: ["tx-a", "tx-b"],
            budgetsX: [fakeBudget({ categoryId: "cat-x", month: "2026-05" })],
            countFood: 2,
          },
        });
        handle.close();
      });

      it("work の中の読み取りには、同じ処理で溜めた put・delete が重なる", async () => {
        const handle = await openHandle();
        await seed(handle);
        const result = await handle.write(["transactions"], async (tx) => {
          await tx.delete("transactions", "tx-seed");
          await tx.put("transactions", fakeTransaction({ id: "tx-new" }));
          return {
            ok: true,
            value: {
              all: (await tx.getAll("transactions")).map((t) => t.id),
              seed: await tx.get("transactions", "tx-seed"),
              count: await tx.count("transactions", "byCategory", "cat-food"),
            },
          };
        });
        expect(result).toEqual({ ok: true, value: { all: ["tx-new"], seed: undefined, count: 1 } });
        expect((await snapshot(handle)).transactions.map((t) => t.id)).toEqual(["tx-new"]);
        handle.close();
      });

      it("続けて呼んだ書き込みは呼んだ順に処理され、後の処理は前の結果を読む", async () => {
        const handle = await openHandle();
        const first = handle.write(["categories"], async (tx) => {
          await tx.put("categories", fakeCategory({ name: "架空の一回目" }));
          return { ok: true, value: 1 };
        });
        const second = handle.write(["categories"], async (tx) => {
          const before = await tx.get("categories", "cat-food");
          await tx.put("categories", fakeCategory({ name: "架空の二回目" }));
          return { ok: true, value: before?.name };
        });
        expect(await first).toEqual({ ok: true, value: 1 });
        expect(await second).toEqual({ ok: true, value: "架空の一回目" });
        expect((await snapshot(handle)).categories[0]?.name).toBe("架空の二回目");
        handle.close();
      });

      it("work の中で microtask だけを待つのは正常に保存される", async () => {
        const handle = await openHandle();
        const result = await handle.write(["categories"], async (tx) => {
          await Promise.resolve();
          await tx.put("categories", fakeCategory());
          await Promise.resolve();
          return { ok: true, value: undefined };
        });
        expect(result.ok).toBe(true);
        expect((await snapshot(handle)).categories).toEqual([fakeCategory()]);
        handle.close();
      });
    });

    describe("すべて取り消し（保存失敗）", () => {
      it("work が例外を投げると write-failed で、何も書かれず既存のデータが残る", async () => {
        const handle = await openHandle();
        await seed(handle);
        const before = await snapshot(handle);
        const result = await handle.write(["transactions"], async (tx) => {
          await tx.put("transactions", fakeTransaction({ id: "tx-new" }));
          throw new Error("架空の途中失敗");
        });
        expect(result.ok === false && result.error.kind).toBe("write-failed");
        expect(await snapshot(handle)).toEqual(before);
        handle.close();
      });

      it("work が { ok: false } を返すと aborted（reason は work の値）で、何も書かれない", async () => {
        const handle = await openHandle();
        await seed(handle);
        const before = await snapshot(handle);
        const result = await handle.write<never, { code: string }>(["transactions"], async (tx) => {
          await tx.delete("transactions", "tx-seed");
          return { ok: false, error: { code: "架空の規則違反" } };
        });
        expect(result).toEqual({
          ok: false,
          error: { kind: "aborted", reason: { code: "架空の規則違反" } },
        });
        expect(await snapshot(handle)).toEqual(before);
        handle.close();
      });

      it("2件目の put が失敗すると（複製できない値）、1件目も残らない", async () => {
        const handle = await openHandle();
        const result = await handle.write(["transactions"], async (tx) => {
          await tx.put("transactions", fakeTransaction({ id: "tx-1" }));
          const broken = { ...fakeTransaction({ id: "tx-2" }), memo: () => "複製できない" };
          await tx.put("transactions", broken as unknown as ReturnType<typeof fakeTransaction>);
          return { ok: true, value: undefined };
        });
        expect(result.ok === false && result.error.kind).toBe("write-failed");
        expect((await snapshot(handle)).transactions).toEqual([]);
        handle.close();
      });
    });

    describe("自動確定（work の中で別の周回に進む待ち）", () => {
      it("待ちの後に読み取ると write-failed で、待ちの前の put も書かれない", async () => {
        const handle = await openHandle();
        const result = await handle.write(["transactions"], async (tx) => {
          await tx.put("transactions", fakeTransaction());
          await nextTurn();
          await tx.getAll("transactions");
          return { ok: true, value: undefined };
        });
        expect(result.ok === false && result.error.kind).toBe("write-failed");
        expect((await snapshot(handle)).transactions).toEqual([]);
        handle.close();
      });

      it("待ちの後に読み取りをせず成功を返しても write-failed で、何も書かれない", async () => {
        const handle = await openHandle();
        const result = await handle.write(["transactions"], async (tx) => {
          await tx.put("transactions", fakeTransaction());
          await nextTurn();
          return { ok: true, value: undefined };
        });
        expect(result.ok === false && result.error.kind).toBe("write-failed");
        expect((await snapshot(handle)).transactions).toEqual([]);
        handle.close();
      });

      it("待ちの後に put だけをしても write-failed で、何も書かれない", async () => {
        const handle = await openHandle();
        const result = await handle.write(["transactions"], async (tx) => {
          await nextTurn();
          await tx.put("transactions", fakeTransaction());
          return { ok: true, value: undefined };
        });
        expect(result.ok === false && result.error.kind).toBe("write-failed");
        expect((await snapshot(handle)).transactions).toEqual([]);
        handle.close();
      });
    });

    describe("閉じた後・範囲外・終了後の使用", () => {
      it("close の後の read は read-failed、write は write-failed", async () => {
        const handle = await openHandle();
        handle.close();
        const read = await handle.read(["categories"], (tx) => tx.getAll("categories"));
        const write = await handle.write(["categories"], () =>
          Promise.resolve({ ok: true as const, value: undefined }),
        );
        expect(read).toEqual({
          ok: false,
          error: { kind: "read-failed", message: "保存領域は閉じられています" },
        });
        expect(write).toEqual({
          ok: false,
          error: { kind: "write-failed", message: "保存領域は閉じられています" },
        });
      });

      it("指定していない保存領域の操作は失敗し、何も書かれない", async () => {
        const handle = await openHandle();
        const write = await handle.write(["categories"], async (tx) => {
          await tx.put("categories", fakeCategory());
          await tx.put("transactions", fakeTransaction());
          return { ok: true, value: undefined };
        });
        const read = await handle.read(["categories"], (tx) => tx.getAll("transactions"));
        expect(write.ok === false && write.error.kind).toBe("write-failed");
        expect(read.ok === false && read.error.kind).toBe("read-failed");
        expect((await snapshot(handle)).categories).toEqual([]);
        handle.close();
      });

      it("読み取りの処理の中の put は read-failed", async () => {
        const handle = await openHandle();
        const read = await handle.read(["categories"], (tx) =>
          tx.put("categories", fakeCategory()),
        );
        expect(read.ok === false && read.error.kind).toBe("read-failed");
        expect((await snapshot(handle)).categories).toEqual([]);
        handle.close();
      });

      it("work が終わった後に TxContext を使うと失敗し、保存領域は変わらない", async () => {
        const handle = await openHandle();
        let captured: TxContext | undefined;
        await handle.write(["categories"], (tx) => {
          captured = tx;
          return Promise.resolve({ ok: true as const, value: undefined });
        });
        if (captured === undefined) throw new Error("TxContext を受け取れませんでした");
        await expect(captured.put("categories", fakeCategory())).rejects.toThrow();
        await expect(captured.getAll("categories")).rejects.toThrow();
        expect((await snapshot(handle)).categories).toEqual([]);
        handle.close();
      });

      it("消した値は以後の読み取りで返らない", async () => {
        const handle = await openHandle();
        await seed(handle);
        await handle.write(["categories"], async (tx) => {
          await tx.delete("categories", "cat-food");
          return { ok: true, value: undefined };
        });
        expect((await snapshot(handle)).categories).toEqual([]);
        handle.close();
      });
    });
  });
}
