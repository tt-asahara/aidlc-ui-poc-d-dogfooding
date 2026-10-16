// 画面の文言の固定（BR1.1、BR3.5、BR7.1、BR7.4）。文言は規則のとおりに表示されることを確かめる。
import { describe, expect, it } from "vitest";
import { APP_MESSAGES, SAVE_FAILED_TEXT, STALE_SELECTION_TEXT } from "./messages";

describe("画面の文言", () => {
  it("別のタブでの食い違いは1つの文言にまとめる（BR3.5）", () => {
    expect(STALE_SELECTION_TEXT).toBe("選んだカテゴリが見つかりません。画面を更新してください");
  });

  it("保存失敗の文言は入力が残ることを示す（BR8.3）", () => {
    expect(SAVE_FAILED_TEXT).toBe("保存できませんでした。入力内容はそのまま残っています。");
  });

  it("起動の文言は読み込み中・新しい版・保存領域の順に固定する（BR1.2、BR1.6、BR8.4）", () => {
    expect(APP_MESSAGES.boot.subject).toBe("保存データ");
    expect(APP_MESSAGES.boot.unavailableHint).toBe("通常のウィンドウで開き直してください。");
    expect(APP_MESSAGES.boot.newerVersionHint).toContain("データは変更していません。");
  });

  it("確認の件数の文言を、入力エラーの件数で作る", () => {
    expect(APP_MESSAGES.transactions.summaryErrors(2)).toBe("2件の項目を確認してください");
  });

  it("CSV の行番号の形式は「｛行｝行目：」（BR7.1）", () => {
    expect(APP_MESSAGES.csv.malformedPrefix(4)).toBe("4行目：");
  });

  it("CSV の固定の理由は規則の文言と同じ（BR7.1）", () => {
    expect(APP_MESSAGES.csv.empty).toBe("データがありません");
    expect(APP_MESSAGES.csv.tooLarge).toBe("1MB を超えるファイルは読み込めません");
    expect(APP_MESSAGES.csv.tooManyRows).toBe("5,000 行を超えるファイルは読み込めません");
  });

  it("カテゴリが見つからない行は行番号を「、」で並べる（BR7.4）", () => {
    expect(APP_MESSAGES.importPreview.categoryMissing([2, 5])).toBe(
      "2行目、5行目のカテゴリが見つかりません。ファイルを選び直してください",
    );
  });

  it("予算の空欄の案内は設定を外すの操作を指す（BR4.2）", () => {
    expect(APP_MESSAGES.budget.emptyInput).toBe("設定を外すには［設定を外す］を使ってください");
  });
});
