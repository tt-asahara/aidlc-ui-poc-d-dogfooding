// 画面の状態の形（entities.md）。保存はしない（ページを閉じると消える）。保存されるのは U3 の収支・カテゴリ・予算だけ。
import type { Book, OperationError } from "../bookkeeping-core";
import type { ImportFileError, ImportPreview } from "../csv-exchange";
import type { TransactionInput, ValidationError, YearMonth } from "../data-contract";

/** 5つの画面（タブ）の識別子（BR9.1）。 */
export type ScreenId = "transactions" | "summary" | "budgets" | "categories" | "csv";

export const SCREEN_IDS: readonly ScreenId[] = [
  "transactions",
  "summary",
  "budgets",
  "categories",
  "csv",
];

/** 起動時の状態（openBook の結果を写したもの）。book は ready のときだけ値がある（BR1.2）。 */
export type AppBoot =
  | { status: "booting"; book: null }
  | { status: "ready"; book: Book }
  | { status: "unavailable"; book: null }
  | { status: "newer-version"; book: null }
  | { status: "load-failed"; book: null; message: string };

/** 読み取り結果を表示する欄の状態（BR8.1、BR8.2）。失敗の表示は StatusPanel が担う。 */
export type AsyncView<T> =
  | { state: "loading"; data: T | null }
  | { state: "loaded"; data: T }
  | { state: "failed"; error: OperationError };

/** 操作の結果の知らせ（成功と失敗）。id は同じ文言の再表示を区別するために使う。 */
export interface Notice {
  id: number;
  kind: "success" | "error";
  text: string;
  /** success は 5000、error は null（消えない）。 */
  autoHideMs: number | null;
}

/** 登録・編集フォームの状態（入力値は失敗しても残す。BR8.3）。 */
export interface FormState {
  mode: "create" | "edit";
  values: TransactionInput;
  fieldErrors: ValidationError[];
  saving: boolean;
  notice: Notice | null;
}

/**
 * 確認と取り込みのダイアログ（D1、D2、D3）の状態。
 * 閉じたときのフォーカスの戻し先（開く前に押したボタン。BR9.2）は、画面が ref で持つ（閉じる直前に差し替えるため状態に入れない）。
 */
export interface DialogState {
  kind: "none" | "deleteTransaction" | "deleteCategory" | "importPreview";
  /** 対象の id（収支・カテゴリ）。 */
  target: string | null;
  /** 処理中は true。キャンセルも無効にする。 */
  busy: boolean;
  /** D3 の保存失敗の文言。 */
  error: string | null;
}

/** CSV 取り込みの画面の状態（ファイル選択から確定まで）。 */
export interface ImportView {
  phase: "idle" | "analyzing" | "fileError" | "previewing" | "saving" | "done";
  preview: ImportPreview | null;
  fileError: ImportFileError | null;
  notice: Notice | null;
}

/** 書き出しの状態。 */
export interface ExportView {
  range: "all" | { month: YearMonth };
  notice: Notice | null;
}
