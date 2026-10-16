// 外部への通信・保存先の直接の参照・HTML の挿入・文字列の評価がないことを、src/app の非テストファイルで確かめる（NFR1.1、NFR8.1）。
// U2 の方式と同じく、ソースの文字列を調べる。コメントの行は除く（説明の文は対象にしない）。
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// テストは対象のプロジェクトの直下（npm の実行の場所）から動く。jsdom の環境では import.meta.url を使えないため。
const APP_DIR = join(process.cwd(), "src", "app");

/** 外部の URL（http・https・プロトコル相対）。 */
const EXTERNAL_URL = /https?:\/\/|(?<![:\w])\/\/[a-z0-9-]+\.[a-z]/i;
/** 通信・保存先の直接の参照（NFR1.1）。 */
const NETWORK_OR_STORAGE =
  /\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|indexedDB|localStorage|sessionStorage|cookie)\b/;
/** HTML の挿入（NFR8.1）。 */
const HTML_INSERTION = /dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML/;
/** 文字列の評価（NFR8.1）。 */
const EVALUATION = /\beval\s*\(|new\s+Function\s*\(/;

/** 行のコメント（// や /* の行）を除いた、コードの行だけを返す。 */
function codeLines(source: string): string[] {
  return source.split("\n").filter((line) => {
    const trimmed = line.trim();
    return !(trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*"));
  });
}

/** 非テストの TypeScript ファイル（src/app 以下）を、ディレクトリを下って集める。 */
function appSourceFiles(directory: string = APP_DIR): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return appSourceFiles(path);
    const isSource = /\.(ts|tsx)$/.test(name);
    const isTest = /\.test\.(ts|tsx)$/.test(name) || name === "test-fixtures.ts";
    return isSource && !isTest ? [path] : [];
  });
}

/** 調べる規則に当たった行を、ファイルの名前つきで返す。 */
function violationsIn(source: string, pattern: RegExp, file: string): string[] {
  return codeLines(source)
    .filter((line) => pattern.test(line))
    .map((line) => `${file}: ${line.trim()}`);
}

function scan(pattern: RegExp): string[] {
  return appSourceFiles().flatMap((file) =>
    violationsIn(readFileSync(file, "utf8"), pattern, file),
  );
}

describe("src/app の外部への参照の検査", () => {
  it("非テストファイルに外部の URL がない（NFR1.1）", () => {
    expect(scan(EXTERNAL_URL)).toEqual([]);
  });

  it("通信・保存先の直接の参照がない（NFR1.1、U7 は保存を U4 の窓口だけで行う）", () => {
    expect(scan(NETWORK_OR_STORAGE)).toEqual([]);
  });

  it("HTML の挿入がない（NFR8.1）", () => {
    expect(scan(HTML_INSERTION)).toEqual([]);
  });

  it("文字列の評価がない（NFR8.1）", () => {
    expect(scan(EVALUATION)).toEqual([]);
  });

  it("検査の道具が違反を見つけられる（常に通るテストにしない）", () => {
    const sample =
      'const x = fetch("https://example.invalid/data");\nel.innerHTML = "x";\neval("1");';
    const lines = codeLines(sample);
    expect(lines.some((line) => EXTERNAL_URL.test(line))).toBe(true);
    expect(lines.some((line) => NETWORK_OR_STORAGE.test(line))).toBe(true);
    expect(lines.some((line) => HTML_INSERTION.test(line))).toBe(true);
    expect(lines.some((line) => EVALUATION.test(line))).toBe(true);
  });

  it("検査の対象のファイルが実際にある（空の検査で通さない）", () => {
    const files = appSourceFiles();
    expect(files.length).toBeGreaterThan(10);
    expect(files.some((file) => file.endsWith("App.tsx"))).toBe(true);
  });
});
