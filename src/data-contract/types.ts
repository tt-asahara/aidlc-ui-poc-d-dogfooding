// 契約 C1（共通データ契約）の型。contract-summary.md の C1 と一致させる。

/** 失敗し得る操作の結果。Unit の境界を越えて例外を投げない（契約の共通の決まり）。 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export type EntryType = "income" | "expense";
/** YYYY-MM-DD（実在する暦日、2000-01-01〜2099-12-31） */
export type IsoDate = string;
/** YYYY-MM（2000-01〜2099-12） */
export type YearMonth = string;
/** ISO 8601（オフセット付き） */
export type IsoDateTime = string;

export interface Transaction {
  id: string;
  date: IsoDate;
  type: EntryType;
  categoryId: string;
  /** 1〜99,999,999 の整数（円） */
  amount: number;
  /** 0〜200 文字（前後の空白は除去済み） */
  memo: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** 画面・CSV からの入力（未検証の文字列を含む） */
export interface TransactionInput {
  date: string;
  type: string;
  categoryId: string;
  amount: string | number;
  memo: string;
}

export interface Category {
  id: string;
  type: EntryType;
  /** 前後の空白を除いて 1〜20 文字 */
  name: string;
  sortOrder: number;
  createdAt: IsoDateTime;
}

export interface Budget {
  /** 支出カテゴリのみ */
  categoryId: string;
  month: YearMonth;
  /** 0〜99,999,999 の整数（円） */
  amount: number;
  updatedAt: IsoDateTime;
}

export type FieldName =
  | "date"
  | "type"
  | "categoryId"
  | "category"
  | "amount"
  | "memo"
  | "name"
  | "budgetAmount"
  | "month";

export type ValidationCode =
  | "required"
  | "invalid-date"
  | "out-of-range-date"
  | "invalid-month"
  | "not-integer"
  | "out-of-range"
  | "too-long"
  | "blank"
  | "duplicate-name"
  | "invalid-type";

export interface ValidationError {
  field: FieldName;
  code: ValidationCode;
  /** 日本語の固定の表示文言（BR6.1）。入力値は埋め込まない（NFR8.3）。 */
  message: string;
}

/** 検証済みの収支の値（id・日時は持ち主の U4 が付ける） */
export type ValidTransactionInput = Omit<Transaction, "id" | "createdAt" | "updatedAt">;

/** CSV の1レコード（見出しを除く）。カテゴリは名前で表す。 */
export interface CsvRecord {
  date: string;
  type: string;
  category: string;
  amount: string;
  memo: string;
}

/** 復号した CSV レコードと、元ファイル上の行番号（見出しを 1 行目とした、レコードが始まる物理行） */
export interface CsvLine {
  line: number;
  record: CsvRecord;
  /**
   * そのレコードの全列の値（引用を外した後、数式対策の ' は外す前のファイル上の値）。
   * 列数が 5 でない行の判定と、無効な行の表示に使う。
   */
  fields?: string[];
}

export type CsvFormatError =
  | { kind: "empty" }
  | { kind: "header-mismatch"; found: string[] }
  | { kind: "malformed"; line: number; message: string };

/** validateCsvRecord が返す検証済みの値。カテゴリは名前のまま（id の解決は U6・U4）。 */
export interface ValidCsvRecord {
  date: IsoDate;
  type: EntryType;
  categoryName: string;
  amount: number;
  memo: string;
}
