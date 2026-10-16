// 失敗の置き換えのテスト（BR1.1、BR1.3、BR6.1、BR6.2、functional-spec.md 第3章の表）。
import { describe, expect, it } from "vitest";
import {
  describeError,
  fromOpenError,
  fromPrepareError,
  fromStorageError,
  fromUnexpected,
  fromWriteError,
  invalidMonthError,
  invalidTypeError,
  ruleFailure,
  validationFailure,
} from "./errors";
import { CORE_MESSAGES } from "./messages";
import type { OperationError } from "./types";

describe("fromStorageError・fromWriteError（BR6.1）", () => {
  it("read-failed・write-failed は storage（message はそのまま）", () => {
    expect(fromStorageError({ kind: "read-failed", message: "架空の読み取り失敗" })).toEqual({
      kind: "storage",
      message: "架空の読み取り失敗",
    });
    expect(fromWriteError({ kind: "write-failed", message: "架空の保存失敗" })).toEqual({
      kind: "storage",
      message: "架空の保存失敗",
    });
  });

  it("newer-version は newer-version", () => {
    expect(fromStorageError({ kind: "newer-version" })).toEqual({ kind: "newer-version" });
    expect(fromWriteError({ kind: "newer-version" })).toEqual({ kind: "newer-version" });
  });

  it("aborted は work が返した理由（rule・validation）をそのまま返す", () => {
    const rule: OperationError = { kind: "rule", violation: { code: "not-found" } };
    const validation: OperationError = { kind: "validation", errors: [invalidMonthError()] };
    expect(fromWriteError({ kind: "aborted", reason: rule })).toBe(rule);
    expect(fromWriteError({ kind: "aborted", reason: validation })).toBe(validation);
  });
});

describe("fromUnexpected（BR6.2）", () => {
  it("想定外の例外は storage にし、理由の概要を残す", () => {
    expect(fromUnexpected(new Error("架空のバグ"), "write")).toEqual({
      kind: "storage",
      message: `${CORE_MESSAGES.unexpectedWrite}（架空のバグ）`,
    });
    expect(fromUnexpected("文字列の例外", "read")).toEqual({
      kind: "storage",
      message: `${CORE_MESSAGES.unexpectedRead}（文字列の例外）`,
    });
  });

  it("説明のない例外は「詳細不明」", () => {
    expect(describeError(undefined)).toBe("詳細不明");
    expect(describeError(new Error(""))).toBe("詳細不明");
    expect(describeError({ message: 1 })).toBe("詳細不明");
  });
});

describe("fromOpenError・fromPrepareError（BR1.1、BR1.3）", () => {
  it("開く失敗の各種類を status に置き換える", () => {
    expect(fromOpenError({ kind: "unavailable" })).toEqual({ status: "unavailable" });
    expect(fromOpenError({ kind: "newer-version", found: 2, supported: 1 })).toEqual({
      status: "newer-version",
    });
    expect(fromOpenError({ kind: "open-failed", message: "架空の失敗" })).toEqual({
      status: "load-failed",
      message: "架空の失敗",
    });
  });

  it("準備の失敗は newer-version 以外 load-failed", () => {
    expect(fromPrepareError({ kind: "newer-version" })).toEqual({ status: "newer-version" });
    expect(fromPrepareError({ kind: "storage", message: "架空の保存失敗" })).toEqual({
      status: "load-failed",
      message: "架空の保存失敗",
    });
    expect(fromPrepareError({ kind: "rule", violation: { code: "not-found" } })).toEqual({
      status: "load-failed",
      message: CORE_MESSAGES.unexpectedRead,
    });
    expect(fromPrepareError({ kind: "validation", errors: [] })).toEqual({
      status: "load-failed",
      message: CORE_MESSAGES.unexpectedRead,
    });
  });
});

describe("失敗の値の組み立て", () => {
  it("validation は line があるときだけ line を持つ", () => {
    const errors = [invalidTypeError()];
    expect(validationFailure(errors)).toEqual({ ok: false, error: { kind: "validation", errors } });
    expect(validationFailure(errors, 7)).toEqual({
      ok: false,
      error: { kind: "validation", errors, line: 7 },
    });
    expect("line" in validationFailure(errors).error).toBe(false);
  });

  it("rule は違反をそのまま包む", () => {
    expect(ruleFailure({ code: "category-in-use", count: 3 })).toEqual({
      ok: false,
      error: { kind: "rule", violation: { code: "category-in-use", count: 3 } },
    });
  });
});
