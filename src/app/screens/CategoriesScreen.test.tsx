// カテゴリタブ（US3.1〜US3.4、US9.2、BR3.1〜BR3.5）。一覧、追加の検証、名前の変更と取り消し、使用中・最後の1件の理由、D2 の予算の件数、確定の失敗、食い違い、フォーカス。
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Book } from "../../bookkeeping-core";
import { expectNoAxeViolations } from "../../ui-kit/test-fixtures";
import { categoryIdNamed, loadCategories, readyBook, renderInShell } from "../test-fixtures";
import { CategoriesScreen } from "./CategoriesScreen";

function renderCategories(book: Book) {
  const onNewerVersion = vi.fn<() => void>();
  const view = renderInShell(<CategoriesScreen />, book, { onNewerVersion });
  return { ...view, onNewerVersion };
}

/** カテゴリ名のセルの行（tr）を返す。 */
async function rowOf(name: string): Promise<HTMLElement> {
  const cell = await screen.findByRole("rowheader", { name });
  const row = cell.closest("tr");
  if (row === null) throw new Error("行が見つかりません");
  return row;
}

/** 行の下に出た理由（行の中の警告）を探す。 */
function rowMessage(row: HTMLElement, text: string): HTMLElement {
  return within(row).getByText(text);
}

describe("カテゴリの一覧", () => {
  it("初期の支出7件と収入3件を種別ごとに表示し、使用件数を文字で示す（BR3.1）", async () => {
    const book = await readyBook();
    renderCategories(book);
    expect(await screen.findByRole("table", { name: "支出カテゴリ（7件）" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "収入カテゴリ（3件）" })).toBeInTheDocument();
    const food = await rowOf("食費");
    expect(within(food).getByText("0件")).toBeInTheDocument();
  });

  it("収支で使われている件数を反映する（BR3.1）", async () => {
    const book = await readyBook();
    const categories = await loadCategories(book);
    await book.addTransaction({
      date: "2026-10-01",
      type: "expense",
      categoryId: categoryIdNamed(categories, "食費"),
      amount: "1200",
      memo: "架空のランチ",
    });
    renderCategories(book);
    const food = await rowOf("食費");
    expect(within(food).getByText("1件")).toBeInTheDocument();
  });
});

describe("カテゴリの追加", () => {
  it("名前と種別を入れて追加すると、知らせを出し、一覧に加える（US3.2）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    renderCategories(book);
    await screen.findByRole("table", { name: "支出カテゴリ（7件）" });
    await user.type(screen.getByRole("textbox", { name: "名前" }), "架空の趣味");
    await user.click(screen.getByRole("button", { name: "追加する" }));
    expect(await screen.findByText("✓ 架空の趣味を追加しました")).toBeInTheDocument();
    expect(await screen.findByRole("table", { name: "支出カテゴリ（8件）" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "名前" })).toHaveValue("");
  });

  it.each([
    ["食費", "重複"],
    ["   ", "空白のみ"],
    ["あ".repeat(21), "21文字"],
  ])(
    "追加の検証（%s、%s）は欄の下に U1 の文言を出し、入力欄へフォーカスを残す（US3.2）",
    async (value) => {
      const user = userEvent.setup();
      const book = await readyBook();
      renderCategories(book);
      const name = await screen.findByRole("textbox", { name: "名前" });
      await user.type(name, value);
      await user.click(screen.getByRole("button", { name: "追加する" }));
      expect(await screen.findByText(/^名前：/)).toBeInTheDocument();
      expect(name).toHaveAttribute("aria-invalid", "true");
      expect(name).toHaveFocus();
    },
  );

  it("保存に失敗したら入力を残し、一覧には加えない（BR8.3）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    vi.spyOn(book, "addCategory").mockResolvedValue({
      ok: false,
      error: { kind: "storage", message: "保存できませんでした" },
    });
    renderCategories(book);
    const name = await screen.findByRole("textbox", { name: "名前" });
    await user.type(name, "架空の趣味");
    await user.click(screen.getByRole("button", { name: "追加する" }));
    expect(
      await screen.findByText("保存できませんでした。入力内容はそのまま残っています。"),
    ).toBeInTheDocument();
    expect(name).toHaveValue("架空の趣味");
    expect(screen.getByRole("table", { name: "支出カテゴリ（7件）" })).toBeInTheDocument();
  });
});

