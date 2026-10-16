// 書き出し（W1、BR1.1〜BR1.5）。U4 から収支とカテゴリを取り、U1 の encodeCsv で CSV にして Blob で返す。
// ダウンロードのための URL の作成と破棄は U7 が行う（BR5.1）。想定外の例外の変換は index.ts が行う。
import { encodeCsv } from "../data-contract";
import type { CsvRecord, Result, Transaction, YearMonth } from "../data-contract";
import type { Book, OperationError } from "../bookkeeping-core";
import type { ExportResult } from "./types";

const CSV_MIME_TYPE = "text/csv;charset=utf-8";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** BR1.2 全期間は today の地方時の日付、月指定はその月でファイル名を決める。 */
export function exportFileName(range: "all" | { month: YearMonth }, today: Date): string {
  if (range === "all") {
    const ymd = `${today.getFullYear()}${pad2(today.getMonth() + 1)}${pad2(today.getDate())}`;
    return `budget-transactions-${ymd}.csv`;
  }
  return `budget-transactions-${range.month}.csv`;
}

/**
 * 収支を CsvRecord にする（BR1.1）。数式対策は U1 の encodeCsv に任せ、値はそのまま入れる（BR1.4）。
 * カテゴリ名を引けない収支があれば、名前が空の行を作らずに category-missing を返す（BR1.5）。
 */
function toCsvRecords(
  transactions: readonly Transaction[],
  categoryNames: ReadonlyMap<string, string>,
): Result<CsvRecord[], OperationError> {
  const records: CsvRecord[] = [];
  for (const transaction of transactions) {
    const category = categoryNames.get(transaction.categoryId);
    if (category === undefined) {
      return { ok: false, error: { kind: "rule", violation: { code: "category-missing" } } };
    }
    records.push({
      date: transaction.date,
      type: transaction.type,
      category,
      amount: String(transaction.amount),
      memo: transaction.memo,
    });
  }
  return { ok: true, value: records };
}

/** W1 書き出す。U4 の失敗（月の誤り・保存の失敗など）はそのまま返す。 */
export async function exportTransactions(
  book: Book,
  range: "all" | { month: YearMonth },
  today: Date = new Date(),
): Promise<Result<ExportResult, OperationError>> {
  const [transactions, categories] = await Promise.all([
    book.listAllTransactions(range),
    book.listCategories(),
  ]);
  if (!transactions.ok) return transactions;
  if (!categories.ok) return categories;

  const categoryNames = new Map(categories.value.map((c) => [c.id, c.name]));
  const records = toCsvRecords(transactions.value, categoryNames);
  if (!records.ok) return records;

  const blob = new Blob([encodeCsv(records.value)], { type: CSV_MIME_TYPE });
  const count = records.value.length;
  return {
    ok: true,
    value: { fileName: exportFileName(range, today), blob, count, headerOnly: count === 0 },
  };
}
