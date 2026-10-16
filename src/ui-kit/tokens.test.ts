// デザイントークンのテスト（NFR2.4、BR1.1・BR1.2・BR2.2・BR2.3・BR4.2）。
// jsdom では描画色を計算できないため、トークンの値から WCAG 2.1 の相対輝度の式でコントラスト比を計算する。
// 実ブラウザでの見え方の確認（B5）は U7 の Build and Test で行う。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { color, cssVariables } from "./tokens";

/** WCAG 2.1 の相対輝度（sRGB）。 */
function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (match === null) throw new Error(`16 進の色ではありません: ${hex}`);
  const [r, g, b] = match.slice(1).map((part) => {
    const channel = Number.parseInt(part, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 のコントラスト比（1〜21）。 */
function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (a, b) => b - a,
  ) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}

const TOKENS_CSS = readFileSync(join(import.meta.dirname, "tokens.css"), "utf8");
const UI_KIT_CSS = readFileSync(join(import.meta.dirname, "ui-kit.css"), "utf8");

/** tokens.css の最初の :root ブロックにある CSS 変数を読む。 */
function rootVariables(css: string): Record<string, string> {
  const block = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  const variables: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    if (name !== undefined && value !== undefined) variables[name] = value.trim();
  }
  return variables;
}

describe("コントラスト比の計算（WCAG 2.1 の式）", () => {
  it("白と黒は 21:1、同じ色は 1:1 になる", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#0B5CAD", "#0B5CAD")).toBeCloseTo(1, 5);
  });

  it("16 進の色でない値は例外にする", () => {
    expect(() => relativeLuminance("blue")).toThrow("16 進の色ではありません");
    expect(() => relativeLuminance("#FFF")).toThrow();
  });
});

describe("トークンの色の組み合わせ（NFR2.4）", () => {
  it.each([
    ["本文", color.text, color.bg],
    ["本文（表の見出し・パネルの背景）", color.text, color.surface],
    ["本文（警告パネルの背景）", color.text, color.warningBg],
    ["補足文", color.textMuted, color.bg],
    ["補足文（パネルの背景）", color.textMuted, color.surface],
    ["主ボタンの白文字", color.bg, color.primary],
    ["危険ボタンの文字", color.danger, color.bg],
    ["成功の記号", color.success, color.bg],
    ["エラーの記号（警告パネルの背景）", color.danger, color.warningBg],
  ])("文字: %s は 4.5:1 以上", (_label, foreground, background) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["入力欄・部品の枠", color.border, color.bg],
    ["フォーカスリング", color.focus, color.bg],
    ["選択中のタブの下線", color.primary, color.bg],
    ["エラーの枠", color.danger, color.bg],
  ])("部品の枠とフォーカス: %s は 3:1 以上", (_label, foreground, background) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(3);
  });
});

describe("tokens.css と tokens.ts の一致（BR1.1）", () => {
  it("tokens.css の CSS 変数は tokens.ts と同じ名前と値を持つ", () => {
    expect(rootVariables(TOKENS_CSS)).toEqual(cssVariables);
  });

  it("動きを減らす設定では --motion-duration を 0 にする（BR1.2）", () => {
    expect(TOKENS_CSS).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*:root\s*\{\s*--motion-duration:\s*0ms;/,
    );
  });
});

describe("ui-kit.css の規則（BR2.2・BR2.3・BR4.2・BR1.2）", () => {
  it("フォーカスリングは 2px 実線＋2px 余白で、outline を消さない（BR2.2）", () => {
    expect(UI_KIT_CSS).toContain(
      "outline: var(--focus-ring-width) solid var(--color-focus);\n  outline-offset: var(--focus-ring-offset);",
    );
    expect(UI_KIT_CSS).not.toMatch(/outline:\s*(none|0)/);
  });

  it("ボタン・入力欄・タブの最小の高さは 44px のトークンを使う（BR2.3）", () => {
    const minHeights = UI_KIT_CSS.match(/min-height: var\(--target-min\);/g) ?? [];
    expect(minHeights.length).toBeGreaterThanOrEqual(5);
  });

  it("768px 未満で表をカード表示にし、動きを減らす設定で動きを止める（BR4.2・BR1.2）", () => {
    expect(UI_KIT_CSS).toContain("@media (max-width: 767px)");
    expect(UI_KIT_CSS).toContain("content: attr(data-label);");
    expect(UI_KIT_CSS).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("色は CSS 変数だけを使い、16 進の色を直接書かない（BR1.1）", () => {
    expect(UI_KIT_CSS).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
