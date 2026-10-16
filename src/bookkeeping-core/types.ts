// 契約 C3（家計簿の中核）の型。contract-summary.md の C3 と一致させる（コード生成の Step 8 で C3 を同じ変更で更新）。
import type {
  Category,
  EntryType,
  Result,
  Transaction,
  TransactionInput,
  ValidationError,
  YearMonth,
} from "../data-contract";
import type { StorageHandle, StorageOpenError } from "../storage";

export type BookOpenResult =
  | { status: "ready"; book: Book }
  /** 「この環境ではデータを保存できません」 */
  | { status: "unavailable" }
  /** 「新しい版で保存されたデータのため開けません」 */
  | { status: "newer-version" }
  /** 「データを読み込めませんでした」＋再試行 */
  | { status: "load-failed"; message: string };

export interface OpenBookOptions {
  /** 保存領域を開く関数。既定は U3 の openStorage（テストでは createMemoryStorage などを渡す）。 */
  storage?: () => Promise<Result<StorageHandle, StorageOpenError>>;
  /** 日時の時計。既定は実際の時計。保存する日時は toISOString() の値（UTC、末尾 Z）。 */
  now?: () => Date;
  /** id の作り方。既定は crypto.randomUUID（なければ crypto.getRandomValues で UUID v4）。 */
  newId?: () => string;
}

export type RuleViolation =
  /** 別のタブで削除された等 */
  | { code: "category-missing" }
  | { code: "category-type-mismatch" }
  | { code: "category-in-use"; count: number }
  | { code: "last-category-of-type"; type: EntryType }
  /** 対象の収支・カテゴリが存在しない */
  | { code: "not-found" }
  /** 設定がない月の「設定を外す」 */
  | { code: "budget-not-set" }
  /** CSV 確定時。1件も追加しない。lines は昇順 */
  | { code: "import-category-missing"; lines: number[] };

export type OperationError =
  /** line は取り込みの再検証で最初に失敗した行の番号 */
  | { kind: "validation"; errors: ValidationError[]; line?: number }
  | { kind: "rule"; violation: RuleViolation }
  /** 保存失敗。入力は呼び出し元が保持する */
  | { kind: "storage"; message: string }
  /** 別のタブで版が上がった。画面は開くときの newer-version と同じ表示に切り替える */
  | { kind: "newer-version" };

export type BudgetSource =
  { kind: "set" } | { kind: "carried"; from: YearMonth } | { kind: "none" };

export interface EffectiveBudget {
  categoryId: string;
  month: YearMonth;
  /** source が none のとき null */
  amount: number | null;
  source: BudgetSource;
}

/** C5 から渡される確定対象の行（U6 が検証済みの行だけを渡す前提） */
export interface ImportRow {
  line: number;
  /** categoryId はプレビュー時点で引いた id */
  input: TransactionInput;
}

/** カテゴリ別の使用件数。budgets は保存されている予算の行数（設定した月の数） */
export interface CategoryUsage {
  transactions: number;
  budgets: number;
}

export interface Book {
  // 読み取り
  /** 日付の新しい順→登録日時の新しい順→id の昇順 */
  listTransactions(month: YearMonth): Promise<Result<Transaction[], OperationError>>;
  /** 日付の古い順→登録日時の古い順→id の昇順（書き出し用） */
  listAllTransactions(
    range: "all" | { month: YearMonth },
  ): Promise<Result<Transaction[], OperationError>>;
  /** 支出の後に収入、それぞれ sortOrder の昇順（同じなら createdAt、id の昇順） */
  listCategories(): Promise<Result<Category[], OperationError>>;
  getCategoryUsage(): Promise<Result<Record<string, CategoryUsage>, OperationError>>;
  /** 支出カテゴリ全件（listCategories の並び） */
  getEffectiveBudgets(month: YearMonth): Promise<Result<EffectiveBudget[], OperationError>>;
  // 書き込み（すべて1回の書き込み処理。失敗時は何も変わらない）
  addTransaction(input: TransactionInput): Promise<Result<Transaction, OperationError>>;
  updateTransaction(
    id: string,
    input: TransactionInput,
  ): Promise<Result<Transaction, OperationError>>;
  deleteTransaction(id: string): Promise<Result<void, OperationError>>;
  addCategory(type: EntryType, name: string): Promise<Result<Category, OperationError>>;
  renameCategory(id: string, name: string): Promise<Result<Category, OperationError>>;
  /** 使用件数は処理の中で数え直す */
  deleteCategory(id: string): Promise<Result<{ deletedBudgets: number }, OperationError>>;
  setBudget(
    categoryId: string,
    month: YearMonth,
    amount: string | number,
  ): Promise<Result<void, OperationError>>;
  clearBudget(categoryId: string, month: YearMonth): Promise<Result<void, OperationError>>;
  /** 全件追加か0件 */
  importTransactions(
    rows: readonly ImportRow[],
  ): Promise<Result<{ added: number }, OperationError>>;
}

/** U1 の検証を通った収支の値（id・日時は U4 が付ける）。U4 の内部でだけ使う。 */
export type ValidTransaction = Omit<Transaction, "id" | "createdAt" | "updatedAt">;
