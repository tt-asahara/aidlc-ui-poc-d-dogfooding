// 計測は DEV の分岐の中だけに記録する（performance-design 3章）。本番では記録しない。
import { afterEach, describe, expect, it, vi } from "vitest";
import { perfSamples, recordPerf } from "./perf";

describe("計測（perf）", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("DEV のとき、操作の時間を perf: の印つきで記録する", () => {
    vi.stubEnv("DEV", true);
    const before = perfSamples().length;
    recordPerf("month-switch", 12.5);
    const added = perfSamples().slice(before);
    expect(added).toEqual([{ name: "perf:month-switch", durationMs: 12.5 }]);
  });

  it("DEV でないとき（本番）は何も記録しない", () => {
    vi.stubEnv("DEV", false);
    const before = perfSamples().length;
    recordPerf("month-switch", 99);
    expect(perfSamples().length).toBe(before);
  });
});
