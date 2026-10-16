// 文字列の正規化と数え方（標準機能だけを使う。tech-stack-decisions.md）。

const graphemeSegmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });

/** 書記素（見た目の1文字）の数を数える。上限を超えた時点で数えるのをやめる。 */
export function countGraphemes(value: string, stopAfter = Number.POSITIVE_INFINITY): number {
  const segments = graphemeSegmenter.segment(value)[Symbol.iterator]();
  let count = 0;
  while (count <= stopAfter && !segments.next().done) {
    count += 1;
  }
  return count;
}

/** 前後の空白（全角空白・タブ・CR・LF を含む）を除く。 */
export function trimText(value: string): string {
  return value.trim();
}

/** 全角数字を半角に、全角カンマを半角カンマに直す（BR1.3）。 */
export function normalizeDigits(value: string): string {
  return value
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
    .replace(/，/g, ",");
}

/** 値が文字列で、前後の空白を除いて空でないか。 */
export function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && trimText(value) !== "";
}
