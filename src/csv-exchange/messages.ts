// U6 が作る固定の文言（NFR8.3、functional-spec.md 第3章、security-design.md 第2章・第4章）。入力値は埋め込まない。
// 値の検証の失敗の文言は U1 の ValidationError.message をそのまま使うため、ここには持たない（Q2 = A）。
export const CSV_MESSAGES = {
  /** 列の数が5でない行（BR3.1） */
  columnCount: "列の数が違います（5列にしてください）",
  /** カテゴリが別の種別にだけある（BR3.3） */
  categoryTypeMismatch: "カテゴリ：種別と一致しません",
  /** カテゴリがどの種別にもない（BR3.3） */
  categoryNotFound: "カテゴリ：見つかりません",
  /** UTF-8 として正しくないバイト列（BR2.2） */
  notUtf8: "UTF-8 の CSV ファイルを選んでください",
  /** ファイルを読めない、または読み込み中の想定外の例外（BR2.2、BR5.2） */
  readFailed: "ファイルを読み込めませんでした",
  /** 読み込み中に Book（U4）の呼び出しで起きた想定外の例外（BR5.2。U4 の読み取りの文言と同じ） */
  unexpectedRead: "データを読み込めませんでした",
  /** 確定中の想定外の例外（BR5.2） */
  unexpectedCommit: "保存できませんでした",
  /** 書き出し中の想定外の例外（BR5.2） */
  unexpectedExport: "書き出せませんでした",
} as const satisfies Record<string, string>;
