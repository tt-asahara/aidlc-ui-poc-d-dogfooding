// 取り込みの確定（US7.2、US7.4、US6.2、BR4.1〜BR4.3、NFR4.1、AC7.2.1〜AC7.2.4、AC6.2.2、AC6.2.3）。
// テストを先に書く（CSV 変換のレイヤー）。U7 が使う公開窓口を通して確かめる。
import { describe, expect, it } from "vitest";
import type { Book, ImportRow } from "../bookkeeping-core";
import { commitImport, exportTransactions, parseImportFile } from "./index";
import {
  addFakeTransaction,
  categoryNamed,
  csvFile,
  csvText,
  memoryBook,
  overrideBook,
  unwrap,
} from "./test-fixtures";
import type { ImportPreview } from "./types";

/** 収支を比べやすい形（カテゴリは名前）にする。登録日時と id は比べない。 */
async function contentOf(book: Book): Promise<string[][]> {
  const categories = new Map(unwrap(await book.listCategories()).map((c) => [c.id, c.name]));
  return unwrap(await book.listAllTransactions("all")).map((t) => [
    t.date,
    t.type,
    categories.get(t.categoryId) ?? "(なし)",
    String(t.amount),
    t.memo,
  ]);
}

async function previewOf(book: Book, rows: readonly string[]): Promise<ImportPreview> {
  return unwrap(await parseImportFile(book, csvFile(csvText(rows))));
}

/** importTransactions に渡された行を記録する Book。 */
function recordingBook(base: Book): { book: Book; calls: ImportRow[][] } {
  const calls: ImportRow[][] = [];
  const book = overrideBook(base, {
    importTransactions: (rows) => {
      calls.push([...rows]);
      return base.importTransactions(rows);
    },
  });
  return { book, calls };
}

describe("commitImport（BR4.1）", () => {
  it("取り込める行をすべて追加し、件数を返す（AC7.2.1）", async () => {
    const { book } = await memoryBook();
    const preview = await previewOf(book, [
      "2026-10-01,expense,食費,1200,架空のランチ",
      "2026-10-02,income,給与,250000,架空の給与",
    ]);
    expect(await commitImport(book, preview)).toEqual({ ok: true, value: { added: 2 } });
    expect(await contentOf(book)).toEqual([
      ["2026-10-01", "expense", "食費", "1200", "架空のランチ"],
      ["2026-10-02", "income", "給与", "250000", "架空の給与"],
    ]);
  });

  it("U4 には取り込める行だけを、行番号とプレビュー時点のカテゴリ id で1回だけ渡す", async () => {
    const { book: base } = await memoryBook();
    const { book, calls } = recordingBook(base);
    const food = await categoryNamed(base, "食費");
    const preview = await previewOf(book, [
      "2026-10-01,expense,食費,100,架空1",
      "2026-10-02,expense,食費,abc,架空2",
      "2026-10-03,expense,食費,300,架空3",
    ]);
    expect(await commitImport(book, preview)).toEqual({ ok: true, value: { added: 2 } });
    expect(calls).toEqual([
      [
        {
          line: 2,
          input: {
            date: "2026-10-01",
            type: "expense",
            categoryId: food.id,
            amount: 100,
            memo: "架空1",
          },
        },
        {
          line: 4,
          input: {
            date: "2026-10-03",
            type: "expense",
            categoryId: food.id,
            amount: 300,
            memo: "架空3",
          },
        },
      ],
    ]);
  });

  it("既存と同じ内容の行も除外せずに追加する（AC7.4.2）", async () => {
    const { book } = await memoryBook();
    await addFakeTransaction(book, {
      date: "2026-10-01",
      type: "expense",
      categoryName: "食費",
      amount: "100",
      memo: "架空",
    });
    const preview = await previewOf(book, ["2026-10-01,expense,食費,100,架空"]);
    expect(preview.validRows[0]?.sameAsExisting).toBe(true);
    expect(await commitImport(book, preview)).toEqual({ ok: true, value: { added: 1 } });
    expect(await contentOf(book)).toHaveLength(2);
  });

  it("取り込める行が0件なら U4 を呼ばずに { added: 0 } を返す", async () => {
    const { book: base } = await memoryBook();
    const { book, calls } = recordingBook(base);
    const preview = await previewOf(book, ["2026-10-01,expense,食費,abc,架空"]);
    expect(preview.validRows).toEqual([]);
    expect(await commitImport(book, preview)).toEqual({ ok: true, value: { added: 0 } });
    expect(calls).toEqual([]);
  });
});

