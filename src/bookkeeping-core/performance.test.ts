// 性能の目安（NFR3.1、security-design.md 8.3 節）。fake-indexeddb 上の時間は実ブラウザの値ではなく、
// U4 の層の大きな遅れを見つけるための目安とする。測定値は出力に記録する。
// 前提は NFR3 に合わせる: 架空の収支 5,000 件（12か月に均等）、カテゴリ 30 件（支出 24・収入 6）、予算 360 件（支出 24 件 × 15 か月）。
// 判定: 読み取りは1回の空回しの後に5回測った中央値、取り込みは1回。合格条件は設計どおりで、不安定でも緩めない。
import { describe, expect, it } from "vitest";
import type { Category } from "../data-contract";
import {
  fakeInput,
  idbOpener,
  monthsOf,
  newFactory,
  readyBook,
  uniqueDbName,
} from "./test-fixtures";
import type { Book, ImportRow } from "./types";

const READ_LIMIT_MS = 200;
const IMPORT_LIMIT_MS = 3000;
const TEST_TIMEOUT_MS = 60_000;
const MONTHS = monthsOf(2026, 12);
const BUDGET_MONTHS = monthsOf(2025, 15);

async function measure<T>(work: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const start = performance.now();
  const value = await work();
  return { value, ms: performance.now() - start };
}

/** 1回の空回しの後に5回測り、中央値と各回の値を返す。 */
async function medianOf(work: () => Promise<void>): Promise<{ median: number; runs: number[] }> {
  await work();
  const runs: number[] = [];
  for (let i = 0; i < 5; i++) runs.push((await measure(work)).ms);
  const sorted = [...runs].sort((a, b) => a - b);
  return { median: sorted[2] ?? Number.NaN, runs };
}

function format(ms: number): string {
  return `${ms.toFixed(1)}ms`;
}

/** 初期カテゴリ10件（支出7・収入3）に、架空のカテゴリを足して支出24・収入6にする。 */
async function addCategoriesTo30(book: Book): Promise<Category[]> {
  for (let i = 1; i <= 17; i++) await book.addCategory("expense", `架空の支出${i}`);
  for (let i = 1; i <= 3; i++) await book.addCategory("income", `架空の収入${i}`);
  const listed = await book.listCategories();
  if (!listed.ok) throw new Error("カテゴリを読めませんでした");
  return listed.value;
}

/** 決まった規則で作った架空の取り込み行（乱数を使わない）。line は 2 から始まる。 */
function importRows(count: number, categories: readonly Category[]): ImportRow[] {
  return Array.from({ length: count }, (_, i) => {
    const category = categories[i % categories.length] as Category;
    const month = MONTHS[i % MONTHS.length] ?? "2026-01";
    return {
      line: i + 2,
      input: fakeInput({
        date: `${month}-${String((i % 28) + 1).padStart(2, "0")}`,
        type: category.type,
        categoryId: category.id,
        amount: 100 + (i % 50) * 10,
        memo: `架空の明細 ${i}`,
      }),
    };
  });
}

async function seededBook(): Promise<Book> {
  const book = await readyBook({ storage: idbOpener(newFactory(), uniqueDbName()) });
  const categories = await addCategoriesTo30(book);
  const expenses = categories.filter((c) => c.type === "expense");
  for (const category of expenses) {
    for (const [i, month] of BUDGET_MONTHS.entries()) {
      const set = await book.setBudget(category.id, month, 10000 + i * 100);
      if (!set.ok) throw new Error("予算を設定できませんでした");
    }
  }
  const imported = await book.importTransactions(importRows(5000, categories));
  if (!imported.ok) throw new Error("収支を用意できませんでした");
  return book;
}

describe("性能の目安（fake-indexeddb、NFR3 の前提件数）", () => {
  it(
    "listTransactions（1か月分）＋ getEffectiveBudgets と getCategoryUsage の中央値がそれぞれ 200ms 以内",
    async () => {
      const book = await seededBook();
      const usageCheck = await book.getCategoryUsage();
      const budgetsCheck = await book.getEffectiveBudgets("2026-06");
      const monthCheck = await book.listTransactions("2026-06");
      expect(usageCheck.ok && Object.keys(usageCheck.value)).toHaveLength(30);
      expect(budgetsCheck.ok && budgetsCheck.value).toHaveLength(24);
      expect(monthCheck.ok && monthCheck.value.length).toBeGreaterThan(400);

      const monthView = await medianOf(async () => {
        const [listed, budgets] = await Promise.all([
          book.listTransactions("2026-06"),
          book.getEffectiveBudgets("2026-06"),
        ]);
        if (!listed.ok || !budgets.ok) throw new Error("読み取りに失敗しました");
      });
      const usage = await medianOf(async () => {
        const result = await book.getCategoryUsage();
        if (!result.ok) throw new Error("読み取りに失敗しました");
      });
      console.info(
        `[性能] listTransactions＋getEffectiveBudgets 中央値 ${format(monthView.median)}（各回 ${monthView.runs.map(format).join(", ")}）` +
          ` / getCategoryUsage 中央値 ${format(usage.median)}（各回 ${usage.runs.map(format).join(", ")}）`,
      );
      expect(monthView.median).toBeLessThan(READ_LIMIT_MS);
      expect(usage.median).toBeLessThan(READ_LIMIT_MS);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "取り込み 5,000 行（上限）を1回で 3,000ms 以内に確定し、最後の行のカテゴリがなければ1件も増えない",
    async () => {
      const book = await readyBook({ storage: idbOpener(newFactory(), uniqueDbName()) });
      const categories = await addCategoriesTo30(book);
      const rows = importRows(5000, categories);
      const imported = await measure(() => book.importTransactions(rows));
      expect(imported.value).toEqual({ ok: true, value: { added: 5000 } });

      const broken = importRows(5000, categories).map((row, i) =>
        i === 4999 ? { ...row, input: { ...row.input, categoryId: "c-消えた" } } : row,
      );
      const rejected = await measure(() => book.importTransactions(broken));
      console.info(
        `[性能] 取り込み 5,000 行: ${format(imported.ms)} / 最後の行のカテゴリなし（拒否）: ${format(rejected.ms)}`,
      );
      expect(imported.ms).toBeLessThan(IMPORT_LIMIT_MS);
      expect(rejected.value).toEqual({
        ok: false,
        error: { kind: "rule", violation: { code: "import-category-missing", lines: [5001] } },
      });
      const all = await book.listAllTransactions("all");
      expect(all.ok && all.value).toHaveLength(5000);
    },
    TEST_TIMEOUT_MS,
  );
});
