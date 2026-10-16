// Lint 設定のテスト（NFR1.1）。ファイルは書かず、文字列を src/data-contract/ のファイルとして検査する。
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const PROBE_PATH = "src/data-contract/lint-probe.ts";
const RESTRICTION_RULES = new Set([
  "no-restricted-globals",
  "no-restricted-properties",
  "no-restricted-imports",
]);

async function restrictionViolations(code: string, filePath = PROBE_PATH) {
  const eslint = new ESLint({
    // 参照禁止の規則だけを見る。仮のファイルはディスク上になく型情報の対象にできないため、
    // 型情報を使う解析を外す（参照禁止の規則は型情報を使わない）。設定ファイルの対象の絞り込みはそのまま使う。
    ruleFilter: ({ ruleId }) => RESTRICTION_RULES.has(ruleId),
    overrideConfig: {
      languageOptions: { parserOptions: { projectService: false, project: null } },
    },
  });
  const [result] = await eslint.lintText(code, { filePath });
  const messages = result?.messages ?? [];
  const fatal = messages.filter((m) => m.fatal);
  expect(fatal).toEqual([]);
  return messages.map((m) => m.ruleId);
}

describe("src/data-contract/ の参照禁止（security-design.md 第2章）", () => {
  it("fetch と Date の参照は違反になる", async () => {
    const code = [
      "export async function probe(): Promise<number> {",
      "  await fetch('http://localhost/架空');",
      "  return new Date().getTime();",
      "}",
      "",
    ].join("\n");
    expect(await restrictionViolations(code)).toEqual([
      "no-restricted-globals",
      "no-restricted-globals",
    ]);
  });

  it("保存領域・乱数・タイマー・グローバル経由・node: の import は違反になる", async () => {
    const code = [
      "import { readFileSync } from 'node:fs';",
      "export function probe(): unknown {",
      "  localStorage.setItem('k', String(Math.random()));",
      "  setTimeout(() => undefined, 1);",
      "  return [globalThis.fetch, readFileSync];",
      "}",
      "",
    ].join("\n");
    expect((await restrictionViolations(code)).sort()).toEqual(
      [
        "no-restricted-imports",
        "no-restricted-globals",
        "no-restricted-properties",
        "no-restricted-globals",
        "no-restricted-globals",
      ].sort(),
    );
  });

  it("標準機能（Intl.Segmenter、normalize、Number）だけのコードは違反にならない", async () => {
    const code = [
      "export function probe(value: string): number {",
      "  const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });",
      "  return Number(value.normalize('NFKC')) + [...segmenter.segment(value)].length;",
      "}",
      "",
    ].join("\n");
    expect(await restrictionViolations(code)).toEqual([]);
  });

  it("テストファイル（*.test.ts）には参照禁止を適用しない（時間測定で performance などを使うため）", async () => {
    const code = "export const probe = (): number => new Date().getTime();\n";
    expect(await restrictionViolations(code, "src/data-contract/lint-probe.test.ts")).toEqual([]);
    expect(await restrictionViolations(code)).toEqual(["no-restricted-globals"]);
  });
});
