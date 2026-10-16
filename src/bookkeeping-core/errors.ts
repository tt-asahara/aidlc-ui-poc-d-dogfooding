// U3 の失敗と想定外の例外を OperationError・BookOpenResult に置き換える（BR1.1、BR1.3、BR6.1、BR6.2）。
import type { Result, ValidationError } from "../data-contract";
import type { StorageError, StorageOpenError, WriteError } from "../storage";
import { CORE_MESSAGES } from "./messages";
import type { BookOpenResult, OperationError, RuleViolation } from "./types";

/** ready 以外の BookOpenResult。 */
export type BookOpenFailure = Exclude<BookOpenResult, { status: "ready" }>;

export function ok<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

export function fail(error: OperationError): { ok: false; error: OperationError } {
  return { ok: false, error };
}

export function ruleFailure(violation: RuleViolation): { ok: false; error: OperationError } {
  return fail({ kind: "rule", violation });
}

export function validationFailure(
  errors: ValidationError[],
  line?: number,
): { ok: false; error: OperationError } {
  return fail(
    line === undefined ? { kind: "validation", errors } : { kind: "validation", errors, line },
  );
}

/** 対象月の検証エラー（field month、code invalid-month）。 */
export function invalidMonthError(): ValidationError {
  return { field: "month", code: "invalid-month", message: CORE_MESSAGES.monthInvalid };
}

/** 種別の検証エラー（field type、code invalid-type）。 */
export function invalidTypeError(): ValidationError {
  return { field: "type", code: "invalid-type", message: CORE_MESSAGES.typeInvalid };
}

/** U3 の読み書きの失敗。read-failed・write-failed → storage、newer-version → newer-version。 */
export function fromStorageError(error: StorageError): OperationError {
  switch (error.kind) {
    case "newer-version":
      return { kind: "newer-version" };
    case "read-failed":
    case "write-failed":
      return { kind: "storage", message: error.message };
  }
}

/** U3 の write の失敗。aborted は work が返した理由（validation・rule）をそのまま返す。 */
export function fromWriteError(error: WriteError<OperationError>): OperationError {
  if (error.kind === "aborted") return error.reason;
  return fromStorageError(error);
}

/** 想定外の例外（バグ）を storage の失敗にする。握りつぶさず、理由の概要を message に残す。 */
export function fromUnexpected(
  error: unknown,
  operation: "read" | "write",
): Extract<OperationError, { kind: "storage" }> {
  const base = operation === "read" ? CORE_MESSAGES.unexpectedRead : CORE_MESSAGES.unexpectedWrite;
  return { kind: "storage", message: `${base}（${describeError(error)}）` };
}

/** 保存領域を開く失敗（BR1.1）。unavailable・newer-version はそのまま、open-failed は load-failed。 */
export function fromOpenError(error: StorageOpenError): BookOpenFailure {
  switch (error.kind) {
    case "unavailable":
      return { status: "unavailable" };
    case "newer-version":
      return { status: "newer-version" };
    case "open-failed":
      return { status: "load-failed", message: error.message };
  }
}

/** 開いた直後の準備（初期カテゴリの作成）の失敗（BR1.3）。newer-version 以外は load-failed。 */
export function fromPrepareError(error: OperationError): BookOpenFailure {
  switch (error.kind) {
    case "newer-version":
      return { status: "newer-version" };
    case "storage":
      return { status: "load-failed", message: error.message };
    case "validation":
    case "rule":
      return { status: "load-failed", message: CORE_MESSAGES.unexpectedRead };
  }
}

/** 開発者が原因を追える短い説明（入力値そのものは含めない）。 */
export function describeError(error: unknown): string {
  if (error instanceof Error && error.message !== "") return error.message;
  if (typeof error === "string" && error !== "") return error;
  return "詳細不明";
}

/** Result の失敗側の型を OperationError にそろえるための型。 */
export type OperationResult<T> = Result<T, OperationError>;
