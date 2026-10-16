// 検証エラーの固定文言の定数表（BR6.1、NFR8.3）。
// 文言は rules.md の violation のとおり。入力値を差し込む書式は持たない。
export const MESSAGES = {
  dateRequired: "日付を入力してください",
  dateInvalid: "日付：存在する日付を YYYY-MM-DD で入力してください",
  dateOutOfRange: "日付：2000-01-01〜2099-12-31 の日付を入力してください",
  monthInvalid: "対象月：YYYY-MM の形で 2000-01〜2099-12 を指定してください",
  typeInvalid: "種別：income（収入）か expense（支出）を指定してください",
  categoryRequired: "カテゴリを選んでください",
  csvCategoryRequired: "カテゴリを指定してください",
  amountRequired: "金額を入力してください",
  amountInvalid: "金額：1〜99,999,999 の整数で入力してください",
  memoTooLong: "メモ：200文字以内で入力してください",
  // rules.md に文言の定めがない「メモが文字列でない」場合の文言（コード生成で追加）。
  memoNotText: "メモ：文字で入力してください",
  categoryNameBlank: "カテゴリ名を入力してください",
  categoryNameTooLong: "カテゴリ名：20文字以内で入力してください",
  categoryNameDuplicate: "カテゴリ名：同じ種別に同じ名前があります",
  budgetRequired: "予算額を入力してください",
  budgetInvalid: "予算額：0〜99,999,999 の整数で入力してください",
} as const satisfies Record<string, string>;
