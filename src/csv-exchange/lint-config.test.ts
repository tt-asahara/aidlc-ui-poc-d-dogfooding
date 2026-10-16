// Lint 設定のテスト（NFR1.1、NFR8.1、security-design.md 第5章）。ファイルは書かず、文字列を src/csv-exchange/ の
// ファイルとして検査し、通信・保存先の直接の参照・文字列の評価・fake-indexeddb・U3 の直接の利用・U1 と U4 の
// 内部ファイルの import が違反になり、U1・U4 の公開窓口は違反にならないこと、テストのファイルと test-fixtures.ts
// には適用しないことを確かめる。
import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

const PROBE_PATH = "src/csv-exchange/lint-probe.ts";
const RESTRICTION_RULES = new Set([
  "no-restricted-globals",
  "no-restricted-properties",
  "no-restricted-imports",
  "no-new-func",
  "no-eval",
]);

// 設定と解析器の最初の読み込みは数秒かかる（ほかのテストと並んで動くとさらに遅い）ため、
// ESLint を1つだけ作り、最初の検査を beforeAll で済ませる。判定の内容は変えない。
const WARMUP_TIMEOUT_MS = 60_000;
let eslint: ESLint;

beforeAll(async () => {
  eslint = new ESLint({
    // 参照禁止の規則だけを見る。仮のファイルはディスク上になく型情報の対象にできないため、型情報を使う解析を外す。
    ruleFilter: ({ ruleId }) => RESTRICTION_RULES.has(ruleId),
    overrideConfig: {
      languageOptions: { parserOptions: { projectService: false, project: null } },
    },
  });
  await eslint.lintText("export const warmup = 1;\n", { filePath: PROBE_PATH });
}, WARMUP_TIMEOUT_MS);

async function restrictionViolations(code: string, filePath = PROBE_PATH) {
  const [result] = await eslint.lintText(code, { filePath });
  const messages = result?.messages ?? [];
  expect(messages.filter((m) => m.fatal)).toEqual([]);
  return messages.map((m) => m.ruleId).sort();
}

describe("src/csv-exchange/ の参照禁止（NFR1.1）", () => {
  it("fetch・XMLHttpRequest・WebSocket・EventSource・indexedDB・localStorage・sessionStorage・eval の参照は違反になる", async () => {
    const code = [
      "export async function probe(): Promise<unknown> {",
      "  await fetch('/架空');",
      "  return [XMLHttpRequest, WebSocket, EventSource, indexedDB, localStorage, sessionStorage, eval];",
      "}",
      "",
    ].join("\n");
    // eval の参照は no-eval でも違反になる（二重の禁止）。
    expect(await restrictionViolations(code)).toEqual([
      "no-eval",
      ...Array<string>(8).fill("no-restricted-globals"),
    ]);
  });

  it("navigator.sendBeacon・document.cookie と window・globalThis・self 経由の参照も違反になる", async () => {
    const code = [
      "export function probe(): unknown {",
      "  navigator.sendBeacon('/架空');",
      "  return [document.cookie, window.fetch, globalThis.indexedDB, self.localStorage, window.WebSocket];",
      "}",
      "",
    ].join("\n");
    expect(await restrictionViolations(code)).toEqual(Array(6).fill("no-restricted-properties"));
  });

  it("new Function と eval の呼び出しは違反になる", async () => {
    const code = [
      "export function probe(): unknown {",
      "  const f = new Function('return 1');",
      "  return [f, Function('return 2'), eval('3')];",
      "}",
      "",
    ].join("\n");
    expect(await restrictionViolations(code)).toEqual([
      "no-eval",
      "no-new-func",
      "no-new-func",
      "no-restricted-globals",
    ]);
  });

  it("fake-indexeddb、U3 storage、U1・U4 の内部ファイルの import は違反になる", async () => {
    const code = [
      "import { IDBFactory } from 'fake-indexeddb';",
      "import 'fake-indexeddb/auto';",
      "import { createMemoryStorage } from '../storage';",
      "import type { StorageHandle } from '../storage/types';",
      "import { encodeCsv } from '../data-contract/csv';",
      "import type { Book } from '../bookkeeping-core/types';",
      "export const probe: unknown[] = [IDBFactory, createMemoryStorage, encodeCsv];",
      "export type Probe = [StorageHandle, Book];",
      "",
    ].join("\n");
    expect(await restrictionViolations(code)).toEqual(Array(6).fill("no-restricted-imports"));
  });

  it("U1・U4 の公開窓口、同じフォルダのファイル、File・Blob・TextDecoder は違反にならない", async () => {
    const code = [
      "import { decodeCsv } from '../data-contract';",
      "import type { Category } from '../data-contract/index';",
      "import { openBook } from '../bookkeeping-core';",
      "import type { Book } from '../bookkeeping-core/index';",
      "import { CSV_MESSAGES } from './messages';",
      "export function probe(file: File): unknown[] {",
      "  return [decodeCsv, openBook, CSV_MESSAGES, new Blob(['架空']), new TextDecoder('utf-8'), file.size];",
      "}",
      "export type Probe = [Category, Book];",
      "",
    ].join("\n");
    expect(await restrictionViolations(code)).toEqual([]);
  });

  it("テストのファイルと test-fixtures.ts には禁止を適用しない", async () => {
    const code = [
      "import 'fake-indexeddb/auto';",
      "import { createMemoryStorage } from '../storage';",
      "export const probe = (): unknown => [localStorage, createMemoryStorage];",
      "",
    ].join("\n");
    expect(await restrictionViolations(code, "src/csv-exchange/lint-probe.test.ts")).toEqual([]);
    expect(await restrictionViolations(code, "src/csv-exchange/test-fixtures.ts")).toEqual([]);
  });
});
