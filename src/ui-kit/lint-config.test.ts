// Lint 設定のテスト（NFR1.1、NFR8.1、security-design.md 第4章）。ファイルは書かず、文字列を src/ui-kit/ の
// ファイルとして検査し、通信・保存の参照と HTML の挿入が違反になることを確かめる。
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const PROBE_PATH = "src/ui-kit/lint-probe.tsx";
const RESTRICTION_RULES = new Set([
  "no-restricted-globals",
  "no-restricted-properties",
  "no-restricted-syntax",
]);

async function restrictionViolations(code: string, filePath = PROBE_PATH) {
  const eslint = new ESLint({
    // 参照禁止の規則だけを見る。仮のファイルはディスク上になく型情報の対象にできないため、型情報を使う解析を外す
    // （参照禁止の規則は型情報を使わない）。設定ファイルの対象の絞り込みはそのまま使う。
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

describe("src/ui-kit/ の参照禁止（NFR1.1）", () => {
  it("fetch・XMLHttpRequest・WebSocket・EventSource・indexedDB・localStorage・sessionStorage の参照は違反になる", async () => {
    const code = [
      "export async function probe(): Promise<unknown> {",
      "  await fetch('/架空');",
      "  return [XMLHttpRequest, WebSocket, EventSource, indexedDB, localStorage, sessionStorage];",
      "}",
      "",
    ].join("\n");
    expect(await restrictionViolations(code)).toEqual(Array(7).fill("no-restricted-globals"));
  });

  it("navigator.sendBeacon と window・globalThis 経由の参照も違反になる", async () => {
    const code = [
      "export function probe(): unknown {",
      "  navigator.sendBeacon('/架空');",
      "  return [window.fetch, globalThis.localStorage, self.indexedDB];",
      "}",
      "",
    ].join("\n");
    expect(await restrictionViolations(code)).toEqual(Array(4).fill("no-restricted-properties"));
  });

  it("時計とタイマー（知らせの自動非表示で使う）は違反にならない", async () => {
    const code = [
      "export function probe(): number {",
      "  const timer = setTimeout(() => undefined, 5000);",
      "  clearTimeout(timer);",
      "  return Date.now();",
      "}",
      "",
    ].join("\n");
    expect(await restrictionViolations(code)).toEqual([]);
  });
});

describe("src/ui-kit/ の HTML 挿入の禁止（NFR8.1）", () => {
  it("dangerouslySetInnerHTML（JSX の属性とオブジェクトの項目）は違反になる", async () => {
    const code = [
      "export const Probe = () => <p dangerouslySetInnerHTML={{ __html: '架空' }} />;",
      "export const props = { dangerouslySetInnerHTML: { __html: '架空' } };",
      "",
    ].join("\n");
    expect(await restrictionViolations(code)).toEqual(Array(2).fill("no-restricted-syntax"));
  });

  it("innerHTML・outerHTML・insertAdjacentHTML（文字列での参照を含む）は違反になる", async () => {
    const code = [
      "export function probe(element: HTMLElement): void {",
      "  element.innerHTML = '架空';",
      "  element.outerHTML = '架空';",
      "  element.insertAdjacentHTML('beforeend', '架空');",
      "  element['innerHTML'] = '架空';",
      "}",
      "",
    ].join("\n");
    expect(await restrictionViolations(code, "src/ui-kit/lint-probe.ts")).toEqual(
      Array(4).fill("no-restricted-syntax"),
    );
  });

  it("テストファイルと文字としての描画には適用しない", async () => {
    const hostile = "export const Probe = () => <p>{'<script>alert(1)</script>'}</p>;\n";
    expect(await restrictionViolations(hostile)).toEqual([]);
    const testOnly = "export const value = localStorage;\n";
    expect(await restrictionViolations(testOnly, "src/ui-kit/lint-probe.test.ts")).toEqual([]);
  });
});
