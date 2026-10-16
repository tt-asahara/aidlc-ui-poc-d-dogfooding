// ファイルの読み取り（BR2.1、BR2.2、NFR4.2、AC7.1.3、AC7.3.3）。テストを先に書く（CSV 変換のレイヤー）。
import { describe, expect, it } from "vitest";
import { MAX_IMPORT_BYTES, readFileText } from "./fileReader";
import { bytesFile, CountingFile, csvFile, csvText, RejectingFile } from "./test-fixtures";

describe("readFileText の大きさの確認（BR2.1）", () => {
  it("上限は 1,048,576 バイト", () => {
    expect(MAX_IMPORT_BYTES).toBe(1_048_576);
  });

  it("ちょうど 1,048,576 バイトのファイルは読み込む", async () => {
    const file = new CountingFile(["a".repeat(1_048_576)], "架空の上限ちょうど.csv");
    const result = await readFileText(file);
    expect(result.ok && result.value.length).toBe(1_048_576);
    expect(file.arrayBufferCalls).toBe(1);
  });

  it("1 バイト超えのファイルは too-large を返し、中身を読まない", async () => {
    const file = new CountingFile(["a".repeat(1_048_577)], "架空の大きすぎ.csv");
    const result = await readFileText(file);
    expect(result).toEqual({ ok: false, error: { kind: "too-large", limitBytes: 1_048_576 } });
    expect(file.arrayBufferCalls).toBe(0);
  });
});

describe("readFileText の文字コード（BR2.2）", () => {
  it("BOM なしの UTF-8 をそのまま文字列にする（日本語を含む）", async () => {
    const text = csvText(["2026-10-01,expense,食費,1200,架空のランチ"]);
    expect(await readFileText(csvFile(text))).toEqual({ ok: true, value: text });
  });

  it("BOM 付きの UTF-8 は BOM を残したまま返す（BOM の扱いは U1 の decodeCsv に任せる）", async () => {
    const text = csvText(["2026-10-01,income,給与,250000,架空の給与"], { bom: true });
    const result = await readFileText(csvFile(text));
    expect(result).toEqual({ ok: true, value: text });
    expect(result.ok && result.value.charCodeAt(0)).toBe(0xfeff);
  });

  it("0 バイトのファイルは空の文字列（空の判定は decodeCsv が行う）", async () => {
    expect(await readFileText(bytesFile(new Uint8Array([])))).toEqual({ ok: true, value: "" });
  });

  it("UTF-8 として正しくないバイト列は read-failed（UTF-8 の文言）", async () => {
    const result = await readFileText(bytesFile(new Uint8Array([0xff, 0xfe, 0x41, 0x42])));
    expect(result).toEqual({
      ok: false,
      error: { kind: "read-failed", message: "UTF-8 の CSV ファイルを選んでください" },
    });
  });

  it("途中で切れた複数バイトの文字（Shift_JIS 等の誤り）も read-failed（UTF-8 の文言）", async () => {
    // 「あ」は E3 81 82。最後の1バイトを欠いた列は UTF-8 として正しくない。
    const result = await readFileText(bytesFile(new Uint8Array([0x61, 0xe3, 0x81])));
    expect(result).toEqual({
      ok: false,
      error: { kind: "read-failed", message: "UTF-8 の CSV ファイルを選んでください" },
    });
  });
});

describe("readFileText の読み取りの失敗（BR2.2）", () => {
  it("arrayBuffer が reject したら read-failed（読み込めない文言）", async () => {
    const file = new RejectingFile();
    const result = await readFileText(file);
    expect(result).toEqual({
      ok: false,
      error: { kind: "read-failed", message: "ファイルを読み込めませんでした" },
    });
    expect(file.arrayBufferCalls).toBe(1);
  });
});
