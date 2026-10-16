// 対象月の計算（BR1.4）。初期値は今月（ローカルの日付）。範囲は 2000-01〜2099-12。
import { describe, expect, it } from "vitest";
import { canShiftYearMonth, currentYearMonth, localIsoDate, shiftYearMonth } from "./appState";

describe("対象月の計算", () => {
  it("初期値はローカルの今月と今日（BR1.4、BR2.1）", () => {
    const now = new Date(2026, 9, 16, 23, 59, 0);
    expect(currentYearMonth(now)).toBe("2026-10");
    expect(localIsoDate(now)).toBe("2026-10-16");
  });

  it("前後の月へ1か月ずらし、年をまたぐ", () => {
    expect(shiftYearMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftYearMonth("2027-01", -1)).toBe("2026-12");
  });

  it("2000-01 と 2099-12 の外には出ない", () => {
    expect(shiftYearMonth("2000-01", -1)).toBe("2000-01");
    expect(shiftYearMonth("2099-12", 1)).toBe("2099-12");
    expect(canShiftYearMonth("2000-01", -1)).toBe(false);
    expect(canShiftYearMonth("2000-02", -1)).toBe(true);
  });
});
