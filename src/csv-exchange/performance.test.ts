// 性能の目安（NFR3.1、NFR3.2、security-design.md 6.3 節）。fake-indexeddb ではなく U3 の差し替えの上で測る。
// 値は U6 の層の大きな遅れを見つけるための目安で、読み込みからプレビューの表示まで 2 秒の合計（本物の IndexedDB と
// Chrome）は U7 の Build and Test で確かめる。測定値と実行環境（Node.js の版、OS、CPU）を出力に記録する。
// 前提: 架空の収支 5,000 件（12か月に均等）、カテゴリ 30 件（支出 24・収入 6）。乱数は使わない。
// 合格条件は設計どおりで、不安定でも緩めない。
import { arch, cpus, platform, release } from "node:os";
import { beforeAll, describe, expect, it } from "vitest";
import type { Book } from "../bookkeeping-core";
import type { Category } from "../data-contract";
import { exportTransactions, parseImportFile } from "./index";
import { addCategoriesTo30, csvFile, fakeImportRows, memoryBook, unwrap } from "./test-fixtures";

// ---- しきい値と測定回数（この1か所で管理する） ----
const PARSE_LIMIT_MS = 1000;
const EXPORT_LIMIT_MS = 1000;
const TOO_MANY_ROWS_LIMIT_MS = 500;
const WARMUP_RUNS = 1;
const PARSE_RUNS = 5;
const EXPORT_RUNS = 5;
const TOO_MANY_ROWS_RUNS = 3;
const ROW_COUNT = 5000;
const MAX_FILE_BYTES = 1_048_576;
const SETUP_TIMEOUT_MS = 60_000;
const TEST_TIMEOUT_MS = 60_000;

const HEADER = "date,type,category,amount,memo";

function environment(): string {
  const cpu = cpus()[0]?.model ?? "不明";
  return `Node.js ${process.version}、${platform()} ${release()}（${arch()}）、CPU ${cpu} × ${cpus().length}`;
}

function format(ms: number): string {
  return `${ms.toFixed(1)}ms`;
}

/** 空回しの後に指定の回数だけ測り、中央値と各回の値を返す。 */
async function medianOf(
  runs: number,
  work: () => Promise<void>,
): Promise<{ median: number; values: number[] }> {
  for (let i = 0; i < WARMUP_RUNS; i++) await work();
  const values: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    await work();
    values.push(performance.now() - start);
  }
  const sorted = [...values].sort((a, b) => a - b);
  return { median: sorted[Math.floor(sorted.length / 2)] ?? Number.NaN, values };
}

function report(label: string, result: { median: number; values: number[] }, limit: number): void {
  console.info(
    `[性能] ${label}: 中央値 ${format(result.median)}（各回 ${result.values.map(format).join(", ")}、` +
      `合格条件 ${limit}ms 以内）／ 環境: ${environment()}`,
  );
}

/** 架空の収支 5,000 行の CSV（既存と同じ規則の値。カテゴリは 30 件を順に使う）。 */
function importCsv(categories: readonly Category[]): string {
  const rows = fakeImportRows(ROW_COUNT, categories).map((row) => {
    const category = categories.find((c) => c.id === row.input.categoryId) as Category;
    return [
      row.input.date,
      row.input.type,
      category.name,
      String(row.input.amount),
      `${row.input.memo} 取り込み`,
    ].join(",");
  });
  return [HEADER, ...rows].join("\r\n") + "\r\n";
}

/** 最小の行（,,,,）を 1MB に近づくまで並べた CSV（too-many-rows の最悪の時間）。 */
function minimalRowsCsv(): string {
  const row = ",,,,\r\n";
  const count = Math.floor((MAX_FILE_BYTES - (HEADER.length + 2)) / row.length);
  return `${HEADER}\r\n${row.repeat(count)}`;
}

let book: Book;
let categories: Category[];

beforeAll(async () => {
  ({ book } = await memoryBook());
  categories = await addCategoriesTo30(book);
  unwrap(await book.importTransactions(fakeImportRows(ROW_COUNT, categories)));
}, SETUP_TIMEOUT_MS);

describe("性能の目安（U3 の差し替え、NFR3 の前提件数）", () => {
  it(
    `parseImportFile（5,000 行、既存 5,000 件・カテゴリ 30 件）の中央値が ${PARSE_LIMIT_MS}ms 以内`,
    async () => {
      expect(categories).toHaveLength(30);
      const text = importCsv(categories);
      const check = unwrap(await parseImportFile(book, csvFile(text)));
      expect(check.validRows).toHaveLength(ROW_COUNT);
      expect(check.invalidRows).toEqual([]);

      const result = await medianOf(PARSE_RUNS, async () => {
        const parsed = await parseImportFile(book, csvFile(text));
        if (!parsed.ok) throw new Error("読み込みに失敗しました");
      });
      report(`parseImportFile 5,000 行（${text.length} 文字）`, result, PARSE_LIMIT_MS);
      expect(result.median).toBeLessThan(PARSE_LIMIT_MS);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    `exportTransactions（5,000 件）の中央値が ${EXPORT_LIMIT_MS}ms 以内`,
    async () => {
      const check = unwrap(await exportTransactions(book, "all", new Date(2026, 9, 16)));
      expect(check.count).toBe(ROW_COUNT);

      const result = await medianOf(EXPORT_RUNS, async () => {
        const exported = await exportTransactions(book, "all", new Date(2026, 9, 16));
        if (!exported.ok) throw new Error("書き出しに失敗しました");
      });
      report("exportTransactions 5,000 件", result, EXPORT_LIMIT_MS);
      expect(result.median).toBeLessThan(EXPORT_LIMIT_MS);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    `1MB に近い最小の行の CSV で too-many-rows を返すまでの中央値が ${TOO_MANY_ROWS_LIMIT_MS}ms 以内`,
    async () => {
      const text = minimalRowsCsv();
      const bytes = new TextEncoder().encode(text).length;
      expect(bytes).toBeLessThanOrEqual(MAX_FILE_BYTES);
      expect(bytes).toBeGreaterThan(MAX_FILE_BYTES - 8);
      expect(await parseImportFile(book, csvFile(text))).toEqual({
        ok: false,
        error: { kind: "too-many-rows", limitRows: 5000 },
      });

      const result = await medianOf(TOO_MANY_ROWS_RUNS, async () => {
        const parsed = await parseImportFile(book, csvFile(text));
        if (parsed.ok || parsed.error.kind !== "too-many-rows") {
          throw new Error("想定と違う結果です");
        }
      });
      report(`too-many-rows（${bytes} バイト）`, result, TOO_MANY_ROWS_LIMIT_MS);
      expect(result.median).toBeLessThan(TOO_MANY_ROWS_LIMIT_MS);
    },
    TEST_TIMEOUT_MS,
  );
});
