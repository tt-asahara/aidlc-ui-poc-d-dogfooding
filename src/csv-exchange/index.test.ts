// 公開窓口と想定外の例外の変換（C5、BR5.2、NFR4.3、security-design.md 第4章）。テストを先に書く。
import { describe, expect, it } from "vitest";
import * as csvExchange from "./index";
import { commitImport, exportTransactions, parseImportFile } from "./index";
import { csvFile, csvText, memoryBook, throwingBook, unwrap } from "./test-fixtures";
import type { ImportPreview } from "./types";

const ROWS = csvText(["2026-10-01,expense,食費,100,架空"]);

describe("公開窓口（C5）", () => {
  it("書き出し・読み込み・確定の3つの関数だけを公開する", () => {
    expect(Object.keys(csvExchange).sort()).toEqual([
      "commitImport",
      "exportTransactions",
      "parseImportFile",
    ]);
    expect(typeof exportTransactions).toBe("function");
    expect(typeof parseImportFile).toBe("function");
    expect(typeof commitImport).toBe("function");
  });
});

describe("parseImportFile の想定外の例外", () => {
  it("ファイルの読み取りでの例外は read-failed（読み込めない文言）", async () => {
    const { book } = await memoryBook();
    // 大きさを読むだけで例外を投げる、壊れたファイルの代わり。
    const broken = {
      get size(): number {
        throw new Error("架空の想定外の例外");
      },
      name: "架空の壊れたファイル.csv",
    } as unknown as File;
    expect(await parseImportFile(book, broken)).toEqual({
      ok: false,
      error: { kind: "read-failed", message: "ファイルを読み込めませんでした" },
    });
  });

  it("Book の呼び出しでの例外は storage（読み込めない文言）", async () => {
    const { book: base } = await memoryBook();
    for (const method of ["listCategories", "listAllTransactions"] as const) {
      const book = throwingBook(base, [method]);
      expect(await parseImportFile(book, csvFile(ROWS))).toEqual({
        ok: false,
        error: { kind: "storage", message: "データを読み込めませんでした" },
      });
    }
  });
});

describe("exportTransactions の想定外の例外", () => {
  it("Book の呼び出しでの例外は storage（書き出せない文言）", async () => {
    const { book: base } = await memoryBook();
    const book = throwingBook(base, ["listAllTransactions"]);
    expect(await exportTransactions(book, "all", new Date(2026, 9, 16))).toEqual({
      ok: false,
      error: { kind: "storage", message: "書き出せませんでした" },
    });
  });
});

describe("commitImport の想定外の例外", () => {
  it("Book の呼び出しでの例外は storage（保存できない文言）で、1件も増えない", async () => {
    const { book: base } = await memoryBook();
    const preview = unwrap(await parseImportFile(base, csvFile(ROWS)));
    const book = throwingBook(base, ["importTransactions"]);
    expect(await commitImport(book, preview)).toEqual({
      ok: false,
      error: { kind: "storage", message: "保存できませんでした" },
    });
    expect(unwrap(await base.listAllTransactions("all"))).toEqual([]);
  });

  it("形の壊れたプレビューを渡されても例外を投げず storage を返す", async () => {
    const { book } = await memoryBook();
    const broken = {
      fileName: "架空.csv",
      validRows: null,
      invalidRows: [],
    } as unknown as ImportPreview;
    expect(await commitImport(book, broken)).toEqual({
      ok: false,
      error: { kind: "storage", message: "保存できませんでした" },
    });
  });
});
