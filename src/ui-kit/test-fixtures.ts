// U2 ui-kit のテストで共通に使う道具（テスト専用。カバレッジの対象外）。
import axe from "axe-core";
import { expect } from "vitest";

/**
 * 自動のアクセシビリティ検査（NFR2.1）。WCAG 2.0・2.1 の A と AA の規則で検査し、違反0件を確かめる。
 * jsdom は描画色を計算できないため color-contrast は外し、tokens.test.ts のコントラスト計算と
 * 実ブラウザ確認（B5）で補う。
 */
export async function expectNoAxeViolations(container: Element): Promise<void> {
  const results = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    rules: { "color-contrast": { enabled: false } },
  });
  const summary = results.violations.map((violation) => ({
    id: violation.id,
    help: violation.help,
    targets: violation.nodes.map((node) => node.target.join(" ")),
  }));
  expect(summary).toEqual([]);
}
