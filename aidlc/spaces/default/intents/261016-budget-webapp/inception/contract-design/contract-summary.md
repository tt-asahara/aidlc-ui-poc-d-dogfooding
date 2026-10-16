# Unit 間の約束（Contract Summary）

- 出典: `inception/units-generation/unit-of-work.md`、`inception/units-generation/unit-of-work-dependency.md`（依存12件）、`inception/domain-design/components.md`、`inception/domain-design/decisions.md`、`inception/requirements-analysis/requirements.md`、`contract-design-questions.md`（Q1〜Q5）
- すべての約束は同じパッケージ内の TypeScript の型と関数呼び出しである。ネットワーク・イベント・メッセージは使わない。外部に公開する API はない（NFR1、C4）。そのため仕様は OpenAPI / AsyncAPI ではなく、共有する TypeScript の型（shared-schema）として示す。
- ここに書く型と関数の名前・引数・戻り値・失敗の種類が約束である。内部の実装、細かな検証の文言、画面の見た目は各 Unit の Functional Design で決める。
- Q1 の決定により、起動時の保存領域の状態は U4 の「家計簿を開く」窓口が返す。U7 は U3 に依存せず、Units Generation の依存一覧は変わらない。

## 1. 約束の一覧

| # | Provider Unit | Consumer | Mechanism | Owner |
|---|---------------|----------|-----------|-------|
| C1 | U1 data-contract | U3、U4、U5、U6、U7 | 共有の型と同期の純粋な関数 | U1 |
| C2 | U3 storage | U4 | 非同期の関数（Promise）と書き込み処理の窓口 | U3 |
| C3 | U4 bookkeeping-core | U5、U6、U7 | 非同期の関数（家計簿を開く、読み取り、書き込み操作） | U4 |
| C4 | U5 monthly-summary | U7 | 同期の純粋な計算関数と、非同期の取得関数 | U5 |
| C5 | U6 csv-exchange | U7 | 非同期の関数（書き出し、ファイルの解析、確定） | U6 |
| C6 | U2 ui-kit | U7 | React 部品（props の約束） | U2 |

Units Generation の依存12件との対応: U3→U1、U4→U1、U5→U1、U6→U1、U7→U1 は C1。U4→U3 は C2。U5→U4、U6→U4、U7→U4 は C3。U7→U5 は C4。U7→U6 は C5。U7→U2 は C6。

## 2. 共通の決まり（すべての約束に適用）

- **失敗の返し方（Q2 = A）**: 失敗し得る操作は `Result<T, E>`（`{ ok: true, value }` か `{ ok: false, error }`）で返す。Unit の境界を越えて例外を投げない。想定外の例外（バグ）は境界で `storage`・`unexpected` の失敗に変換し、画面で「保存できませんでした」などの失敗として表示する（握りつぶさない）。
- **失敗の種類**: `error.kind` で区別し、画面は種類ごとに表示を決める（FR8）。種類は C1 の `ValidationError`、C2 の `StorageError`、C3 の `OperationError`、C5 の `ImportFileError` で列挙する。
- **同期・非同期（Q3 = A）**: 保存を伴う読み書きは非同期（`Promise`）。保存を伴わない計算（C1 の検証・CSV の符号化と復号、C4 の集計の計算）は同期の純粋な関数。
- **時間切れと再試行**: ネットワーク呼び出しはないため、時間切れによる自動の再試行は行わない。再試行は利用者の操作（「再試行」ボタン、もう一度保存）で行う。読み込みが5秒を超えたときの「時間がかかっています」の表示は U7 の画面が行う（interaction-spec.md）。
- **金額と日付**: 金額は整数（円）の `number`、日付は `YYYY-MM-DD` の文字列、対象月は `YYYY-MM` の文字列、日時は ISO 8601（オフセット付き）の文字列。
- **変更のルール（Q4 = A）**: 約束を変えるときは、この文書と、その約束を使うすべての Unit のテストを同じ変更の中で更新する。項目の追加は任意の項目（`?`）に限り、既存の利用者は知らない項目を無視する。項目の削除・型や意味の変更は破壊的変更として扱い、この文書の更新と全利用者の修正を同じ変更で行う。