describe("カテゴリの名前の変更", () => {
  it("名前を変更は入力欄に変わり、Esc で取り消して「名前を変更」へフォーカスを戻す（BR3.3）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    renderCategories(book);
    const entertainment = await rowOf("娯楽");
    await user.click(within(entertainment).getByRole("button", { name: "娯楽の名前を変更" }));
    const input = within(entertainment).getByRole("textbox", { name: "娯楽の名前を変更" });
    expect(input).toHaveFocus();
    await user.clear(input);
    await user.type(input, "架空の遊び");
    await user.keyboard("{Escape}");
    expect(
      within(await rowOf("娯楽")).getByRole("button", { name: "娯楽の名前を変更" }),
    ).toHaveFocus();
    expect(await rowOf("娯楽")).toHaveTextContent("娯楽");
  });

  it("Enter で保存すると名前が変わり、一覧と知らせに反映する（BR3.3）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    renderCategories(book);
    const entertainment = await rowOf("娯楽");
    await user.click(within(entertainment).getByRole("button", { name: "娯楽の名前を変更" }));
    const input = within(entertainment).getByRole("textbox", { name: "娯楽の名前を変更" });
    await user.clear(input);
    await user.type(input, "架空の遊び{Enter}");
    expect(await screen.findByText("✓ 名前を変更しました")).toBeInTheDocument();
    expect(await screen.findByRole("rowheader", { name: "架空の遊び" })).toBeInTheDocument();
  });

  it("名前の検証の失敗は入力欄の下に出し、入力を残す（US3.3）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    renderCategories(book);
    const entertainment = await rowOf("娯楽");
    await user.click(within(entertainment).getByRole("button", { name: "娯楽の名前を変更" }));
    const input = within(entertainment).getByRole("textbox", { name: "娯楽の名前を変更" });
    await user.clear(input);
    await user.type(input, "食費");
    await user.click(within(entertainment).getByRole("button", { name: "保存" }));
    expect(await within(entertainment).findByText(/^名前：/)).toBeInTheDocument();
    expect(input).toHaveValue("食費");
  });

  it("別のタブで消えていた行の名前変更は、同じ文言と画面の更新を促す（BR3.5）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    vi.spyOn(book, "renameCategory").mockResolvedValue({
      ok: false,
      error: { kind: "rule", violation: { code: "not-found" } },
    });
    renderCategories(book);
    const entertainment = await rowOf("娯楽");
    await user.click(within(entertainment).getByRole("button", { name: "娯楽の名前を変更" }));
    await user.click(within(entertainment).getByRole("button", { name: "保存" }));
    const row = await rowOf("娯楽");
    expect(
      await within(row).findByText("選んだカテゴリが見つかりません。画面を更新してください"),
    ).toBeInTheDocument();
  });
});

