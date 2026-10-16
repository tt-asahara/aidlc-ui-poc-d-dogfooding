// 読み込みとプレビュー（US7.1、US7.3、US7.4、BR2.1〜BR2.4、BR3.1〜BR3.8、NFR4.2、NFR4.3、NFR8.2）。
// テストを先に書く（CSV 変換のレイヤー）。U7 が使う公開窓口の parseImportFile を通して確かめる。
import { describe, expect, it } from "vitest";
import type { Book } from "../bookkeeping-core";
import { parseImportFile } from "./index";
import {
  addFakeTransaction,
  bytesFile,
  categoryNamed,
  csvFile,
  csvText,
  memoryBook,
  RejectingFile,
  unwrap,
} from "./test-fixtures";
import type { ImportPreview } from "./types";

const AMOUNT_MESSAGE = "金額：1〜99,999,999 の整数で入力してください";

async function preview(book: Book, file: File): Promise<ImportPreview> {
  return unwrap(await parseImportFile(book, file));
}

/** 決まった規則で作った架空の行（乱数を使わない）。 */
function fakeRows(count: number): string[] {
  return Array.from(
    { length: count },
    (_, i) =>
      `2026-10-${String((i % 28) + 1).padStart(2, "0")},expense,食費,${100 + i},架空の明細${i}`,
  );
}

describe("parseImportFile のファイル全体の理由（BR2.1〜BR2.4、NFR4.3）", () => {
  it("0バイト・空白だけ・見出し行のみのファイルは empty", async () => {
    const { book } = await memoryBook();
    for (const file of [
      bytesFile(new Uint8Array([])),
      csvFile(" \r\n \r\n"),
      csvFile(csvText([])),
      csvFile(csvText([], { bom: true })),
    ]) {
      expect(await parseImportFile(book, file)).toEqual({ ok: false, error: { kind: "empty" } });
    }
  });

  it("見出し行が違うファイルは header-mismatch（付随値は持たない）", async () => {
    const { book } = await memoryBook();
    const file = csvFile("日付,種別,カテゴリ,金額,メモ\r\n2026-10-01,expense,食費,100,架空\r\n");
    expect(await parseImportFile(book, file)).toEqual({
      ok: false,
      error: { kind: "header-mismatch" },
    });
  });

  it("引用が閉じていないファイルは malformed（行番号と U1 の文言）", async () => {
    const { book } = await memoryBook();
    const file = csvFile(
      csvText(["2026-10-01,expense,食費,100,架空", '2026-10-02,expense,食費,200,"架空']),
    );
    expect(await parseImportFile(book, file)).toEqual({
      ok: false,
      error: { kind: "malformed", line: 3, message: "引用が閉じられていません" },
    });
  });

  it("1MB を超えるファイルは too-large、読めないファイルは read-failed", async () => {
    const { book } = await memoryBook();
    const large = csvFile("a".repeat(1_048_577));
    expect(await parseImportFile(book, large)).toEqual({
      ok: false,
      error: { kind: "too-large", limitBytes: 1_048_576 },
    });
    expect(await parseImportFile(book, new RejectingFile())).toEqual({
      ok: false,
      error: { kind: "read-failed", message: "ファイルを読み込めませんでした" },
    });
    expect(
      await parseImportFile(book, bytesFile(new Uint8Array([0xff, 0x2c, 0x0d, 0x0a]))),
    ).toEqual({
      ok: false,
      error: { kind: "read-failed", message: "UTF-8 の CSV ファイルを選んでください" },
    });
  });

  it("見出しを除き 5,000 件は進み、5,001 件は too-many-rows", async () => {
    const { book } = await memoryBook();
    const atLimit = await preview(book, csvFile(csvText(fakeRows(5000))));
    expect(atLimit.validRows).toHaveLength(5000);
    expect(atLimit.invalidRows).toEqual([]);
    expect(await parseImportFile(book, csvFile(csvText(fakeRows(5001))))).toEqual({
      ok: false,
      error: { kind: "too-many-rows", limitRows: 5000 },
    });
  });

  it("引用の中の改行で複数の物理行にまたがるレコードは1件と数える（5,000 件ちょうどは進む）", async () => {
    const { book } = await memoryBook();
    const rows = [...fakeRows(4999), '2026-10-30,expense,食費,999,"架空の\n複数行\nメモ"'];
    const result = await preview(book, csvFile(csvText(rows)));
    expect(result.validRows).toHaveLength(5000);
    expect(result.validRows.at(-1)).toMatchObject({ line: 5001, memo: "架空の\n複数行\nメモ" });
  });
});