## 3. 約束ごとの仕様

### C1 U1 data-contract（共通データ契約）

```ts
// shared-schema: data-contract (owner: U1)

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export type EntryType = "income" | "expense";
export type IsoDate = string;      // YYYY-MM-DD（実在する暦日）
export type YearMonth = string;    // YYYY-MM
export type IsoDateTime = string;  // ISO 8601（オフセット付き）

export interface Transaction {
  id: string;
  date: IsoDate;
  type: EntryType;
  categoryId: string;
  amount: number;      // 1〜99,999,999 の整数（円）
  memo: string;        // 0〜200 文字（前後の空白は除去済み）
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface TransactionInput {      // 画面・CSV からの入力（未検証の文字列を含む）
  date: string;
  type: string;
  categoryId: string;
  amount: string | number;
  memo: string;
}

export interface Category {
  id: string;
  type: EntryType;
  name: string;        // 前後の空白を除いて 1〜20 文字
  sortOrder: number;
  createdAt: IsoDateTime;
}

export interface Budget {
  categoryId: string;  // 支出カテゴリのみ
  month: YearMonth;
  amount: number;      // 0〜99,999,999 の整数（円）
  updatedAt: IsoDateTime;
}

export type FieldName = "date" | "type" | "categoryId" | "category" | "amount" | "memo" | "name" | "budgetAmount" | "month";

export type ValidationCode =
  | "required" | "invalid-date" | "out-of-range-date" | "invalid-month" | "not-integer" | "out-of-range"
  | "too-long" | "blank" | "duplicate-name" | "invalid-type";

export interface ValidationError {
  field: FieldName;
  code: ValidationCode;
  message: string;     // 日本語の表示文言（例: 「金額：1〜99,999,999 の整数で入力してください」）
}

// 検証（同期・純粋）
export function validateTransactionInput(input: TransactionInput):
  Result<Omit<Transaction, "id" | "createdAt" | "updatedAt">, ValidationError[]>;
export function validateCategoryName(name: string, type: EntryType, existing: readonly Category[], excludeId?: string):
  Result<string, ValidationError[]>;   // 正規化した名前を返す
export function validateBudgetAmount(amount: string | number): Result<number, ValidationError[]>;
export function isValidYearMonth(month: string): boolean;
export function toYearMonth(date: IsoDate): YearMonth;
export function normalizeCategoryNameForCompare(name: string): string; // 大文字小文字・全角半角・前後空白を区別しない比較用

// CSV（同期・純粋）
export const CSV_HEADER: readonly ["date", "type", "category", "amount", "memo"];
export interface CsvRecord { date: string; type: string; category: string; amount: string; memo: string } // カテゴリは名前
export interface CsvLine {
  line: number;        // 見出しを 1 行目とした元ファイルの行番号（レコードが始まる物理行）
  record: CsvRecord;   // 足りない列は空文字
  fields?: string[];   // そのレコードの全列の値（ファイル上の値、数式対策の ' は外す前）。列数が 5 でない行の判定と表示に使う
}
export type CsvFormatError =
  | { kind: "empty" }                                  // 0 バイト、または見出し行のみ
  | { kind: "header-mismatch"; found: string[] }
  | { kind: "malformed"; line: number; message: string }; // 閉じていない引用など
export function encodeCsv(records: readonly CsvRecord[]): string;   // UTF-8 BOM 付き、CRLF、RFC 4180、数式対策を適用
export function decodeCsv(text: string): Result<CsvLine[], CsvFormatError>; // BOM 有無・CRLF/LF を受け付け、数式対策を戻す
export interface ValidCsvRecord { date: IsoDate; type: EntryType; categoryName: string; amount: number; memo: string }
export function validateCsvRecord(record: CsvRecord): Result<ValidCsvRecord, ValidationError[]>;
  // CSV の1行を画面入力と同じ規則で検証（BR4.7）。カテゴリ名は空でないことだけを確かめ、id の解決は U6・U4
export function escapeFormula(value: string): string;   // 先頭が = + - @、または ' の後ろがこれらか ' で始まるなら先頭に ' を1つ付ける
export function unescapeFormula(value: string): string; // escapeFormula の逆（往復で値が変わらない）

// 保存スキーマ
export const SCHEMA_VERSION: number; // 初版は 1
```