describe("カテゴリの削除", () => {
  it("使われているカテゴリは削除せず、理由を行の下に出す（BR3.4）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    const categories = await loadCategories(book);
    const food = categoryIdNamed(categories, "食費");
    await book.addTransaction({
      date: "2026-10-01",
      type: "expense",
      categoryId: food,
      amount: "1200",
      memo: "架空のランチ",
    });
    await book.addTransaction({
      date: "2026-10-02",
      type: "expense",
      categoryId: food,
      amount: "800",
      memo: "",
    });
    renderCategories(book);
    const row = await rowOf("食費");
    await user.click(within(row).getByRole("button", { name: "食費を削除" }));
    expect(rowMessage(row, "2件の収支で使われているため削除できません")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("種別の最後の1件は削除せず、理由を行の下に出す（BR3.4）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    renderCategories(book);
    for (const name of ["給与", "副収入"]) {
      await user.click(within(await rowOf(name)).getByRole("button", { name: `${name}を削除` }));
      await user.click(await screen.findByRole("button", { name: "削除する" }));
      await screen.findByText(`✓ ${name}を削除しました`);
    }
    const last = await rowOf("その他収入");
    await user.click(within(last).getByRole("button", { name: "その他収入を削除" }));
    expect(rowMessage(last, "各種別に1件は必要です")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("予算がないカテゴリは D2 で確認し、予算の注意を足さない（BR3.4、Q1 = A）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    renderCategories(book);
    await user.click(within(await rowOf("娯楽")).getByRole("button", { name: "娯楽を削除" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "カテゴリ「娯楽」を削除しますか？",
    });
    expect(within(dialog).queryByText(/予算/)).toBeNull();
    expect(within(dialog).getByRole("button", { name: "キャンセル" })).toHaveFocus();
  });

  it("予算がある場合は D2 に予算の件数を出し、確定すると消した予算の件数を知らせる（Q1 = A）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    const categories = await loadCategories(book);
    await book.setBudget(categoryIdNamed(categories, "娯楽"), "2026-10", "3000");
    renderCategories(book);
    await user.click(within(await rowOf("娯楽")).getByRole("button", { name: "娯楽を削除" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "カテゴリ「娯楽」を削除しますか？",
    });
    expect(within(dialog).getByText("このカテゴリの予算（1件）も削除されます")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "削除する" }));
    expect(
      await screen.findByText("✓ 娯楽を削除しました（予算1件も削除しました）"),
    ).toBeInTheDocument();
    expect(await screen.findByRole("table", { name: "支出カテゴリ（6件）" })).toBeInTheDocument();
  });

  it("D2 を Esc で閉じると何も変えず、押した「削除」へフォーカスを戻す（BR9.2）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    renderCategories(book);
    const deleteButton = within(await rowOf("娯楽")).getByRole("button", { name: "娯楽を削除" });
    await user.click(deleteButton);
    await screen.findByRole("alertdialog", { name: "カテゴリ「娯楽」を削除しますか？" });
    const nativeDialog = document.querySelector("dialog");
    if (nativeDialog === null) throw new Error("テストの前提のダイアログがありません");
    fireEvent(nativeDialog, new Event("cancel", { cancelable: true }));
    await waitFor(() => expect(nativeDialog).not.toHaveAttribute("open"));
    expect(deleteButton).toHaveFocus();
    expect(await rowOf("娯楽")).toBeInTheDocument();
  });

  it("D2 の確定が失敗したら D2 を閉じ、その行の下に理由を出す（BR3.4）", async () => {
    const user = userEvent.setup();
    const book = await readyBook();
    renderCategories(book);
    await user.click(within(await rowOf("娯楽")).getByRole("button", { name: "娯楽を削除" }));
    vi.spyOn(book, "deleteCategory").mockResolvedValue({
      ok: false,
      error: { kind: "rule", violation: { code: "category-in-use", count: 2 } },
    });
    const dialog = await screen.findByRole("alertdialog", {
      name: "カテゴリ「娯楽」を削除しますか？",
    });
    await user.click(within(dialog).getByRole("button", { name: "削除する" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("alertdialog", { name: "カテゴリ「娯楽」を削除しますか？" }),
      ).toBeNull(),
    );
    expect(
      rowMessage(await rowOf("娯楽"), "2件の収支で使われているため削除できません"),
    ).toBeInTheDocument();
  });

  it("自動のアクセシビリティ検査で違反がない（NFR2.2）", async () => {
    const book = await readyBook();
    const { container } = renderCategories(book);
    await screen.findByRole("table", { name: "支出カテゴリ（7件）" });
    await expectNoAxeViolations(container);
  });
});
