// ファイルの読み取り（BR2.1、BR2.2、NFR4.2）。ブラウザ組み込みの File の操作だけを使い、通信しない（BR5.1）。
import type { Result } from "../data-contract";
import { CSV_MESSAGES } from "./messages";
import type { ImportFileError } from "./types";

/** 読み込めるファイルの大きさの上限（1MB、ちょうどは読み込む）。 */
export const MAX_IMPORT_BYTES = 1_048_576;

/**
 * ファイルを UTF-8 として厳密に読む。
 * 1. 大きさが上限を超えたら、中身を読まずに too-large を返す（BR2.1）。
 * 2. arrayBuffer の失敗は read-failed（「ファイルを読み込めませんでした」）。
 * 3. UTF-8 として正しくないバイト列は read-failed（「UTF-8 の CSV ファイルを選んでください」）。
 * BOM は外さずに返し、その扱いは U1 の decodeCsv に任せる（ignoreBOM: true）。
 */
export async function readFileText(file: File): Promise<Result<string, ImportFileError>> {
  if (file.size > MAX_IMPORT_BYTES) {
    return { ok: false, error: { kind: "too-large", limitBytes: MAX_IMPORT_BYTES } };
  }
  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    // 読み取りの失敗の詳細（ブラウザの内部の文言）は利用者に出さず、固定の文言で返す（NFR8.3）。
    return { ok: false, error: { kind: "read-failed", message: CSV_MESSAGES.readFailed } };
  }
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
    return { ok: true, value: decoder.decode(buffer) };
  } catch {
    // fatal: true の TextDecoder は、正しくないバイト列で TypeError を投げる。
    return { ok: false, error: { kind: "read-failed", message: CSV_MESSAGES.notUtf8 } };
  }
}
