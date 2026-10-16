// 公開窓口のテスト（契約 C3）。C3 の関数だけを公開し、内部の部品は公開しない。
import { describe, expect, it } from "vitest";
import * as core from "./index";
import type { Book, BookOpenResult, CategoryUsage, OperationError } from "./index";

describe("bookkeeping-core の公開窓口", () => {
  it("openBook と resolveEffectiveBudgets だけを値として公開する", () => {
    expect(Object.keys(core).sort()).toEqual(["openBook", "resolveEffectiveBudgets"]);
    expect(typeof core.openBook).toBe("function");
    expect(typeof core.resolveEffectiveBudgets).toBe("function");
  });

  it("内部の部品（持ち主・失敗の置き換え・id）は公開しない", () => {
    const exported = Object.keys(core);
    for (const internal of [
      "buildInitialCategories",
      "sortCategories",
      "sortNewestFirst",
      "buildBudget",
      "fromWriteError",
      "defaultNewId",
      "CORE_MESSAGES",
    ]) {
      expect(exported).not.toContain(internal);
    }
  });

  it("公開窓口の resolveEffectiveBudgets で予算の引き継ぎを計算できる", () => {
    const result = core.resolveEffectiveBudgets(
      [
        {
          id: "c-架空",
          type: "expense",
          name: "架空の食費",
          sortOrder: 0,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      [
        {
          categoryId: "c-架空",
          month: "2026-08",
          amount: 30000,
          updatedAt: "2026-08-01T00:00:00.000Z",
        },
      ],
      "2026-09",
    );
    expect(result).toEqual([
      {
        categoryId: "c-架空",
        month: "2026-09",
        amount: 30000,
        source: { kind: "carried", from: "2026-08" },
      },
    ]);
  });

  it("C3 の型は公開窓口から使える（newer-version と validation の line を含む）", async () => {
    const errors: OperationError[] = [
      { kind: "newer-version" },
      { kind: "validation", errors: [], line: 3 },
    ];
    const usage: CategoryUsage = { transactions: 0, budgets: 2 };
    // node 環境には IndexedDB がないため、既定の保存では unavailable になる。
    const opened: BookOpenResult = await core.openBook();
    const book: Book | undefined = opened.status === "ready" ? opened.book : undefined;
    expect(errors).toHaveLength(2);
    expect(usage.budgets).toBe(2);
    expect(opened).toEqual({ status: "unavailable" });
    expect(book).toBeUndefined();
  });
});