- `validateTransactionInput` はカテゴリの存在を確かめない（データを持たないため）。存在と種別の一致は C3 の書き込み操作の中で確かめる。
- 文言の一覧と境界値（例: 2026-02-29 は不正、2028-02-29 は正）は U1 の Functional Design で決める。
- U1 のコード生成での更新（変更ルール Q4 に従い、この文書と U1 のテストを同じ変更で更新した。C1 を使うほかの Unit のコードはまだない）:
  - `ValidationCode` に `out-of-range-date`（日付が 2000-01-01〜2099-12-31 の範囲外）を追加した。列挙値の追加のため、利用者の Unit は種類ごとの分岐でこの値を扱う。
  - CSV 行の検証の入り口 `validateCsvRecord` と、その戻り値の型 `ValidCsvRecord` を追加した。
  - `CsvLine` に任意の項目 `fields?` を追加した。列数が 5 でない行（列の不足・過剰、BR4.3）を U6 が行の検証で扱い、無効な行の元の値（`InvalidRow.raw`）を表示できるようにするため。U1 の `decodeCsv` は常にこの項目を設定する。

### C2 U3 storage（保存）

```ts
// shared-schema: storage (owner: U3)
import type { Transaction, Category, Budget, Result } from "../data-contract";

export type StoreName = "transactions" | "categories" | "budgets" | "meta";

export type StorageOpenError =
  | { kind: "unavailable" }        // IndexedDB が使えない
  | { kind: "newer-version"; found: number; supported: number } // データに触れない
  | { kind: "open-failed"; message: string };

export type StorageError =
  | { kind: "read-failed"; message: string }
  | { kind: "write-failed"; message: string } // 書き込み処理全体が取り消された
  | { kind: "newer-version" };                 // 別のタブで版が上がり、接続を閉じた（以後の読み書きはすべてこれ）

export type WriteError<E> = StorageError | { kind: "aborted"; reason: E };

export interface TxContext {
  getAll<S extends StoreName>(store: S): Promise<RecordOf<S>[]>;
  get<S extends StoreName>(store: S, key: KeyOf<S>): Promise<RecordOf<S> | undefined>;
  getAllByIndex(store: "transactions", index: "byMonth" | "byCategory", value: string): Promise<Transaction[]>;
  getAllByIndex(store: "budgets", index: "byCategory", value: string): Promise<Budget[]>;
  count(store: "transactions", index: "byCategory", value: string): Promise<number>;
  put<S extends StoreName>(store: S, record: RecordOf<S>): Promise<void>;
  delete<S extends StoreName>(store: S, key: KeyOf<S>): Promise<void>;
}

export interface StorageHandle {
  read<T>(stores: readonly StoreName[], work: (tx: TxContext) => Promise<T>): Promise<Result<T, StorageError>>;
  write<T, E = unknown>(stores: readonly StoreName[], work: (tx: TxContext) => Promise<Result<T, E>>): Promise<Result<T, WriteError<E>>>;
  close(): void;
}
// write: work が { ok: false } を返したとき、または例外・保存失敗のときは全体を取り消す（すべて成功かすべて取り消し）。
// work の { ok: false } は aborted.reason としてそのまま呼び出し元へ返す（型は work の失敗の型 E を引き継ぐ）。
// put・delete は work の成功後にまとめて保存する（work の間は溜めるだけで、同じ処理の中の読み取りには重ねて見える）。
// work の中で別の周回に進む待ち（setTimeout、TxContext 以外の非同期処理など）の後は write-failed（何も書かれない）。
// microtask の待ち（await Promise.resolve() など）は問題ない。

export function openStorage(options?: {
  dbName?: string;                 // 既定 "budget-webapp"
  indexedDB?: IDBFactory;          // 既定 globalThis.indexedDB（テストでの差し込み用）
  now?: () => Date;                // 初期化日時に使う時計（既定は実際の時計）
  blockedTimeoutMs?: number;       // 版の更新が妨げられたときに待つ時間（既定 5000、過ぎたら open-failed）
}): Promise<Result<StorageHandle, StorageOpenError>>;

// テスト用の差し替え（同じ窓口）
export function createMemoryStorage(options?: {
  failOpen?: StorageOpenError;
  failReads?: boolean;
  failWrites?: boolean;
  delayMs?: number;
}): Promise<Result<StorageHandle, StorageOpenError>>;

export type RecordOf<S extends StoreName> = S extends "transactions" ? Transaction : S extends "categories" ? Category : S extends "budgets" ? Budget : MetaRecord;
export type KeyOf<S extends StoreName> = S extends "budgets" ? [string, string] : string; // budgets は [categoryId, month]
export interface MetaRecord { key: string; schemaVersion: number; initializedAt: string }
```

