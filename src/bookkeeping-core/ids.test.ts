// id と日時の既定のテスト（security-design.md 第6章）。
import { describe, expect, it } from "vitest";
import { defaultNewId, defaultNow, formatUuidV4, newIdFrom } from "./ids";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("ids", () => {
  it("既定の newId は UUID v4 の形で、呼ぶたびに違う値になる", () => {
    const first = defaultNewId();
    const second = defaultNewId();
    expect(first).toMatch(UUID_V4);
    expect(second).toMatch(UUID_V4);
    expect(first).not.toBe(second);
  });

  it("randomUUID があればその値をそのまま使う", () => {
    expect(newIdFrom({ randomUUID: () => "架空の-id" })).toBe("架空の-id");
  });

  it("randomUUID がなければ getRandomValues で UUID v4 を作る", () => {
    const filled = (array: Uint8Array<ArrayBuffer>) => array.fill(0xff);
    expect(newIdFrom({ getRandomValues: filled })).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
    const zeros = (array: Uint8Array<ArrayBuffer>) => array.fill(0);
    expect(newIdFrom({ getRandomValues: zeros })).toBe("00000000-0000-4000-8000-000000000000");
  });

  it("formatUuidV4 は版 4・変種 10 のビットを立て、順にバイトを並べる", () => {
    const bytes = Uint8Array.from({ length: 16 }, (_, i) => i);
    expect(formatUuidV4(bytes)).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
    expect(formatUuidV4(bytes)).toMatch(UUID_V4);
  });

  it("足りないバイトは 0 として扱う（例外にしない）", () => {
    expect(formatUuidV4(new Uint8Array(0))).toBe("00000000-0000-4000-8000-000000000000");
  });

  it("crypto が使えない環境では例外で知らせる（Book は storage の失敗として返す）", () => {
    expect(() => newIdFrom(undefined)).toThrow("id を作れません");
    expect(() => newIdFrom({})).toThrow("id を作れません");
  });

  it("既定の now は実際の時計の Date を返す", () => {
    const before = Date.now();
    const now = defaultNow();
    expect(now).toBeInstanceOf(Date);
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
