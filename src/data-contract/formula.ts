// CSV の数式対策（BR4.5、BR4.6）。escapeFormula と unescapeFormula は互いに逆で、往復で値が戻る。

const FORMULA_TRIGGERS = new Set(["=", "+", "-", "@"]);
const QUOTE = "'";

/** ' の直後にあると「対策済み」とみなす文字（= + - @ と '）。 */
function isEscapedAfterQuote(char: string | undefined): boolean {
  return char !== undefined && (FORMULA_TRIGGERS.has(char) || char === QUOTE);
}

/**
 * 書き出す値が表計算ソフトで数式として解釈されないよう、先頭に ' を1つ付ける（BR4.5）。
 * 先頭が = + - @ の値と、' の直後が = + - @ ' の値が対象。それ以外は変えない。
 */
export function escapeFormula(value: string): string {
  const first = value[0];
  if (first === undefined) return value;
  if (FORMULA_TRIGGERS.has(first)) return QUOTE + value;
  if (first === QUOTE && isEscapedAfterQuote(value[1])) return QUOTE + value;
  return value;
}

/** escapeFormula で付けた先頭の ' を1つ外す（BR4.6）。 */
export function unescapeFormula(value: string): string {
  if (value[0] === QUOTE && isEscapedAfterQuote(value[1])) return value.slice(1);
  return value;
}
