// ダイアログ（C6 DialogProps、BR5.1〜BR5.6、US9.2）。標準の dialog 要素のモーダル表示（showModal）を使う。
// 表示の開閉は open の値だけで決める。Esc では閉じる理由を呼び出し側に伝えるだけで、閉じるのは呼び出し側が
// open を偽にしたとき（security-design.md 3.1）。
import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";

/** 閉じる理由。escape は Esc（Dialog が伝える）、cancel は呼び出し側のボタンでの取り消し。 */
export type DialogCloseReason = "escape" | "cancel";

export interface DialogProps {
  open: boolean;
  title: string;
  role?: "dialog" | "alertdialog";
  /** 本文の要素の id（aria-describedby）。 */
  describedBy?: string;
  /** 開いたときにフォーカスを置く要素。省略時はダイアログ内の最初の操作要素（BR5.2）。 */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** 閉じたときにフォーカスを戻す要素。省略時は開いた時点でフォーカスがあった要素（BR5.5）。 */
  returnFocusRef?: RefObject<HTMLElement | null>;
  /** 閉じてほしいときに呼ぶ。閉じるかどうかは呼び出し側が open で決める（BR5.4）。 */
  onClose: (reason: DialogCloseReason) => void;
  children: ReactNode;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/** ダイアログ内の Tab で到達できる要素を、文書の順に返す。 */
function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.closest("[inert]"),
  );
}

/** 要素がまだ画面（文書）にあればフォーカスを移す。なくなっていれば何もしない（BR5.5）。 */
function focusIfConnected(target: Element | null | undefined): void {
  if (target instanceof HTMLElement && target.isConnected) target.focus();
}

/**
 * 閉じたときのフォーカスの戻し（BR5.5）。returnFocusRef は「閉じた時点」の値を読む
 * （開いている間に呼び出し側が戻し先を差し替えてもよいように）。省略時は開く前の要素へ戻す。
 */
function restoreFocus(
  returnFocusRef: RefObject<HTMLElement | null> | undefined,
  opener: Element | null,
): void {
  focusIfConnected(returnFocusRef ? returnFocusRef.current : opener);
}

export function Dialog({
  open,
  title,
  role = "dialog",
  describedBy,
  initialFocusRef,
  returnFocusRef,
  onClose,
  children,
}: DialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  /** 部品として「開いている」と扱っているか（open の値に合わせる。close イベントの判定に使う）。 */
  const isOpenRef = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || dialog === null) return;

    // 開く前にフォーカスがあった要素を記憶する（BR5.1）。
    const opener = document.activeElement;
    isOpenRef.current = true;
    if (!dialog.open) dialog.showModal();
    const initial = initialFocusRef?.current ?? focusableElements(dialog)[0] ?? dialog;
    initial.focus();

    return () => {
      // 先に「閉じた」と記録してから閉じる。自分で閉じたときの close イベントを Esc と取り違えないため。
      isOpenRef.current = false;
      if (dialog.open) dialog.close();
      restoreFocus(returnFocusRef, opener);
    };
  }, [open, initialFocusRef, returnFocusRef]);

  const handleCancel = (event: { preventDefault: () => void }) => {
    // ブラウザに勝手に閉じさせない。閉じるかは呼び出し側の open で決める（BR5.4）。
    event.preventDefault();
    onCloseRef.current("escape");
  };

  const handleClose = () => {
    // open が真のまま閉じられた（ブラウザが cancel を経ずに閉じた等）。表示を open に合わせて
    // モーダルに戻し、Esc と同じく呼び出し側に閉じてほしいことを伝える。
    const dialog = dialogRef.current;
    if (!isOpenRef.current || dialog === null) return;
    if (dialog.isConnected && !dialog.open) dialog.showModal();
    onCloseRef.current("escape");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== "Tab") return;
    const dialog = event.currentTarget;
    const focusables = focusableElements(dialog);
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (first === undefined || last === undefined) {
      // 操作要素がないときは、フォーカスをダイアログから出さない。
      event.preventDefault();
      return;
    }
    const active = document.activeElement;
    // Tab・Shift+Tab はダイアログの中で循環させる（BR5.3）。
    if (event.shiftKey && (active === first || active === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || active === dialog)) {
      event.preventDefault();
      first.focus();
    }
  };

  // 背景（::backdrop）のクリックでは閉じない。dialog へのクリックを閉じる処理につなげない（BR5.6）。
  return (
    <dialog
      ref={dialogRef}
      className="uk-dialog"
      role={role}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      tabIndex={-1}
      onCancel={handleCancel}
      onClose={handleClose}
      onKeyDown={handleKeyDown}
    >
      {open && (
        <>
          <h2 id={titleId} className="uk-dialog__title">
            {title}
          </h2>
          {children}
        </>
      )}
    </dialog>
  );
}
