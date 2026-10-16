// CSV タブ（US6.1〜US6.3、US7.1〜US7.4、US9.2、BR7.1〜BR7.5、NFR8.2）。実際の Book に、架空の CSV を読ませて確かめる。
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Book } from "../../bookkeeping-core";
import { expectNoAxeViolations } from "../../ui-kit/test-fixtures";
import { categoryIdNamed, loadCategories, readyBook, renderInShell } from "../test-fixtures";
import { CsvScreen } from "./CsvScreen";

const HEADER = "date,type,category,amount,memo";

/** 架空の CSV（2行目と4行目は取り込める、3行目は金額が数値ではない）。 */
const VALID_AND_INVALID = [
  HEADER,
  "2026-10-01,expense,食費,1200,架空のランチ",
  "2026-10-02,expense,食費,abc,架空の不正行",
  "2026-10-03,income,給与,250000,架空の給与",
].join("\r\n");

function csvFile(text: string, name = "架空の家計簿.csv"): File {
  return new File([text], name, { type: "text/csv" });
}

function renderCsv(book: Book) {
  return renderInShell(<CsvScreen />, book, { month: "2026-10" });
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement))
    throw new Error("テストの前提のファイル入力がありません");
  return input;
}

async function upload(text: string, name?: string): Promise<void> {
  const user = userEvent.setup();
  await user.upload(fileInput(), csvFile(text, name));
}

async function countTransactions(book: Book): Promise<number> {
  const result = await book.listAllTransactions("all");
  if (!result.ok) throw new Error("テストの件数を読めませんでした");
  return result.value.length;
}

