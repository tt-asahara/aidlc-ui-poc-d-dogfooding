// 取り込みの確定（W3、BR4.1〜BR4.3）。取り込める行だけを U4 の importTransactions に1回で渡す。
// U4 が1回の書き込み処理の中でカテゴリを確かめるため、プレビューの後にカテゴリが消えていれば
// import-category-missing（行番号つき）で1件も追加されない（NFR4.1）。想定外の例外の変換は index.ts が行う。
import type { Result } from "../data-contract";
import type { Book, ImportRow, OperationError } from "../bookkeeping-core";
import type { ImportPreview, PreviewRow } from "./types";

/** 取り込める行を ImportRow にする。categoryId はプレビュー時点で照合した id。 */
function toImportRow(row: PreviewRow): ImportRow {
  return {
    line: row.line,
    input: {
      date: row.date,
      type: row.type,
      categoryId: row.categoryId,
      amount: row.amount,
      memo: row.memo,
    },
  };
}

/** W3 確定する。0件なら U4 を呼ばずに { added: 0 }。U4 の結果（成功・失敗）はそのまま返す。 */
export async function commitImport(
  book: Book,
  preview: ImportPreview,
): Promise<Result<{ added: number }, OperationError>> {
  const rows = preview.validRows.map(toImportRow);
  if (rows.length === 0) return { ok: true, value: { added: 0 } };
  return book.importTransactions(rows);
}