describe("parseImportFile の行の検証（BR3.1〜BR3.5、security-design.md 第1章）", () => {
  it("正しい行3件と、3行目の金額が abc の行 → 取り込める行3件、取り込めない行1件（AC7.1.1）", async () => {
    const { book } = await memoryBook();
    const file = csvFile(
      csvText([
        "2026-10-01,expense,食費,1200,架空のランチ",
        "2026-10-02,expense,食費,abc,架空の夕食",
        "2026-10-03,expense,交通費,480,",
        "2026-10-04,income,給与,250000,架空の給与",
      ]),
    );
    const result = await preview(book, file);
    expect(result.validRows.map((r) => r.line)).toEqual([2, 4, 5]);
    expect(result.invalidRows).toEqual([
      {
        line: 3,
        reasons: [AMOUNT_MESSAGE],
        raw: ["2026-10-02", "expense", "食費", "abc", "架空の夕食"],
      },
    ]);
  });

  it("存在しないカテゴリ名の行と、収入なのに支出カテゴリ名の行は取り込めない（AC7.1.2）", async () => {
    const { book } = await memoryBook();
    const file = csvFile(
      csvText(["2026-10-01,expense,架空の存在しない費目,100,", "2026-10-02,income,食費,200,"]),
    );
    const result = await preview(book, file);
    expect(result.validRows).toEqual([]);
    expect(result.invalidRows.map((r) => [r.line, r.reasons])).toEqual([
      [2, ["カテゴリ：見つかりません"]],
      [3, ["カテゴリ：種別と一致しません"]],
    ]);
  });

  it("値の検証に失敗した行の理由は U1 の文言だけで、カテゴリの理由は出さない（NFR Design Q1 = A）", async () => {
    const { book } = await memoryBook();
    const file = csvFile(
      csvText(["2026-10-01,expense,架空の存在しない費目,abc,", "2026-02-30,foo,,0,架空"]),
    );
    const result = await preview(book, file);
    expect(result.invalidRows.map((r) => r.reasons)).toEqual([
      [AMOUNT_MESSAGE],
      [
        "日付：存在する日付を YYYY-MM-DD で入力してください",
        "種別：income（収入）か expense（支出）を指定してください",
        "カテゴリを指定してください",
        AMOUNT_MESSAGE,
      ],
    ]);
  });

  it("列の数が5でない行は、列の数の理由だけで取り込めない（raw は全列）", async () => {
    const { book } = await memoryBook();
    const file = csvFile(
      csvText([
        "2026-10-01,expense,食費,100",
        "2026-10-02,expense,食費,200,架空,余分",
        "2026-10-03,expense,食費,300,架空",
      ]),
    );
    const result = await preview(book, file);
    expect(result.invalidRows).toEqual([
      {
        line: 2,
        reasons: ["列の数が違います（5列にしてください）"],
        raw: ["2026-10-01", "expense", "食費", "100"],
      },
      {
        line: 3,
        reasons: ["列の数が違います（5列にしてください）"],
        raw: ["2026-10-02", "expense", "食費", "200", "架空", "余分"],
      },
    ]);
    expect(result.validRows.map((r) => r.line)).toEqual([4]);
  });

  it("取り込める行は検証済みの値と、照合したカテゴリの id・アプリ側の名前を持つ（全角・大文字小文字の違いを吸収）", async () => {
    const { book } = await memoryBook();
    unwrap(await book.addCategory("expense", "food"));
    const food = await categoryNamed(book, "food");
    const file = csvFile(csvText(['2026-10-01, expense ,ＦＯＯＤ,"1,200",  架空のランチ  ']));
    const result = await preview(book, file);
    expect(result).toEqual({
      fileName: "架空の家計簿.csv",
      validRows: [
        {
          line: 2,
          date: "2026-10-01",
          type: "expense",
          categoryId: food.id,
          categoryName: "food",
          amount: 1200,
          memo: "架空のランチ",
          sameAsExisting: false,
        },
      ],
      invalidRows: [],
    });
  });

  it("取り込めない行の raw はファイル上の値のまま（<script> も数式対策の ' もそのまま）", async () => {
    const { book } = await memoryBook();
    const file = csvFile(csvText(["2026-10-01,expense,<script>alert(1)</script>,abc,'=1"]));
    const result = await preview(book, file);
    expect(result.invalidRows).toEqual([
      {
        line: 2,
        reasons: [AMOUNT_MESSAGE],
        raw: ["2026-10-01", "expense", "<script>alert(1)</script>", "abc", "'=1"],
      },
    ]);
  });

  it("数式対策の ' はプレビューのメモでは外す（AC6.2.2）", async () => {
    const { book } = await memoryBook();
    const file = csvFile(
      csvText(["2026-10-01,expense,食費,100,'=SUM(A1)", "2026-10-02,expense,食費,100,''=1"]),
    );
    const result = await preview(book, file);
    expect(result.validRows.map((r) => r.memo)).toEqual(["=SUM(A1)", "'=1"]);
  });

  it("すべての行が取り込めなくてもプレビューとして返し、行番号の昇順に並べる（BR3.7、BR3.8）", async () => {
    const { book } = await memoryBook();
    const file = csvFile(
      csvText([
        "2026-10-01,expense,食費,abc,",
        "2026-10-02,expense,食費",
        '2026-10-03,expense,"架空\nの費目",1,',
      ]),
      "架空のすべて不正.csv",
    );
    const result = await preview(book, file);
    expect(result.fileName).toBe("架空のすべて不正.csv");
    expect(result.validRows).toEqual([]);
    expect(result.invalidRows.map((r) => r.line)).toEqual([2, 3, 4]);
  });

  it("BOM 付き・LF 区切りのファイルも同じように読み込む", async () => {
    const { book } = await memoryBook();
    const bom = String.fromCharCode(0xfeff);
    const file = csvFile(
      `${bom}date,type,category,amount,memo\n2026-10-01,income,給与,1000,架空\n`,
    );
    const result = await preview(book, file);
    expect(result.validRows.map((r) => [r.line, r.categoryName, r.amount])).toEqual([
      [2, "給与", 1000],
    ]);
  });
});