- 索引: `transactions.byMonth`（`date` の先頭7文字）、`transactions.byCategory`、`budgets.byCategory`。名前と作り方は U3 の Functional Design で確定する。
- 古い版のデータの移行手順は U3 が持つ。初版（1）では移行はない。
- U3 のコード生成での更新（変更ルール Q4 に従い、この文書と U3 のテストを同じ変更で更新した。C2 を使う U4 のコードはまだない）:
  - `StorageError` に `{ kind: "newer-version" }` を追加した（別のタブで版が上がったら接続を閉じ、以後の読み書きを失敗させる）。列挙値の追加のため、U4 は種類ごとの分岐でこの値を扱う（C3 の `OperationError` で伝えるかは U4 の Functional Design で決める）。
  - `write` を `write<T, E>` とし、`aborted.reason` の型を work の失敗の型 `E` にした（`WriteError<E>` として公開）。
  - `RecordOf`・`KeyOf`・`MetaRecord` を公開の型にした。
  - `openStorage` に任意の引数 `indexedDB`・`now`・`blockedTimeoutMs` を加えた。
  - `write` の説明に、まとめて保存の決まり（work の中で別の周回に進む待ちの後は write-failed）を加えた。
  - 容量超過は `write-failed` の `message` で区別する（「保存領域の容量が足りないため保存できませんでした」）。種類の値は増やしていない。

### C3 U4 bookkeeping-core（家計簿の中核）

