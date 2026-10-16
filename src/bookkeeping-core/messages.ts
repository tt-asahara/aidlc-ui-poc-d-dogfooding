// U4 が作る検証エラーと保存失敗の固定の文言（NFR8.3、security-design.md 第4章）。入力値は埋め込まない。
// 月・種別の文言は U1 の同じ項目の文言と同じにする（U1 の公開窓口は文言を出していないため、ここに固定で持ち、
// messages.test.ts で U1 の文言と一致することを確かめる）。
export const CORE_MESSAGES = {
  monthInvalid: "対象月：YYYY-MM の形で 2000-01〜2099-12 を指定してください",
  typeInvalid: "種別：income（収入）か expense（支出）を指定してください",
  /** 書き込み中の想定外の例外（security-design.md 第1章） */
  unexpectedWrite: "保存できませんでした",
  /** 読み取り中の想定外の例外 */
  unexpectedRead: "データを読み込めませんでした",
} as const satisfies Record<string, string>;
