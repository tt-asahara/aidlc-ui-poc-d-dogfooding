// id と日時の既定（security-design.md 第6章）。どちらも同期の関数で、書き込み処理の中で待ちを生まない（BR6.4）。

/** id を作るのに使う crypto の機能（テストで「randomUUID がない環境」を再現できるよう、必要な部分だけにする）。 */
export interface RandomSource {
  randomUUID?: () => string;
  getRandomValues?: (array: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>;
}

const UUID_BYTES = 16;

/** 既定の時計（実際の時計）。 */
export function defaultNow(): Date {
  return new Date();
}

/** 既定の id。crypto.randomUUID、なければ crypto.getRandomValues で UUID v4 を作る。 */
export function defaultNewId(): string {
  return newIdFrom(globalThis.crypto);
}

/**
 * source から UUID v4 の文字列を作る。
 * randomUUID は安全な環境（https・localhost）でだけ使えるため、ない場合は getRandomValues で同じ形を作る。
 * どちらもない環境は IndexedDB も実質使えない（openBook の時点で unavailable になる）ため、例外で知らせる
 * （書き込み処理の中の例外は U3 が write-failed にし、Book は storage の失敗として返す）。
 */
export function newIdFrom(source: RandomSource | undefined): string {
  if (source?.randomUUID !== undefined) return source.randomUUID();
  if (source?.getRandomValues !== undefined) {
    return formatUuidV4(source.getRandomValues(new Uint8Array(UUID_BYTES)));
  }
  throw new Error("id を作れません（crypto が使えない環境です）");
}

/** 16 バイトの乱数を UUID v4（RFC 9562 の版 4・変種 10）の文字列にする。 */
export function formatUuidV4(random: Uint8Array): string {
  const bytes = Array.from({ length: UUID_BYTES }, (_, i) => random[i] ?? 0);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}
