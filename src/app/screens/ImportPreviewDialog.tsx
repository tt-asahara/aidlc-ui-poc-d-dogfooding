// 取り込みプレビュー（D3、US7.1、US7.2、US7.4、US9.2、BR7.2〜BR7.5）。取り込める行と取り込めない行を全件表示する。
// 既存と同じ内容の行は注記だけで、取り込み対象から外さない（BR7.3）。キャンセルと Esc は保存に触れない（BR7.5）。
import { useId, useRef, type RefObject } from "react";
import type { ImportPreview } from "../../csv-exchange";
import { Button, Dialog, InlineMessage } from "../../ui-kit";
import { formatEntryType, formatThousands } from "../format";
import { APP_MESSAGES } from "../messages";

export interface ImportPreviewDialogProps {
  open: boolean;
  preview: ImportPreview | null;
  /** 確定の処理中（取り込み中。キャンセルも無効。BR7.4）。 */
  busy: boolean;
  /** 確定の失敗の文言（D3 の中に出し、再試行できる）。 */
  error: string | null;
  /** 閉じたときのフォーカスの戻し先（「ファイルを選ぶ」。BR7.5）。 */
  returnFocusRef: RefObject<HTMLElement | null>;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ImportPreviewDialog({
  open,
  preview,
  busy,
  error,
  returnFocusRef,
  onConfirm,
  onCancel,
}: ImportPreviewDialogProps) {
  const summaryId = useId();
  const summaryRef = useRef<HTMLParagraphElement>(null);
  const validRows = preview?.validRows ?? [];
  const invalidRows = preview?.invalidRows ?? [];
  // 処理中は閉じない（キャンセルも無効）。それ以外の Esc やキャンセルは呼び出し側に任せる。
  const handleClose = () => {
    if (!busy) onCancel();
  };
  return (
    <Dialog
      open={open && preview !== null}
      title={preview === null ? "" : APP_MESSAGES.importPreview.title(preview.fileName)}
      describedBy={summaryId}
      initialFocusRef={summaryRef}
      returnFocusRef={returnFocusRef}
      onClose={handleClose}
    >
      <div className="app-dialog-body app-dialog-scroll">
        <p id={summaryId} ref={summaryRef} tabIndex={-1}>
          {APP_MESSAGES.importPreview.summary(validRows.length, invalidRows.length)}
        </p>
        {invalidRows.length > 0 && (
          <section aria-label={APP_MESSAGES.importPreview.invalidHeading}>
            <h3 className="app-section__title">{APP_MESSAGES.importPreview.invalidHeading}</h3>
            <ul>
              {invalidRows.map((row) => (
                <li key={row.line}>{`${row.line}行目：${row.reasons.join("、")}`}</li>
              ))}
            </ul>
          </section>
        )}
        <section aria-label={APP_MESSAGES.importPreview.validHeading}>
          <h3 className="app-section__title">{APP_MESSAGES.importPreview.validHeading}</h3>
          {validRows.length === 0 ? (
            <p>{APP_MESSAGES.importPreview.noValidRows}</p>
          ) : (
            <table className="uk-table">
              <caption className="uk-table__caption">
                {APP_MESSAGES.importPreview.validHeading}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{APP_MESSAGES.importPreview.columns.line}</th>
                  <th scope="col">{APP_MESSAGES.importPreview.columns.date}</th>
                  <th scope="col">{APP_MESSAGES.importPreview.columns.type}</th>
                  <th scope="col">{APP_MESSAGES.importPreview.columns.category}</th>
                  <th scope="col">{APP_MESSAGES.importPreview.columns.amount}</th>
                  <th scope="col">{APP_MESSAGES.importPreview.columns.memo}</th>
                </tr>
              </thead>
              <tbody>
                {validRows.map((row) => (
                  <tr key={row.line}>
                    <td>{row.line}</td>
                    <td>{row.date}</td>
                    <td>{formatEntryType(row.type)}</td>
                    <td>{row.categoryName}</td>
                    <td className="app-amount">{formatThousands(row.amount)}</td>
                    <td>
                      {row.memo}
                      {row.sameAsExisting && (
                        <span className="app-muted">
                          {" "}
                          {APP_MESSAGES.importPreview.sameAsExisting}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        {error !== null && <InlineMessage tone="error">{error}</InlineMessage>}
      </div>
      <div className="app-dialog-actions">
        <Button disabled={busy} onClick={handleClose}>
          {APP_MESSAGES.importPreview.cancel}
        </Button>
        <Button
          variant="primary"
          busy={busy}
          busyLabel={APP_MESSAGES.importPreview.confirming}
          disabled={validRows.length === 0}
          onClick={onConfirm}
        >
          {APP_MESSAGES.importPreview.confirm(validRows.length)}
        </Button>
      </div>
    </Dialog>
  );
}
