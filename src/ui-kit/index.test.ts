// 公開窓口のテスト（C6）。U7 が使う部品・定数・トークンが index.ts からすべて取れることを確かめる。
import { describe, expect, it } from "vitest";
import * as uiKit from "./index";

describe("ui-kit の公開窓口（C6）", () => {
  it("C6 の部品 11 種がすべて関数として公開されている", () => {
    const components = [
      "Button",
      "TextField",
      "Select",
      "RadioGroup",
      "FieldError",
      "DataTable",
      "Dialog",
      "StatusPanel",
      "InlineMessage",
      "FileInput",
      "Tabs",
    ] as const;
    for (const name of components) {
      expect(typeof uiKit[name], name).toBe("function");
    }
  });

  it("既定値の定数とデザイントークンが公開されている", () => {
    expect(uiKit.DEFAULT_BUSY_LABEL).toBe("処理中…");
    expect(uiKit.DEFAULT_SLOW_AFTER_MS).toBe(5000);
    expect(uiKit.DEFAULT_AUTO_HIDE_MS).toBe(5000);
    expect(uiKit.color.primary).toBe("#0b5cad");
    expect(uiKit.size.targetMin).toBe("44px");
    expect(uiKit.breakpoints.medium).toBe(768);
  });

  it("内部の補助（StatusPanel の文言表など）は公開しない", () => {
    expect(Object.keys(uiKit)).not.toContain("statusView");
  });
});
