// 確認ダイアログ（D1 収支の削除、D2 カテゴリの削除）。U2 の Dialog を使う（BR9.2、BR2.5、BR3.4）。
// 開いたときのフォーカスは「キャンセル」（誤操作の防止）。Esc で取り消し、背景のクリックでは閉じない。
// 処理中は両方のボタンを押せず、キャンセルも無効（BR9.2）。
import { useId, type ReactNode, type RefObject } from "react";
import { Button, Dialog, InlineMessage } from "../../ui-kit";
import { APP_MESSAGES } from "../messages";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** 対象の内容（日付・カテゴリ・金額など）。 */
  body: ReactNode;
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
  /** 失敗の文言。ダイアログは開いたままで、ボタンを押せる状態に戻す。 */
  error: string | null;
  /** 開いたときにフォーカスを置く「キャンセル」。 */
  cancelRef: RefObject<HTMLButtonElement | null>;
  /** 閉じたときにフォーカスを戻す要素（BR9.2）。 */
  returnFocusRef: RefObject<HTMLElement | null>;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  busyLabel,
  busy,
  error,
  cancelRef,
  returnFocusRef,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const bodyId = useId();
  // 処理中は閉じない（取り消しも無効）。それ以外の Esc やキャンセルは呼び出し側に任せる。
  const handleCancel = () => {
    if (!busy) onCancel();
  };
  return (
    <Dialog
      open={open}
      title={title}
      role="alertdialog"
      describedBy={bodyId}
      initialFocusRef={cancelRef}
      returnFocusRef={returnFocusRef}
      onClose={handleCancel}
    >
      <div id={bodyId} className="app-dialog-body">
        {body}
        {error !== null && <InlineMessage tone="error">{error}</InlineMessage>}
      </div>
      <div className="app-dialog-actions">
        <Button ref={cancelRef} disabled={busy} onClick={handleCancel}>
          {APP_MESSAGES.cancel}
        </Button>
        <Button variant="danger" busy={busy} busyLabel={busyLabel} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