describe("CSV の取り込み", () => {
  it("ファイルを選ぶと取り込みの確認（D3）を開き、確定すると件数を知らせてファイル選択へフォーカスを戻す（US7.1、US7.2）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    renderCsv(book);
    await upload(VALID_AND_INVALID);
    expect(
      await screen.findByRole("dialog", { name: "取り込みの確認：架空の家計簿.csv" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/取り込める行：2件/)).toBeInTheDocument();
    // 理由は U1 の検証の文言をそのまま使う（BR7.2）。
    expect(
      screen.getByText("3行目：金額：1〜99,999,999 の整数で入力してください"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "2件を取り込む" }));
    expect(await screen.findByText("✓ 2件を取り込みました")).toBeInTheDocument();
    // 閉じるのは描画の後の効果で行うため、属性が消えるまで待つ。
    await waitFor(() => expect(document.querySelector("dialog")).not.toHaveAttribute("open"));
    await waitFor(() => expect(fileInput()).toHaveFocus());
    expect(await countTransactions(book)).toBe(2);
  });

  it("既存と同じ内容の行は注記するだけで、取り込み対象から外さない（BR7.3）", async () => {
    const book = await readyBook();
    const categories = await loadCategories(book);
    await book.addTransaction({
      date: "2026-10-01",
      type: "expense",
      categoryId: categoryIdNamed(categories, "食費"),
      amount: "1200",
      memo: "架空のランチ",
    });
    renderCsv(book);
    await upload(VALID_AND_INVALID);
    expect(await screen.findByText("既存と同じ内容")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2件を取り込む" })).toBeEnabled();
  });

  it("見出しの不一致は D3 を開かず、この欄に理由を出す（BR7.1）", async () => {
    const book = await readyBook();
    renderCsv(book);
    await upload("a,b,c\n1,2,3");
    expect(await screen.findByRole("alert")).toHaveTextContent("見出し行の形式が違います");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("空のファイルは「データがありません」と示し、失敗とは区別する（BR7.1）", async () => {
    const book = await readyBook();
    renderCsv(book);
    await upload("");
    expect(await screen.findByRole("status")).toHaveTextContent("データがありません");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("キャンセルは何も追加せず、ファイル選択へフォーカスを戻す（BR7.5）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    renderCsv(book);
    await upload(VALID_AND_INVALID);
    await user.click(await screen.findByRole("button", { name: "キャンセル" }));
    await waitFor(() => expect(fileInput()).toHaveFocus());
    expect(await countTransactions(book)).toBe(0);
  });

  it("Esc は何も追加せず、D3 を閉じる（BR7.5）", async () => {
    const book = await readyBook();
    renderCsv(book);
    await upload(VALID_AND_INVALID);
    await screen.findByRole("dialog", { name: "取り込みの確認：架空の家計簿.csv" });
    const nativeDialog = document.querySelector("dialog");
    if (nativeDialog === null) throw new Error("テストの前提のダイアログがありません");
    fireEvent(nativeDialog, new Event("cancel", { cancelable: true }));
    await waitFor(() => expect(nativeDialog).not.toHaveAttribute("open"));
    expect(await countTransactions(book)).toBe(0);
  });

  it("保存に失敗したら D3 の中に理由を出し、1件も追加せず、再試行できる（BR7.4）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    const originalImport = book.importTransactions.bind(book);
    vi.spyOn(book, "importTransactions").mockResolvedValueOnce({
      ok: false,
      error: { kind: "storage", message: "保存できませんでした" },
    });
    renderCsv(book);
    await upload(VALID_AND_INVALID);
    await user.click(await screen.findByRole("button", { name: "2件を取り込む" }));
    expect(
      await screen.findByText("取り込めませんでした。1件も追加していません"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: "取り込みの確認：架空の家計簿.csv" }),
    ).toBeInTheDocument();
    expect(await countTransactions(book)).toBe(0);
    vi.spyOn(book, "importTransactions").mockImplementation(originalImport);
    await user.click(screen.getByRole("button", { name: "2件を取り込む" }));
    expect(await screen.findByText("✓ 2件を取り込みました")).toBeInTheDocument();
  });

  it("確定時の行の検証の誤りは D3 を閉じず、行番号を示す（BR7.4）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    vi.spyOn(book, "importTransactions").mockResolvedValueOnce({
      ok: false,
      error: { kind: "validation", errors: [], line: 4 },
    });
    renderCsv(book);
    await upload(VALID_AND_INVALID);
    await user.click(await screen.findByRole("button", { name: "2件を取り込む" }));
    expect(await screen.findByText("4行目の内容を確認してください")).toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: "取り込みの確認：架空の家計簿.csv" }),
    ).toBeInTheDocument();
  });

  it("確定時にカテゴリが見つからないと、D3 を閉じ、ファイルを選び直す案内を出す（BR7.4）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    vi.spyOn(book, "importTransactions").mockResolvedValueOnce({
      ok: false,
      error: { kind: "rule", violation: { code: "import-category-missing", lines: [2, 4] } },
    });
    renderCsv(book);
    await upload(VALID_AND_INVALID);
    await user.click(await screen.findByRole("button", { name: "2件を取り込む" }));
    expect(
      await screen.findByText(
        "2行目、4行目のカテゴリが見つかりません。ファイルを選び直してください",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "取り込みの確認：架空の家計簿.csv" })).toBeNull();
    expect(await countTransactions(book)).toBe(0);
  });
});

describe("CSV の書き出しと読み込みの画面", () => {
  it("書き出しと読み込みの両方を同じ画面に出す（US6.1、US7.1）", async () => {
    const book = await readyBook();
    renderCsv(book);
    expect(screen.getByRole("heading", { name: "CSV 書き出し" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "CSV 読み込み" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CSV を書き出す" })).toBeInTheDocument();
    expect(within(document.body).getByLabelText("ファイルを選ぶ")).toBeInTheDocument();
  });

  it("自動のアクセシビリティ検査で違反がない（NFR2.2）", async () => {
    const book = await readyBook();
    const { container } = renderCsv(book);
    await expectNoAxeViolations(container);
  });
});
