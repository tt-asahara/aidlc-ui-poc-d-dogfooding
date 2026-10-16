// Dialog のテスト（US9.2 AC9.2.1〜AC9.2.3、BR5.1〜BR5.6、NFR2.1、NFR2.2）。実装の後に書くテスト（Testing Contract の ordering）。
// jsdom に無い showModal・close は test-setup.ts で補っている。Esc はブラウザが送る cancel イベントを送って再現する。
// 補いで通ることは実ブラウザでの証明ではない（実ブラウザ確認 B1〜B5 は U7 の Build and Test で行う）。
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "./Button";
import { Dialog, type DialogCloseReason } from "./Dialog";
import { expectNoAxeViolations } from "./test-fixtures";

/** 収支の削除確認（D1）を模した呼び出し側。呼び出し側が open を持ち、onClose で閉じる。 */
function DeleteConfirmHarness(props: {
  onCloseReason?: (reason: DialogCloseReason) => void;
  keepOpenOnEscape?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const close = (reason: DialogCloseReason) => {
    props.onCloseReason?.(reason);
    if (reason === "escape" && props.keepOpenOnEscape) return;
    setOpen(false);
  };
  return (
    <>
      <Button onClick={() => undefined}>月次集計</Button>
      <Button variant="danger" onClick={() => setOpen(true)}>
        削除
      </Button>
      <Dialog
        open={open}
        title="この収支を削除しますか？"
        role="alertdialog"
        describedBy="delete-body"
        initialFocusRef={cancelRef}
        onClose={close}
      >
        <p id="delete-body">2026-10-01 架空の食費 1,200円</p>
        <Button ref={cancelRef} onClick={() => close("cancel")}>
          キャンセル
        </Button>
        <Button variant="danger" onClick={() => setOpen(false)}>
          削除する
        </Button>
      </Dialog>
    </>
  );
}

function dialogElement(): HTMLDialogElement {
  const dialog = screen.getByRole("alertdialog", { name: "この収支を削除しますか？" });
  if (!(dialog instanceof HTMLDialogElement)) throw new Error("dialog 要素ではありません");
  return dialog;
}

function sendCancel(dialog: HTMLDialogElement): Event {
  const event = new Event("cancel", { cancelable: true });
  act(() => {
    dialog.dispatchEvent(event);
  });
  return event;
}

describe("Dialog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("開くとモーダル表示になり、initialFocusRef の要素（キャンセル）にフォーカスが移る（BR5.1・BR5.2）", async () => {
    const user = userEvent.setup();
    const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");
    render(<DeleteConfirmHarness />);

    await user.click(screen.getByRole("button", { name: "削除" }));

    const dialog = dialogElement();
    expect(showModal).toHaveBeenCalledTimes(1);
    expect(dialog.open).toBe(true);
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("2026-10-01 架空の食費 1,200円");
    expect(screen.getByRole("button", { name: "キャンセル" })).toHaveFocus();
  });

  it("最後の要素で Tab を押すと最初へ、最初の要素で Shift+Tab を押すと最後へ移り、外に出ない（AC9.2.1、BR5.3）", async () => {
    const user = userEvent.setup();
    render(<DeleteConfirmHarness />);
    await user.click(screen.getByRole("button", { name: "削除" }));
    const cancel = screen.getByRole("button", { name: "キャンセル" });
    const confirm = screen.getByRole("button", { name: "削除する" });

    await user.tab();
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();
  });

  it('Esc（cancel イベント）では既定動作を止めて onClose("escape") を呼び、閉じると押した「削除」へフォーカスが戻る（AC9.2.2、BR5.4・BR5.5）', async () => {
    const user = userEvent.setup();
    const onCloseReason = vi.fn();
    render(<DeleteConfirmHarness onCloseReason={onCloseReason} />);
    const opener = screen.getByRole("button", { name: "削除" });
    await user.click(opener);
    const dialog = dialogElement();

    const event = sendCancel(dialog);

    expect(event.defaultPrevented).toBe(true);
    expect(onCloseReason).toHaveBeenCalledWith("escape");
    expect(dialog.open).toBe(false);
    expect(opener).toHaveFocus();
  });

  it("呼び出し側が閉じないと決めたとき（処理中など）は Esc でも開いたままになる（BR5.4）", async () => {
    const user = userEvent.setup();
    const onCloseReason = vi.fn();
    render(<DeleteConfirmHarness onCloseReason={onCloseReason} keepOpenOnEscape />);
    await user.click(screen.getByRole("button", { name: "削除" }));
    const dialog = dialogElement();

    sendCancel(dialog);

    expect(onCloseReason).toHaveBeenCalledWith("escape");
    expect(dialog.open).toBe(true);
  });

  it('open が真のまま close イベントで閉じられたら、表示をモーダルに戻して onClose("escape") を呼ぶ', async () => {
    const user = userEvent.setup();
    const onCloseReason = vi.fn();
    render(<DeleteConfirmHarness onCloseReason={onCloseReason} keepOpenOnEscape />);
    await user.click(screen.getByRole("button", { name: "削除" }));
    const dialog = dialogElement();

    act(() => {
      dialog.close();
    });

    expect(onCloseReason).toHaveBeenCalledWith("escape");
    expect(dialog.open).toBe(true);
  });

  it("キャンセルのボタンで閉じても、押した「削除」へフォーカスが戻り、Esc とは区別される", async () => {
    const user = userEvent.setup();
    const onCloseReason = vi.fn();
    render(<DeleteConfirmHarness onCloseReason={onCloseReason} />);
    const opener = screen.getByRole("button", { name: "削除" });
    await user.click(opener);

    await user.keyboard("{Enter}");

    expect(onCloseReason).toHaveBeenCalledExactlyOnceWith("cancel");
    expect(opener).toHaveFocus();
  });

  it("returnFocusRef を渡すと、閉じたときにそこへフォーカスが戻る（AC9.2.3: プレビューを Esc で閉じて「ファイルを選ぶ」へ）", async () => {
    function ImportPreviewHarness() {
      const [open, setOpen] = useState(false);
      const fileRef = useRef<HTMLInputElement>(null);
      return (
        <>
          {/* ファイル選択の欄（FileInput と同じく、見えるラベル付きの標準の file 入力） */}
          <label htmlFor="csv-file">ファイルを選ぶ</label>
          <input ref={fileRef} id="csv-file" type="file" accept=".csv,text/csv" />
          <Button onClick={() => setOpen(true)}>プレビューを開く</Button>
          <Dialog
            open={open}
            title="取り込みの確認"
            returnFocusRef={fileRef}
            onClose={() => setOpen(false)}
          >
            <p>架空の3件を取り込みます。</p>
            <Button onClick={() => setOpen(false)}>キャンセル</Button>
          </Dialog>
        </>
      );
    }
    const user = userEvent.setup();
    render(<ImportPreviewHarness />);
    await user.click(screen.getByRole("button", { name: "プレビューを開く" }));
    const dialog = screen.getByRole("dialog", { name: "取り込みの確認" });
    // initialFocusRef がないときはダイアログ内の最初の操作要素へ。
    expect(screen.getByRole("button", { name: "キャンセル" })).toHaveFocus();

    sendCancel(dialog as HTMLDialogElement);

    expect(screen.getByLabelText("ファイルを選ぶ")).toHaveFocus();
  });

  it("戻し先の要素が画面から消えていても例外にならず、フォーカスは移さない（BR5.5）", async () => {
    function VanishingOpenerHarness() {
      const [open, setOpen] = useState(false);
      const [showOpener, setShowOpener] = useState(true);
      return (
        <>
          {showOpener && <Button onClick={() => setOpen(true)}>削除</Button>}
          <Dialog open={open} title="架空の確認" onClose={() => setOpen(false)}>
            <Button
              onClick={() => {
                setShowOpener(false);
                setOpen(false);
              }}
            >
              削除する
            </Button>
          </Dialog>
        </>
      );
    }
    const user = userEvent.setup();
    render(<VanishingOpenerHarness />);
    await user.click(screen.getByRole("button", { name: "削除" }));

    await user.click(screen.getByRole("button", { name: "削除する" }));

    expect(screen.queryByRole("button", { name: "削除" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body).toHaveFocus();
  });

  it("背景（dialog 自身）をクリックしても閉じない（BR5.6）", async () => {
    const user = userEvent.setup();
    const onCloseReason = vi.fn();
    render(<DeleteConfirmHarness onCloseReason={onCloseReason} />);
    await user.click(screen.getByRole("button", { name: "削除" }));
    const dialog = dialogElement();

    await user.click(dialog);

    expect(onCloseReason).not.toHaveBeenCalled();
    expect(dialog.open).toBe(true);
  });

  it("操作要素がないときはダイアログ自身にフォーカスを置き、Tab でも外に出さない", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Button>背後のボタン</Button>
        <Dialog open title="架空のお知らせ" onClose={vi.fn()}>
          <p>架空の本文です。</p>
        </Dialog>
      </>,
    );
    const dialog = screen.getByRole("dialog", { name: "架空のお知らせ" });
    expect(dialog).toHaveFocus();

    await user.tab();

    expect(dialog).toHaveFocus();
  });

  it("開いたまま画面から外されても例外にならず、背後の操作不可が解かれる", () => {
    const { unmount } = render(
      <>
        <Button>背後のボタン</Button>
        <Dialog open title="架空の確認" onClose={vi.fn()}>
          <Button>閉じる</Button>
        </Dialog>
      </>,
    );
    expect(document.querySelector("[inert]")).not.toBeNull();

    expect(() => unmount()).not.toThrow();
    expect(document.querySelector("[inert]")).toBeNull();
  });

  it("開いたダイアログで axe の違反が0件（NFR2.1）", async () => {
    const user = userEvent.setup();
    const { container } = render(<DeleteConfirmHarness />);
    await user.click(screen.getByRole("button", { name: "削除" }));
    await expectNoAxeViolations(container);
  });
});