```ts
// shared-schema: bookkeeping-core (owner: U4)
import type { Transaction, TransactionInput, Category, Budget, EntryType, YearMonth, ValidationError, Result } from "../data-contract";
import type { StorageHandle, StorageOpenError } from "../storage";

export type BookOpenResult =
  | { status: "ready"; book: Book }
  | { status: "unavailable" }                    // 「この環境ではデータを保存できません」
  | { status: "newer-version" }                  // 「新しい版で保存されたデータのため開けません」
  | { status: "load-failed"; message: string };  // 「データを読み込めませんでした」＋再試行

// 家計簿を開く。保存領域を開き、カテゴリが0件のときだけ同じ書き込み処理の中で初期カテゴリを作る（Q5 = A）。
// now・newId はテストで日時と id を固定するための任意の引数（既定は実際の時計と crypto.randomUUID）。
export function openBook(options?: { storage?: () => Promise<Result<StorageHandle, StorageOpenError>>; now?: () => Date; newId?: () => string }): Promise<BookOpenResult>;

export type RuleViolation =
  | { code: "category-missing" }                       // 別タブで削除された等
  | { code: "category-type-mismatch" }
  | { code: "category-in-use"; count: number }
  | { code: "last-category-of-type"; type: EntryType }
  | { code: "not-found" }                              // 対象の収支・カテゴリが存在しない
  | { code: "budget-not-set" }                         // 設定がない月の「設定を外す」
  | { code: "import-category-missing"; lines: number[] }; // CSV 確定時。1件も追加しない

export type OperationError =
  | { kind: "validation"; errors: ValidationError[]; line?: number } // line は取り込みの再検証で最初に失敗した行
  | { kind: "rule"; violation: RuleViolation }
  | { kind: "storage"; message: string }               // 保存失敗。入力は呼び出し元が保持する
  | { kind: "newer-version" };                         // 別のタブでの版上げ。画面は開くときの newer-version と同じ表示に切り替える

export type BudgetSource =
  | { kind: "set" }
  | { kind: "carried"; from: YearMonth }
  | { kind: "none" };

export interface EffectiveBudget {
  categoryId: string;
  month: YearMonth;
  amount: number | null;   // none のとき null
  source: BudgetSource;
}

// その月に使う予算の計算（同期・純粋。保存に触れない）。支出カテゴリだけを listCategories の並びで返す。
export function resolveEffectiveBudgets(categories: readonly Category[], budgets: readonly Budget[], month: YearMonth): EffectiveBudget[];

export interface ImportRow {           // C5 から渡される確定対象の行
  line: number;
  input: TransactionInput;             // categoryId はプレビュー時点で引いた id
}

export interface Book {
  // 読み取り
  listTransactions(month: YearMonth): Promise<Result<Transaction[], OperationError>>;   // 日付の新しい順→登録日時の新しい順→id
  listAllTransactions(range: "all" | { month: YearMonth }): Promise<Result<Transaction[], OperationError>>; // 日付の古い順（書き出し用）
  listCategories(): Promise<Result<Category[], OperationError>>;                          // 支出の後に収入、各 sortOrder の昇順（同じなら createdAt、id の昇順）
  getCategoryUsage(): Promise<Result<Record<string, { transactions: number; budgets: number }>, OperationError>>; // budgets は保存されている予算の行数（設定した月の数）
  getEffectiveBudgets(month: YearMonth): Promise<Result<EffectiveBudget[], OperationError>>; // 支出カテゴリ全件
  // 書き込み（すべて1回の書き込み処理。失敗時は何も変わらない）
  addTransaction(input: TransactionInput): Promise<Result<Transaction, OperationError>>;
  updateTransaction(id: string, input: TransactionInput): Promise<Result<Transaction, OperationError>>;
  deleteTransaction(id: string): Promise<Result<void, OperationError>>;
  addCategory(type: EntryType, name: string): Promise<Result<Category, OperationError>>;
  renameCategory(id: string, name: string): Promise<Result<Category, OperationError>>;
  deleteCategory(id: string): Promise<Result<{ deletedBudgets: number }, OperationError>>; // 使用件数は処理の中で数え直す
  setBudget(categoryId: string, month: YearMonth, amount: string | number): Promise<Result<void, OperationError>>;
  clearBudget(categoryId: string, month: YearMonth): Promise<Result<void, OperationError>>;
  importTransactions(rows: readonly ImportRow[]): Promise<Result<{ added: number }, OperationError>>; // 全件追加か0件
}
```

