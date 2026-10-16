// 契約 C5（CSV 入出力）の型。contract-summary.md の C5 と一致させる（C5 は変えない）。
import type { EntryType } from "../data-contract";

/** 書き出しの結果。ダウンロードの操作（URL の作成と破棄）は U7 が行う。 */
export interface ExportResult {
  /** budget-transactions-YYYYMMDD.csv（全期間、today の地方時の日付）または budget-transactions-YYYY-MM.csv（月指定） */
  fileName: string;
  /** text/csv;charset=utf-8。中身は U1 の encodeCsv の結果（UTF-8 BOM 付き、CRLF） */
  blob: Blob;
  /** 書き出した収支の件数 */
  count: number;
  /** 0件のとき true（見出し行だけのファイル） */
  headerOnly: boolean;
}

/** ファイル全体を読み込まない理由。 */
export type ImportFileError =
  | { kind: "too-large"; limitBytes: 1048576 }
  | { kind: "too-many-rows"; limitRows: 5000 }
  /** 「データがありません」（失敗とは区別する） */
  | { kind: "empty" }
  | { kind: "header-mismatch" }
  /** message は U1 の文言（「引用が閉じられていません」等） */
  | { kind: "malformed"; line: number; message: string }
  | { kind: "read-failed"; message: string };

/** 取り込める行。値は U1 の検証を通った値、カテゴリは照合した id とアプリ側の現在の名前。 */
export interface PreviewRow {
  /** 見出しを1行目とした、レコードが始まる元ファイルの行番号 */
  line: number;
  date: string;
  type: EntryType;
  categoryId: string;
  categoryName: string;
  amount: number;
  /** 数式対策の ' を外した後の値 */
  memo: string;
  /** 既存の収支と日付・種別・カテゴリ・金額・メモがすべて一致（除外はしない） */
  sameAsExisting: boolean;
}

/** 取り込めない行。reasons は固定の文言、raw はファイル上の全列の値。表示時のエスケープは U7 が行う。 */
export interface InvalidRow {
  line: number;
  reasons: string[];
  raw: string[];
}

/** 取り込みの確認の内容。U7 が表示し、確定またはキャンセルする。 */
export interface ImportPreview {
  fileName: string;
  /** 行番号の昇順。0件もありうる */
  validRows: PreviewRow[];
  /** 行番号の昇順 */
  invalidRows: InvalidRow[];
}
