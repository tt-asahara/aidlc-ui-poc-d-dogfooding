// ESLint の src/app のブロックが、禁止の一覧と import の規則を実際に守らせていることを確かめる（security-design.md 2章）。
// 対象のファイル名は実在する src/app のファイルにする（型の情報を使う規則のため）。ESLint は1回だけ作る。
import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

let eslint: ESLint;

beforeAll(async () => {
  eslint = new ESLint();
  // 最初の検査は型の情報（TypeScript の計画）を組むため時間がかかる。ここで一度だけ済ませる。
  await eslint.lintText("export {};\n", { filePath: APP_FILE });
}, 120_000);

/** 与えたコードを、指定のファイルの場所として検査した違反（ルール名と文言）を返す。 */
async function violationsOf(
  code: string,
  filePath: string,
): Promise<{ ruleId: string | null; message: string }[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map((item) => ({ ruleId: item.ruleId, message: item.message }));
}

const APP_FILE = "src/app/App.tsx";
const SCREEN_FILE = "src/app/screens/TransactionList.tsx";

describe("ESLint の src/app の規則", () => {
  it("公開窓口（index）の import は許可する", async () => {
    const code = 'import { openBook } from "../bookkeeping-core";\nexport const book = openBook;\n';
    const found = await violationsOf(code, APP_FILE);
    expect(found.filter((item) => item.ruleId === "no-restricted-imports")).toEqual([]);
  });

  it("内部ファイルの import は違反にする（画面の深さが違っても同じ）", async () => {
    const top = await violationsOf(
      'import { openBook } from "../bookkeeping-core/book";\nexport const x = openBook;\n',
      APP_FILE,
    );
    expect(top.some((item) => item.ruleId === "no-restricted-imports")).toBe(true);
    const deeper = await violationsOf(
      'import { x } from "../../data-contract/budget";\nexport const y = x;\n',
      SCREEN_FILE,
    );
    expect(deeper.some((item) => item.ruleId === "no-restricted-imports")).toBe(true);
  });

  it("U3 storage の直接の import は違反にする（保存は U4 の窓口だけ）", async () => {
    const code = 'import { openStorage } from "../storage";\nexport const x = openStorage;\n';
    const found = await violationsOf(code, APP_FILE);
    const storage = found.find((item) => item.ruleId === "no-restricted-imports");
    expect(storage?.message).toContain("U3 storage");
  });

  it("通信と保存先の直接の参照は違反にする（NFR1.1、NFR8.1）", async () => {
    const code =
      'export const load = () => fetch("/data");\nexport const store = () => localStorage.getItem("x");\n';
    const found = await violationsOf(code, APP_FILE);
    const rules = found.map((item) => item.ruleId);
    expect(rules).toContain("no-restricted-globals");
  });

  it("HTML の挿入は違反にする（NFR8.1）", async () => {
    const code =
      "export function put(el: HTMLElement, text: string) {\n  el.innerHTML = text;\n}\n";
    const found = await violationsOf(code, SCREEN_FILE);
    expect(found.some((item) => item.ruleId === "no-restricted-syntax")).toBe(true);
  });

  it("テストのファイルには適用しない", async () => {
    const code = 'export const load = () => fetch("/data");\n';
    const found = await violationsOf(code, "src/app/App.test.tsx");
    expect(found.filter((item) => item.ruleId === "no-restricted-globals")).toEqual([]);
  });
});
