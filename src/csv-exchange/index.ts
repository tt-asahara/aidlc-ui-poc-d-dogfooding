// U6 csv-exchange の公開窓口（契約 C5）。画面（U7）はこのファイルだけを import する。
// 3つの操作は例外を外に出さない（BR5.2、security-design.md 第4章）。想定外の例外は protect で失敗に変換する:
// - parseImportFile: ファイルの読み取り（大きさ・arrayBuffer・デコード・復号）の例外は read-failed、
//   Book の呼び出しの例外は storage。
// - exportTransactions・commitImport: storage。
import type { Result, YearMonth } from "../data-contract";
import type { Book, OperationError } from "../bookkeeping-core";
import { commitImport as commitPreview } from "./commit";
import { exportTransactions as exportFromBook } from "./export";
import { CSV_MESSAGES } from "./messages";
import { buildPreview, readImportFile, type DecodedImport } from "./preview";
import type { ExportResult, ImportFileError, ImportPreview } from "./types";

export type { ExportResult, ImportFileError, ImportPreview, InvalidRow, PreviewRow } from "./types";

/**
 * 処理を必ず Result にする共通の関数。同期の例外も非同期の reject も、unexpected の失敗に置き換える。
 * 例外の中身（内部の文言）は利用者に見せず、固定の文言の失敗として呼び出し元に返す（握りつぶさない）。
 */
async function protect<T, E>(
  work: () => Promise<Result<T, E>>,
  unexpected: E,
): Promise<Result<T, E>> {
  try {
    return await work();
  } catch {
    return { ok: false, error: unexpected };
  }
}

function storageError(message: string): OperationError {
  return { kind: "storage", message };
}

/** 収支を CSV に書き出す（US6.1〜US6.3）。today の既定は現在時刻。 */
export function exportTransactions(
  book: Book,
  range: "all" | { month: YearMonth },
  today?: Date,
): Promise<Result<ExportResult, OperationError>> {
  return protect(
    () => exportFromBook(book, range, today),
    storageError(CSV_MESSAGES.unexpectedExport),
  );
}

/** ファイルを読み込んでプレビューを作る（US7.1、US7.3、US7.4）。保存は変えない。 */
export async function parseImportFile(
  book: Book,
  file: File,
): Promise<Result<ImportPreview, ImportFileError | OperationError>> {
  const decoded = await protect<DecodedImport, ImportFileError>(() => readImportFile(file), {
    kind: "read-failed",
    message: CSV_MESSAGES.readFailed,
  });
  if (!decoded.ok) return decoded;
  return protect(
    () => buildPreview(book, decoded.value),
    storageError(CSV_MESSAGES.unexpectedRead),
  );
}

/** 確定する。validRows だけを U4 の importTransactions に1回で渡す（US7.2）。 */
export function commitImport(
  book: Book,
  preview: ImportPreview,
): Promise<Result<{ added: number }, OperationError>> {
  return protect(() => commitPreview(book, preview), storageError(CSV_MESSAGES.unexpectedCommit));
}
