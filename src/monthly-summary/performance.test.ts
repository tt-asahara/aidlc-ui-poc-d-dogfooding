// 性能の目安（NFR3.1、security-design.md 5.3 節）。fake-indexeddb 上の時間は実ブラウザの値ではなく、
// U5 の層の大きな遅れを見つけるための目安とする。本物の IndexedDB と Chrome での合計 500ms は U7 の Build and Test で確かめる。
// 前提は NFR3 に合わせる: 架空の収支 5,000 件（12か月に均等）、カテゴリ 30 件（支出 24・収入 6）、予算 360 件（支出 24 件 × 15 か月）。
// 判定: 1回の空回しの後に測った中央値。合格条件は設計どおりで、不安定でも緩めない。測定値と実行環境は出力に記録する。
import { cpus, platform, release } from "node:os";
import { describe, expect, it } from "vitest";
import type { Category, Transaction } from "../data-contract";
import type { Book, EffectiveBudget, ImportRow } from "../bookkeeping-core";
import { computeMonthlySummary } from "./compute";
import { getMonthlySummary } from "./getMonthlySummary";
import { fakeInput, idbOpener, monthsOf, newFactory, uniqueDbName } from "./test-fixtures";
import { openBook } from "../bookkeeping-core";

// しきい値と測定回数はここ1か所にまとめる（変更するときは設計の更新が先）。
const GET_LIMIT_MS = 250;
const COMPUTE_LIMIT_MS = 20;
const WARMUP_RUNS = 1;
const MEASURED_RUNS = 5;
const TEST_TIMEOUT_MS = 60_000;
const TARGET_MONTH = "2026-06";
const MONTHS = monthsOf(2026, 12);
const BUDGET_MONTHS = monthsOf(2025, 15);

function environmentLine(): string {
  const cpu = cpus()[0]?.model ?? "不明";
  return `Node.js ${process.version} / ${platform()} ${release()} / CPU ${cpu}（${cpus().length}コア）`;
}

function format(ms: number): string {
  return `${ms.toFixed(1)}ms`;
}

/** 空回しの後に MEASURED_RUNS 回測り、中央値と各回の値を返す。 */
async function medianOf(work: () => unknown): Promise<{ median: number; runs: number[] }> {
  for (let i = 0; i < WARMUP_RUNS; i++) await work();
  const runs: number[] = [];
  for (let i = 0; i < MEASURED_RUNS; i++) {
    const start = performance.now();
    await work();
    runs.push(performance.now() - start);
  }
  const sorted = [...runs].sort((a, b) => a - b);
  return { median: sorted[Math.floor(sorted.length / 2)] ?? Number.NaN, runs };
}

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

/** fake-indexeddb の本物の保存に、決まった規則（乱数なし）で作った架空のデータを入れる。 */
async function seededBook(): Promise<{ book: Book; categories: Category[] }> {
  const opened = await openBook({ storage: idbOpener(newFactory(), uniqueDbName()) });
  if (opened.status !== "ready") throw new Error(`家計簿を開けませんでした: ${opened.status}`);
  const book = opened.book;
  // 初期カテゴリ 10 件（支出 7・収入 3）に足して、支出 24・収入 6 にする。
  for (let i = 1; i <= 17; i++) await book.addCategory("expense", `架空の支出${i}`);
  for (let i = 1; i <= 3; i++) await book.addCategory("income", `架空の収入${i}`);
  const listed = await book.listCategories();
  if (!listed.ok) throw new Error("カテゴリを読めませんでした");
  for (const category of listed.value.filter((c) => c.type === "expense")) {
    for (const [i, month] of BUDGET_MONTHS.entries()) {
      const set = await book.setBudget(category.id, month, 10000 + i * 100);
      if (!set.ok) throw new Error("予算を設定できませんでした");
    }
  }
  const imported = await book.importTransactions(importRows(5000, listed.value));
  if (!imported.ok) throw new Error("収支を用意できませんでした");
  return { book, categories: listed.value };
}

describe("性能の目安（fake-indexeddb、NFR3 の前提件数）", () => {
  it(
    `getMonthlySummary の中央値が ${GET_LIMIT_MS}ms 以内、computeMonthlySummary（同じ件数の配列）の中央値が ${COMPUTE_LIMIT_MS}ms 以内`,
    async () => {
      const { book, categories } = await seededBook();

      // 前提の件数を確かめる（件数が違えば測定が意味を失う）。
      const all = await book.listAllTransactions("all");
      const budgets = await book.getEffectiveBudgets(TARGET_MONTH);
      if (!all.ok || !budgets.ok) throw new Error("前提のデータを読めませんでした");
      expect(categories).toHaveLength(30);
      expect(all.value).toHaveLength(5000);
      expect(budgets.value).toHaveLength(24);
      const transactions: Transaction[] = all.value;
      const effective: EffectiveBudget[] = budgets.value;

      const checked = await getMonthlySummary(book, TARGET_MONTH);
      expect(checked.ok && checked.value.expenseRows).toHaveLength(24);
      expect(checked.ok && checked.value.incomeRows).toHaveLength(6);
      expect(checked.ok && checked.value.hasTransactions).toBe(true);

      const get = await medianOf(async () => {
        const result = await getMonthlySummary(book, TARGET_MONTH);
        if (!result.ok) throw new Error("集計の取得に失敗しました");
      });
      const compute = await medianOf(() =>
        computeMonthlySummary({
          month: TARGET_MONTH,
          transactions,
          categories,
          budgets: effective,
        }),
      );
      console.info(
        `[性能] 実行環境: ${environmentLine()}\n` +
          `[性能] 前提: 収支 5,000 件・カテゴリ 30 件・予算 360 件、空回し ${WARMUP_RUNS} 回の後に ${MEASURED_RUNS} 回の中央値\n` +
          `[性能] getMonthlySummary 中央値 ${format(get.median)}（各回 ${get.runs.map(format).join(", ")}）しきい値 ${GET_LIMIT_MS}ms\n` +
          `[性能] computeMonthlySummary 中央値 ${format(compute.median)}（各回 ${compute.runs.map(format).join(", ")}）しきい値 ${COMPUTE_LIMIT_MS}ms`,
      );
      expect(get.median).toBeLessThan(GET_LIMIT_MS);
      expect(compute.median).toBeLessThan(COMPUTE_LIMIT_MS);
    },
    TEST_TIMEOUT_MS,
  );
});
