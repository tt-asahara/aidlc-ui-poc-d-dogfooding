// Lint 設定のテスト（NFR1.1、NFR8.1、security-design.md 第3章）。ファイルは書かず、文字列を src/storage/ の
// ファイルとして検査し、通信・ほかの保存先・文字列の評価が違反になり、indexedDB は違反にならないことを確かめる。
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const PROBE_PATH = "src/storage/lint-probe.ts";
const RESTRICTION_RULES = new Set([
  "no-restricted-globals",
  "no-restricted-properties",
  "no-new-func",
  "no-eval",
]);

async function restrictionViolations(code: string, filePath = PROBE_PATH) {
  const eslint = new ESLint({
    // 参照禁止の規則だけを見る。仮のファイルはディスク上になく型情報の対象にできないため、型情報を使う解析を外す。
    ruleFilter: ({ ruleId }) => RESTRICTION_RULES.has(ruleId),
    overrideConfig: {
      languageOptions: { parserOptions: { projectService: false, project: null } },
    },
  });
  const [result] = await eslint.lintText(code, { filePath });
  const messages = result?.messages ?? [];
  expect(messages.filter((m) => m.fatal)).toEqual([]);
  return messages.map((m) => m.ruleId).sort();
}

describe("src/storage/ の参照禁止（NFR1.1）", () => {
  it("fetch・XMLHttpRequest・WebSocket・EventSource・localStorage・sessionStorage・eval の参照は違反になる", async () => {
    const code = [
      "export async function probe(): Promise<unknown> {",
      "  await fetch('/架空');",
      "  return [XMLHttpRequest, WebSocket, EventSource, localStorage, sessionStorage, eval];",
      "}",
      "",
    ].join("\n");
    // eval の参照は no-eval でも違反になる（二重の禁止）。
    expect(await restrictionViolations(code)).toEqual([
      "no-eval",
      ...Array<string>(7).fill("no-restricted-globals"),
    ]);
  });

  it("navigator.sendBeacon・document.cookie と window・globalThis・self 経由の参照も違反になる", async () => {
    const code = [
      "export function probe(): unknown {",
      "  navigator.sendBeacon('/架空');",
      "  return [document.cookie, window.fetch, globalThis.localStorage, self.WebSocket];",
      "}",
      "",
    ].join("\n");
    expect(await restrictionViolations(code)).toEqual(Array(5).fill("no-restricted-properties"));
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

  it("indexedDB とタイマーはこのディレクトリでは違反にならない", async () => {
    const code = [
      "export function probe(): unknown {",
      "  const timer = setTimeout(() => undefined, 0);",
      "  clearTimeout(timer);",
      "  return [indexedDB, globalThis.indexedDB];",
      "}",
      "",
    ].join("\n");
    expect(await restrictionViolations(code)).toEqual([]);
  });

  it("テストのファイルには禁止を適用しない", async () => {
    const code = "export const probe = (): unknown => localStorage;\n";
    expect(await restrictionViolations(code, "src/storage/lint-probe.test.ts")).toEqual([]);
  });
});
