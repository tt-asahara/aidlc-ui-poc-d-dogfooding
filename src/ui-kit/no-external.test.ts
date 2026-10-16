// 外部資源の検出（NFR1.1、BR1.1、security-design.md 第4章）。src/ui-kit/ の CSS・ts・tsx（テストを除く）を読み、
// 外部の URL や CSS の取り込みを含まないことを確かめる。`//` 単独は行コメントと区別できないため対象にしない。
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const UI_KIT_DIR = import.meta.dirname;
const FORBIDDEN_PATTERNS = ["url(http", "url(//", "@import", "http://", "https://"] as const;

function sourceFiles(): string[] {
  return readdirSync(UI_KIT_DIR)
    .filter((name) => /\.(css|ts|tsx)$/.test(name))
    .filter((name) => !/\.test\.(ts|tsx)$/.test(name));
}

/** 文字列の中に禁止の書き方があれば、その書き方の一覧を返す（大文字小文字を区別しない）。 */
function findExternalReferences(content: string): string[] {
  const lower = content.toLowerCase();
  return FORBIDDEN_PATTERNS.filter((pattern) => lower.includes(pattern));
}

describe("src/ui-kit/ に外部資源の参照がない（NFR1.1）", () => {
  it("検査の対象に部品・トークン・CSS のファイルが含まれる", () => {
    const files = sourceFiles();
    expect(files).toEqual(
      expect.arrayContaining(["tokens.css", "ui-kit.css", "tokens.ts", "Dialog.tsx", "index.ts"]),
    );
    expect(files.some((name) => name.includes(".test."))).toBe(false);
  });

  it.each(sourceFiles())("%s に url(http・url(//・@import・http://・https:// がない", (name) => {
    const content = readFileSync(join(UI_KIT_DIR, name), "utf8");
    expect(findExternalReferences(content)).toEqual([]);
  });

  it("検出の仕組みは外部の URL と CSS の取り込みを見つけ、行コメントの // だけでは反応しない", () => {
    expect(findExternalReferences('@import url("https://example.invalid/a.css");')).toEqual([
      "@import",
      "https://",
    ]);
    expect(findExternalReferences("background: URL(//cdn.example.invalid/a.png);")).toEqual([
      "url(//",
    ]);
    expect(findExternalReferences("src: url(http://example.invalid/font.woff2);")).toEqual([
      "url(http",
      "http://",
    ]);
    expect(findExternalReferences("// 架空のコメント\nconst value = 1;")).toEqual([]);
  });
});