- `StorageHandle`・`StorageOpenError` は C2 の型。U7 はこれらを直接使わず、`openBook` の `status` だけを見る（Q1 = A）。
- 予算の解除は、設定がない月に対しては `budget-not-set` を返す（画面では「設定を外す」を設定済みの月にだけ表示する）。
- `importTransactions` には、U6 が U1 の検証を通した行（C5 の `validRows`）だけを渡す前提とする。U4 は全行を再検証し、失敗した行があれば何も追加せず `validation`（`line` は最初に失敗した行）を返す（前提が崩れたときの安全装置）。
- U4 のコード生成での更新（変更ルール Q4 に従い、この文書と U4 のテストを同じ変更で更新した。C3 を使う U5〜U7 のコードはまだない）:
  - `openBook` の任意の引数に `now?: () => Date`・`newId?: () => string` を加えた（テストで日時と id を固定するため）。
  - `OperationError` に `{ kind: "newer-version" }` を加えた（U3 の `StorageError` の newer-version を伝える。U4 FD Q1 = A）。列挙値の追加のため、U5〜U7 は種類ごとの分岐でこの値を扱い、画面は開くときの newer-version と同じ表示に切り替えて以後の操作を止める。
  - `OperationError` の `validation` に任意の `line?: number` を加えた（取り込みの再検証で最初に失敗した行）。
  - `getCategoryUsage` の戻り値を `Record<string, { transactions: number; budgets: number }>` にした（U4 NFR Design Q1 = A。削除確認で予算も消えることを示すため）。`budgets` は保存されている予算の行数（設定した月の数）で、同じ状態での `deleteCategory` の `deletedBudgets` と一致する。
  - `listCategories` の並びを「支出の後に収入、各 sortOrder の昇順（同じなら createdAt、id の昇順）」と明記した。
  - 公開済みの純粋な関数 `resolveEffectiveBudgets` の宣言を型の一覧に加えた（U5 が単独のテストで使えるようにするため）。
  - 公開窓口 `src/bookkeeping-core/index.ts` は、上の型（`CategoryUsage`・`OpenBookOptions` の名前付きの型を含む）と `openBook`・`resolveEffectiveBudgets` を公開する。

### C4 U5 monthly-summary（月次集計）

```ts
// shared-schema: monthly-summary (owner: U5)
import type { Transaction, Category, YearMonth, Result } from "../data-contract";
import type { EffectiveBudget, BudgetSource, Book, OperationError } from "../bookkeeping-core";

export interface ExpenseRow {
  categoryId: string;
  categoryName: string;
  budget: number | null;          // 予算なしは null
  budgetSource: BudgetSource;
  actual: number;
  remaining: number | null;       // 予算 − 実績。予算なしは null
  over: boolean;                  // 実績 > 予算（予算なしは false、0円予算は判定する）
}

export interface IncomeRow { categoryId: string; categoryName: string; actual: number }

export interface MonthlySummary {
  month: YearMonth;
  incomeTotal: number;
  expenseTotal: number;           // = ExpenseRow.actual の合計
  balance: number;                // incomeTotal − expenseTotal
  expenseRows: ExpenseRow[];      // 支出カテゴリ全件（sortOrder 順）
  incomeRows: IncomeRow[];        // 収入カテゴリ全件（sortOrder 順）
  hasTransactions: boolean;       // 対象月に収支が1件以上あるか
}

// 同期・純粋な計算（単独でテストする）
export function computeMonthlySummary(input: {
  month: YearMonth;
  transactions: readonly Transaction[];   // 対象月の収支
  categories: readonly Category[];
  budgets: readonly EffectiveBudget[];
}): MonthlySummary;

// 非同期の取得（C3 を呼んで computeMonthlySummary に渡す）
export function getMonthlySummary(book: Book, month: YearMonth): Promise<Result<MonthlySummary, OperationError>>;
```

### C5 U6 csv-exchange（CSV 入出力）

