// 書き出し（US6.1〜US6.3、BR1.1〜BR1.5、AC6.1.1〜AC6.3.1）。テストを先に書く（CSV 変換のレイヤー）。
import { describe, expect, it } from "vitest";
import type { Book } from "../bookkeeping-core";
import { exportTransactions } from "./export";
import { addFakeTransaction, memoryBook, overrideBook } from "./test-fixtures";

const BOM_BYTES = [0xef, 0xbb, 0xbf];
const HEADER = "date,type,category,amount,memo";
const BOM = String.fromCharCode(0xfeff);

async function blobText(blob: Blob): Promise<string> {
  // BOM を残して読む（書き出したバイト列をそのまま確かめるため）。
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
    await blob.arrayBuffer(),
  );
}

/** 架空の収支3件（日付の順をばらばらに追加する）。 */
async function seededBook(): Promise<Book> {
  const { book } = await memoryBook();
  await addFakeTransaction(book, {
    date: "2026-10-05",
    type: "expense",
    categoryName: "食費",
    amount: "1200",
    memo: "架空のランチ",
  });
  await addFakeTransaction(book, {
    date: "2026-09-20",
    type: "income",
    categoryName: "給与",
    amount: "250000",
    memo: "架空の給与",
  });
  await addFakeTransaction(book, {
    date: "2026-10-01",
    type: "expense",
    categoryName: "交通費",
    amount: "480",
    memo: "",
  });
  return book;
}

describe("exportTransactions のファイル名（BR1.2）", () => {
  it("全期間は today の地方時の日付（YYYYMMDD）を使う", async () => {
    const book = await seededBook();
    const late = await exportTransactions(book, "all", new Date(2026, 9, 16, 23, 59, 59));
    expect(late.ok && late.value.fileName).toBe("budget-transactions-20261016.csv");
    const padded = await exportTransactions(book, "all", new Date(2027, 0, 5, 0, 0, 0));
    expect(padded.ok && padded.value.fileName).toBe("budget-transactions-20270105.csv");
  });

  it("月指定はその月（YYYY-MM）を使い、その月の収支だけを書き出す", async () => {
    const book = await seededBook();
    const result = await exportTransactions(book, { month: "2026-09" }, new Date(2026, 9, 16));
    expect(result.ok && result.value.fileName).toBe("budget-transactions-2026-09.csv");
    expect(result.ok && result.value.count).toBe(1);
    const text = result.ok ? await blobText(result.value.blob) : "";
    expect(text).toBe(`${BOM}${HEADER}\r\n2026-09-20,income,給与,250000,架空の給与\r\n`);
  });
});

describe("exportTransactions の中身（BR1.1）", () => {
  it("日付の古い順に、BOM 付き・CRLF・見出し行つきで書き出す", async () => {
    const book = await seededBook();
    const result = await exportTransactions(book, "all", new Date(2026, 9, 16));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.count).toBe(3);
    expect(result.value.headerOnly).toBe(false);
    expect(result.value.blob.type).toBe("text/csv;charset=utf-8");
    const bytes = new Uint8Array(await result.value.blob.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual(BOM_BYTES);
    expect(await blobText(result.value.blob)).toBe(
      [
        `${BOM}${HEADER}`,
        "2026-09-20,income,給与,250000,架空の給与",
        "2026-10-01,expense,交通費,480,",
        "2026-10-05,expense,食費,1200,架空のランチ",
        "",
      ].join("\r\n"),
    );
  });

  it("数式として解釈されうるメモ（= + - @ と ' の後のそれら）の先頭に ' を1つだけ付ける（BR1.4）", async () => {
    const { book } = await memoryBook();
    const memos = ["=SUM(A1)", "+1", "-1", "@x", "'=1"];
    for (const [i, memo] of memos.entries()) {
      await addFakeTransaction(book, {
        date: `2026-10-0${i + 1}`,
        type: "expense",
        categoryName: "娯楽",
        amount: "100",
        memo,
      });
    }
    const result = await exportTransactions(book, "all", new Date(2026, 9, 16));
    const lines = (result.ok ? await blobText(result.value.blob) : "").split("\r\n").slice(1, 6);
    expect(lines.map((line) => line.split(",")[4])).toEqual([
      "'=SUM(A1)",
      "'+1",
      "'-1",
      "'@x",
      "''=1",
    ]);
  });

  it("カンマ・ダブルクォート・改行を含むメモは RFC 4180 の引用で書き出す", async () => {
    const { book } = await memoryBook();
    await addFakeTransaction(book, {
      date: "2026-10-02",
      type: "expense",
      categoryName: "日用品",
      amount: "300",
      memo: '架空,"引用"\n改行',
    });
    const result = await exportTransactions(book, "all", new Date(2026, 9, 16));
    expect(result.ok ? await blobText(result.value.blob) : "").toBe(
      `${BOM}${HEADER}\r\n2026-10-02,expense,日用品,300,"架空,""引用""\n改行"\r\n`,
    );
  });
});

describe("exportTransactions の空データと失敗（BR1.3、BR1.5）", () => {
  it("収支が0件なら見出し行だけのファイルを作り、headerOnly を true にする", async () => {
    const { book } = await memoryBook();
    const result = await exportTransactions(book, "all", new Date(2026, 9, 16));
    expect(result.ok && { count: result.value.count, headerOnly: result.value.headerOnly }).toEqual(
      { count: 0, headerOnly: true },
    );
    expect(result.ok ? await blobText(result.value.blob) : "").toBe(`${BOM}${HEADER}\r\n`);
  });

  it("U4 の失敗（読み取りの失敗・月の誤り）はそのまま返す", async () => {
    const { book, storage } = await memoryBook();
    const badMonth = await exportTransactions(book, { month: "2026-13" }, new Date(2026, 9, 16));
    expect(badMonth).toEqual(await book.listAllTransactions({ month: "2026-13" }));
    expect(!badMonth.ok && badMonth.error.kind).toBe("validation");

    storage.failReads = true;
    const failed = await exportTransactions(book, "all", new Date(2026, 9, 16));
    expect(failed).toEqual(await book.listAllTransactions("all"));
    expect(!failed.ok && failed.error.kind).toBe("storage");
  });

  it("カテゴリの読み取りだけが失敗しても、そのまま返す", async () => {
    const base = await seededBook();
    const failure = { ok: false, error: { kind: "storage", message: "架空の失敗" } } as const;
    const book = overrideBook(base, { listCategories: () => Promise.resolve(failure) });
    expect(await exportTransactions(book, "all", new Date(2026, 9, 16))).toEqual(failure);
  });

  it("カテゴリを引けない収支があれば、書き出しを止めて category-missing を返す", async () => {
    const base = await seededBook();
    const book = overrideBook(base, {
      listCategories: () => Promise.resolve({ ok: true, value: [] }),
    });
    expect(await exportTransactions(book, "all", new Date(2026, 9, 16))).toEqual({
      ok: false,
      error: { kind: "rule", violation: { code: "category-missing" } },
    });
  });
});
