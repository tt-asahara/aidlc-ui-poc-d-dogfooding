// 失敗の種類の判定と、失敗の値の組み立て（NFR4.4、NFR7.1、security-design.md 2.1 節）。
import type { Result } from "../data-contract";
import type { StorageError, StorageOpenError } from "./types";

export const MESSAGES = {
  closed: "保存領域は閉じられています",
  autoCommitted:
    "書き込みの処理が途中で確定したため保存しませんでした（work の中で TxContext の操作以外を待たないでください）",
  quotaExceeded: "保存領域の容量が足りないため保存できませんでした",
  blocked: "ほかのタブで開いている家計簿を閉じてから、もう一度開いてください",
} as const;

/** 例外の名前（DOMException の name など）。名前がなければ undefined。 */
export function errorName(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "name" in error) {
    return typeof error.name === "string" ? error.name : undefined;
  }
  return undefined;
}

/** 開発者が原因を追える短い説明（値そのものは含めない）。 */
export function describeError(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const name = errorName(error);
    const text =
      typeof error.message === "string" && error.message !== "" ? error.message : "詳細不明";
    return name !== undefined && name !== "Error" ? `${name}: ${text}` : text;
  }
  if (typeof error === "string" && error !== "") return error;
  return "詳細不明";
}

export function isQuotaExceeded(error: unknown): boolean {
  return errorName(error) === "QuotaExceededError";
}

/**
 * 開く要求の失敗の種類。
 * - SecurityError・InvalidStateError: ブラウザが利用を拒否した（プライベートモードの制限など）→ unavailable
 * - VersionError: 保存データの版がアプリより新しい → newer-version
 * - それ以外 → open-failed
 */
export function classifyOpenError(error: unknown): StorageOpenError["kind"] {
  const name = errorName(error);
  if (name === "SecurityError" || name === "InvalidStateError") return "unavailable";
  if (name === "VersionError") return "newer-version";
  return "open-failed";
}

export function unavailable(): { ok: false; error: StorageOpenError } {
  return { ok: false, error: { kind: "unavailable" } };
}

export function openFailed(message: string): { ok: false; error: StorageOpenError } {
  return { ok: false, error: { kind: "open-failed", message } };
}

export function readFailed(message: string): Result<never, StorageError> {
  return { ok: false, error: { kind: "read-failed", message } };
}

export function writeFailed(message: string): Result<never, StorageError> {
  return { ok: false, error: { kind: "write-failed", message } };
}

/** 保存の失敗を write-failed にする。容量超過は理由を区別する（NFR4.4）。 */
export function writeFailedFrom(error: unknown, context: string): Result<never, StorageError> {
  if (isQuotaExceeded(error)) return writeFailed(MESSAGES.quotaExceeded);
  return writeFailed(`${context}（${describeError(error)}）`);
}

export function newerVersion(): Result<never, StorageError> {
  return { ok: false, error: { kind: "newer-version" } };
}