describe("commitImport の失敗（BR4.2、NFR4.1）", () => {
  it("保存に失敗したら storage を返し、1件も増えない（AC7.2.3）", async () => {
    const { book, storage } = await memoryBook();
    const preview = await previewOf(book, [
      "2026-10-01,expense,食費,100,架空1",
      "2026-10-02,expense,食費,200,架空2",
    ]);
    storage.failWrites = true;
    const result = await commitImport(book, preview);
    expect(!result.ok && result.error.kind).toBe("storage");
    storage.failWrites = false;
    expect(await contentOf(book)).toEqual([]);
  });

  it("プレビューの後にカテゴリが消えたら import-category-missing（行番号つき）を返し、1件も増えない", async () => {
    const { book } = await memoryBook();
    const temporary = unwrap(await book.addCategory("expense", "架空の臨時"));
    const preview = await previewOf(book, [
      "2026-10-01,expense,食費,100,架空1",
      "2026-10-02,expense,架空の臨時,200,架空2",
      "2026-10-03,expense,架空の臨時,300,架空3",
    ]);
    // 別のタブでの削除の再現（収支から使われていないカテゴリなので消せる）。
    unwrap(await book.deleteCategory(temporary.id));
    expect(await commitImport(book, preview)).toEqual({
      ok: false,
      error: { kind: "rule", violation: { code: "import-category-missing", lines: [3, 4] } },
    });
    expect(await contentOf(book)).toEqual([]);
  });

  it("プレビューの後にカテゴリの名前が変わっただけなら、取り込みは成功する（プレビューの名前だけが古い）", async () => {
    const { book } = await memoryBook();
    const preview = await previewOf(book, ["2026-10-01,expense,娯楽,800,架空の映画"]);
    const fun = await categoryNamed(book, "娯楽");
    unwrap(await book.renameCategory(fun.id, "架空の趣味"));
    expect(preview.validRows[0]?.categoryName).toBe("娯楽");
    expect(await commitImport(book, preview)).toEqual({ ok: true, value: { added: 1 } });
    expect(await contentOf(book)).toEqual([
      ["2026-10-01", "expense", "架空の趣味", "800", "架空の映画"],
    ]);
  });
});

describe("書き出しと取り込みの往復（AC7.2.4、AC6.2.2、AC6.2.3）", () => {
  it("書き出したファイルを空のアプリに取り込むと同じ内容になる（数式対策・カンマ・ダブルクォート・改行を含む）", async () => {
    const { book: source } = await memoryBook({ idPrefix: "src-" });
    const memos = ["架空のランチ", "=SUM(A1)", "+1", "-1", "@x", "'=1", '架空,"引用"\n改行', ""];
    for (const [i, memo] of memos.entries()) {
      await addFakeTransaction(source, {
        date: `2026-09-${String(i + 10)}`,
        type: i % 3 === 0 ? "income" : "expense",
        categoryName: i % 3 === 0 ? "給与" : "食費",
        amount: String(1000 + i),
        memo,
      });
    }
    const exported = unwrap(await exportTransactions(source, "all", new Date(2026, 9, 16)));
    const file = new File([exported.blob], exported.fileName, { type: exported.blob.type });

    const { book: target } = await memoryBook({ idPrefix: "dst-" });
    const preview = unwrap(await parseImportFile(target, file));
    expect(preview.invalidRows).toEqual([]);
    expect(preview.validRows.map((r) => r.memo)).toEqual(memos);
    expect(await commitImport(target, preview)).toEqual({
      ok: true,
      value: { added: memos.length },
    });
    expect(await contentOf(target)).toEqual(await contentOf(source));
  });
});