```ts
// shared-schema: csv-exchange (owner: U6)
import type { Transaction, YearMonth, Result } from "../data-contract";
import type { Book, OperationError } from "../bookkeeping-core";

export interface ExportResult {
  fileName: string;     // budget-transactions-YYYYMMDD.csv または budget-transactions-YYYY-MM.csv
  blob: Blob;           // text/csv、UTF-8 BOM 付き
  count: number;        // 書き出した収支の件数
  headerOnly: boolean;  // 0件のとき true
}
export function exportTransactions(book: Book, range: "all" | { month: YearMonth }, today?: Date): Promise<Result<ExportResult, OperationError>>;

export type ImportFileError =
  | { kind: "too-large"; limitBytes: 1048576 }
  | { kind: "too-many-rows"; limitRows: 5000 }
  | { kind: "empty" }                                   // 「データがありません」（失敗とは区別）
  | { kind: "header-mismatch" }
  | { kind: "malformed"; line: number; message: string }
  | { kind: "read-failed"; message: string };

export interface PreviewRow {
  line: number;
  date: string; type: "income" | "expense"; categoryId: string; categoryName: string; amount: number; memo: string;
  sameAsExisting: boolean;   // 既存の収支と全項目一致（除外はしない）
}
export interface InvalidRow { line: number; reasons: string[]; raw: string[] } // 表示時はエスケープ
export interface ImportPreview {
  fileName: string;
  validRows: PreviewRow[];
  invalidRows: InvalidRow[];
}

export function parseImportFile(book: Book, file: File): Promise<Result<ImportPreview, ImportFileError | OperationError>>;
// 確定。validRows だけを C3 の importTransactions に渡す。カテゴリが見つからない行があれば
// { kind: "rule", violation: { code: "import-category-missing", lines } } を返し、1件も追加しない（Q5 = A）。
export function commitImport(book: Book, preview: ImportPreview): Promise<Result<{ added: number }, OperationError>>;
```

### C6 U2 ui-kit（画面部品）

```ts
// shared-schema: ui-kit (owner: U2) — React 部品の props の約束（抜粋）
export interface ButtonProps { variant?: "primary" | "secondary" | "danger"; busy?: boolean; busyLabel?: string; disabled?: boolean; onClick?: () => void; type?: "button" | "submit"; children: React.ReactNode; "aria-label"?: string; ref?: React.Ref<HTMLButtonElement> }
export interface TextFieldProps { id: string; label: string; value: string; onChange: (v: string) => void; required?: boolean; hint?: string; error?: string; inputMode?: "text" | "numeric"; maxLength?: number; onEnter?: () => void; ref?: React.Ref<HTMLInputElement> }
export interface RadioGroupProps<V extends string> { legend: string; name: string; value: V; options: { value: V; label: string }[]; onChange: (v: V) => void; ref?: React.Ref<HTMLInputElement> } // ref は選択中（なければ先頭）のラジオ
export interface SelectProps { id: string; label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; error?: string; ref?: React.Ref<HTMLSelectElement> }
export interface DataTableProps<R> { caption: string; columns: { key: string; header: string; align?: "start" | "end"; render: (row: R) => React.ReactNode }[]; rows: R[]; rowKey: (row: R) => string; busy?: boolean }
export type DialogCloseReason = "escape" | "cancel"; // escape は Esc（Dialog が伝える）、cancel は呼び出し側のボタンでの取り消し
export interface DialogProps { open: boolean; title: string; role?: "dialog" | "alertdialog"; describedBy?: string; initialFocusRef?: React.RefObject<HTMLElement | null>; returnFocusRef?: React.RefObject<HTMLElement | null>; onClose: (reason: DialogCloseReason) => void; children: React.ReactNode }
export interface StatusPanelProps { kind: "loading" | "error" | "empty" | "unavailable" | "newer-version"; subject: string; action?: { label: string; onClick: () => void }; slowAfterMs?: number }
export interface InlineMessageProps { tone: "success" | "error"; children: React.ReactNode; autoHideMs?: number; onHidden?: () => void } // success は 5000ms で消え aria-live（消えたら onHidden）、error は role=alert で消えない
export interface FieldErrorProps { id: string; field: string; message: string }
export interface FileInputProps { id: string; label: string; accept: string; onSelect: (file: File) => void; disabled?: boolean; ref?: React.Ref<HTMLInputElement> }
export interface TabsProps { tabs: { id: string; label: string }[]; selectedId: string; onSelect: (id: string) => void; label: string; renderPanel: (id: string) => React.ReactNode } // disabled の状態は持たない
```