describe("parseImportFile の既存と同じ内容（BR3.6、AC7.4.1）", () => {
  it("既存の収支と全項目が一致する行に印を付け、除外はしない（ファイルの中の重複は見ない）", async () => {
    const { book } = await memoryBook();
    await addFakeTransaction(book, {
      date: "2026-10-01",
      type: "expense",
      categoryName: "食費",
      amount: "1200",
      memo: "架空のランチ",
    });
    const file = csvFile(
      csvText([
        "2026-10-01,expense,食費,1200,架空のランチ",
        "2026-10-01,expense,食費,1200,架空のランチ",
        "2026-10-01,expense,食費,1201,架空のランチ",
        "2026-10-01,expense,食費,1200,架空のランチ2",
        "2026-10-01,expense,日用品,1200,架空のランチ",
        "2026-10-02,expense,食費,1200,架空のランチ",
        "2026-10-03,expense,食費,500,架空の新しい行",
        "2026-10-03,expense,食費,500,架空の新しい行",
      ]),
    );
    const result = await preview(book, file);
    expect(result.validRows.map((r) => r.sameAsExisting)).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe("parseImportFile の読み込み中と保存の失敗", () => {
  it("保存の読み取りが待たされている間は、プレビューが完了しない（読み込み中）", async () => {
    const { book } = await memoryBook({ delayMs: 80 });
    let settled = false;
    const pending = parseImportFile(
      book,
      csvFile(csvText(["2026-10-01,expense,食費,100,架空"])),
    ).then((result) => {
      settled = true;
      return result;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(settled).toBe(false);
    const result = await pending;
    expect(settled).toBe(true);
    expect(result.ok && result.value.validRows).toHaveLength(1);
  });

  it("U4 の読み取りの失敗はそのまま返す", async () => {
    const { book, storage } = await memoryBook();
    storage.failReads = true;
    const result = await parseImportFile(
      book,
      csvFile(csvText(["2026-10-01,expense,食費,100,架空"])),
    );
    expect(result).toEqual(await book.listCategories());
    expect(!result.ok && result.error.kind).toBe("storage");
  });
});
