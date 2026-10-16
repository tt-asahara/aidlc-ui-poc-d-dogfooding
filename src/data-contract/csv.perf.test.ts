// decodeCsv の時間測定（NFR3.1、NFR8.4）。合格条件は 1,000ms 以内、目標 300ms を超えたら警告する。
import { describe, expect, it } from "vitest";
import { decodeCsv } from "./csv";
import { fictionalCsvText } from "./test-fixtures";

const PASS_LIMIT_MS = 1000;
const TARGET_MS = 300;
const ONE_MB = 1024 * 1024;

function measureDecode(label: string, text: string) {
  decodeCsv(text); // 1回目は JIT の準備として捨てる
  const started = performance.now();
  const result = decodeCsv(text);
  const elapsedMs = performance.now() - started;
  console.log(`[NFR3.1] ${label}: decodeCsv ${elapsedMs.toFixed(1)}ms`);
  if (elapsedMs > TARGET_MS) {
    console.warn(
      `[NFR3.1] ${label}: 目標 ${TARGET_MS}ms を超えました（${elapsedMs.toFixed(1)}ms）`,
    );
  }
  return { result, elapsedMs };
}

describe("decodeCsv の時間（NFR3.1、NFR8.4）", () => {
  it("5,000 レコード（1MB 以内）の架空 CSV を 1,000ms 以内に復号する", () => {
    const text = fictionalCsvText(5000);
    expect(new TextEncoder().encode(text).byteLength).toBeLessThanOrEqual(ONE_MB);
    const { result, elapsedMs } = measureDecode("5,000 レコード", text);
    expect(result.ok && result.value).toHaveLength(5000);
    expect(result.ok && result.value[4999]?.line).toBe(5001);
    expect(elapsedMs).toBeLessThan(PASS_LIMIT_MS);
  });

  it("1行 1MB の引用付きの値を含む CSV を 1,000ms 以内に復号する", () => {
    const unit = 'ab,"" ';
    const longValue = unit.repeat(Math.floor(ONE_MB / unit.length));
    const quoted = `"${longValue.replace(/"/g, '""')}"`;
    const text = `date,type,category,amount,memo\r\n2026-10-01,expense,架空の食費,1,${quoted}\r\n`;
    const { result, elapsedMs } = measureDecode("1行 1MB", text);
    expect(result.ok && result.value[0]?.record.memo).toBe(longValue);
    expect(elapsedMs).toBeLessThan(PASS_LIMIT_MS);
  });

  it("閉じていない引用の 1MB の値も有限の時間で malformed を返す", () => {
    const text = `date,type,category,amount,memo\n2026-10-01,expense,架空,1,"${"a".repeat(ONE_MB)}`;
    const { result, elapsedMs } = measureDecode("閉じない引用 1MB", text);
    expect(!result.ok && result.error).toMatchObject({ kind: "malformed", line: 2 });
    expect(elapsedMs).toBeLessThan(PASS_LIMIT_MS);
  });
});