- 部品の状態・キーボード操作・読み上げは refined-mockups の interaction-spec.md と accessibility-checklist.md に従う。日付欄は `TextField`（ADR-005）。
- U2 のコード生成で加えた変更（変更のルール Q4 に従い、この文書と U2 のテストを同じ変更で更新。いずれも任意の項目の追加で、既存の利用者に影響しない）:
  - Button・TextField・Select・RadioGroup・FileInput は DOM 要素への参照 `ref` を受け取る（React 19 の `ref` の受け渡し。フォーカスの戻し先・最初のエラー項目へのフォーカス移動に使う。Contract Design レビュー R-09、U2 BR2.4）。RadioGroup の `ref` は選択中のラジオ（どれも選ばれていなければ先頭のラジオ）に結び付く。
  - Dialog の `onClose` は閉じる理由（`"escape" | "cancel"`）を引数で受け取る。Dialog 自身は Esc のときに `"escape"` を渡す（U2 BR5.4）。`() => void` の関数もそのまま渡せる。`initialFocusRef`・`returnFocusRef` は `useRef<HTMLElement>(null)` の結果を渡せるよう `| null` を含める。
  - InlineMessage は success が自動で消えたときに呼ぶ `onHidden` を受け取る（U2 entities.md InlineMessageProps、BR6.3）。
  - Tabs には disabled の状態を持たせない（refined-mockups レビュー R-05: 起動時の特殊画面ではタブ自体を表示しない）。
- 公開窓口は `src/ui-kit/index.ts`。見た目は U7 が `src/ui-kit/tokens.css` → `src/ui-kit/ui-kit.css` の順に読み込む（CSS は TypeScript の公開窓口に含めない）。
- 色・文字・余白のトークンは design-system-mapping.md の CSS 変数。

## 4. 約束の持ち主のルール

- 各約束の型と関数は、持ち主の Unit の公開窓口（`src/<unit-name>/index.ts`）だけから公開する。利用者の Unit は公開窓口以外を import しない。
- 約束の変更は持ち主の Unit が提案し、この文書・持ち主の Unit・すべての利用者の Unit のテストを同じ変更で更新する（Q4 = A）。
- 追加は任意の項目（`?`）または新しい関数に限る。利用者は知らない項目を無視する。`kind` や `code` の列挙に値を追加するのは、画面が種類ごとに表示を決めているため破壊的変更として扱う（全利用者の分岐を同じ変更で更新する）。
- 削除・型の変更・意味の変更は破壊的変更として扱い、同じ変更の中で全利用者を修正する。
- U1 の変更はすべての Unit に及ぶため、U1 の変更時は全 Unit のテストを実行する（マージ前の一括検証コマンドで担保される）。

## 5. 未解決の事項

| Contract | Question | Blocks |
|----------|----------|--------|
| C1 | 検証文言の一覧と、日付・金額・名前の境界値の具体例 | U1 の Functional Design（ほかの Unit は文言の中身に依存しない） |
| C2 | 索引の正式名と、`write` に渡す保存領域の組み合わせ（読み書きの範囲） | U3・U4 の Functional Design |
| C3 | `id` の生成方法（`crypto.randomUUID` を使うか）と、登録日時の時計の扱い（テストで固定できる形） | U4 の Functional Design |
| C5 | プレビューで大量の行（最大 5,000 行）をどう表示するか（refined-mockups のレビューで受け入れた指摘 R-03） | U6・U7 の Functional Design（約束の型は全件を返す前提で変わらない） |
| C6 | 未保存の入力があるまま月・タブを移動したときの扱い（refined-mockups のレビューで受け入れた指摘 R-06） | U7 の Functional Design |
