// CSV タブ（S5、US6.1〜US6.3、US7.1〜US7.4、US9.2）。書き出し・ファイルの読み込み・取り込みプレビュー（D3）を組み合わせる。
// 解析（parseImportFile）と確定（commitImport）は U6。保存は変えずに確認し、確定したときだけ U6 が U4 の取り込みを1回で行う。
import { useRef, useState } from "react";
import { commitImport, parseImportFile } from "../../csv-exchange";
import { useShell } from "../appState";
import { APP_MESSAGES } from "../messages";
import { CsvExportPanel } from "./CsvExportPanel";
import { CsvImportPanel } from "./CsvImportPanel";
import { ImportPreviewDialog } from "./ImportPreviewDialog";
import { createNotice } from "../status";
import type { ImportView } from "../types";

const IDLE_IMPORT: ImportView = { phase: "idle", preview: null, fileError: null, notice: null };

export function CsvScreen() {
  const { book, onNewerVersion } = useShell();
  const [importView, setImportView] = useState<ImportView>(IDLE_IMPORT);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importBusyRef = useRef(false);

  /** ファイルを選んだ後の解析（BR7.1）。理由が出たら D3 は開かない。 */
  async function handleFile(file: File): Promise<void> {
    if (importBusyRef.current) return;
    importBusyRef.current = true;
    setImportView({ ...IDLE_IMPORT, phase: "analyzing" });
    try {
      const result = await parseImportFile(book, file);
      if (result.ok) {
        setDialogError(null);
        setImportView({
          phase: "previewing",
          preview: result.value,
          fileError: null,
          notice: null,
        });
        return;
      }
      const error = result.error;
      if (error.kind === "newer-version") {
        setImportView(IDLE_IMPORT);
        onNewerVersion();
      } else if (error.kind === "storage" || error.kind === "validation" || error.kind === "rule") {
        // 保存の読み込みの失敗は BR8.2 と同じ表示（「まだありません」は出さない）。
        setImportView({ ...IDLE_IMPORT, notice: createNotice("error", APP_MESSAGES.readFailed) });
      } else {
        setImportView({ phase: "fileError", preview: null, fileError: error, notice: null });
      }
    } catch {
      // 想定外の例外も読み込みの失敗として表示する（黙って捨てない）。
      setImportView({ ...IDLE_IMPORT, notice: createNotice("error", APP_MESSAGES.readFailed) });
    } finally {
      importBusyRef.current = false;
    }
  }

  /** D3 の確定（U6 が U4 の取り込みを1回で行う。全件追加か0件）。 */
  async function confirmImport(): Promise<void> {
    const preview = importView.preview;
    if (preview === null || importBusyRef.current) return;
    importBusyRef.current = true;
    setDialogError(null);
    setImportView((current) => ({ ...current, phase: "saving" }));
    try {
      const result = await commitImport(book, preview);
      if (result.ok) {
        // 成功は D3 を閉じ、知らせを出す。フォーカスは閉じた後に「ファイルを選ぶ」へ戻る（BR7.4）。
        setImportView({
          ...IDLE_IMPORT,
          notice: createNotice("success", APP_MESSAGES.csv.imported(result.value.added)),
        });
        return;
      }
      const error = result.error;
      if (error.kind === "validation") {
        // 行の内容の誤り。D3 は閉じず、行を示してファイルを選び直せるようにする（BR7.4）。
        setDialogError(
          error.line !== undefined
            ? APP_MESSAGES.importPreview.validationLine(error.line)
            : APP_MESSAGES.importPreview.saveFailed,
        );
        setImportView((current) => ({ ...current, phase: "previewing" }));
      } else if (error.kind === "rule" && error.violation.code === "import-category-missing") {
        // カテゴリが見つからない。D3 を閉じ、ファイルを選び直す案内を出す（BR7.4）。
        setImportView({
          ...IDLE_IMPORT,
          notice: createNotice(
            "error",
            APP_MESSAGES.importPreview.categoryMissing(error.violation.lines),
          ),
        });
      } else if (error.kind === "newer-version") {
        setImportView(IDLE_IMPORT);
        onNewerVersion();
      } else {
        setDialogError(APP_MESSAGES.importPreview.saveFailed);
        setImportView((current) => ({ ...current, phase: "previewing" }));
      }
    } catch {
      // 想定外の例外も失敗として D3 の中に出す（黙って捨てない）。
      setDialogError(APP_MESSAGES.importPreview.saveFailed);
      setImportView((current) => ({ ...current, phase: "previewing" }));
    } finally {
      importBusyRef.current = false;
    }
  }

  /** キャンセルと Esc は何も追加しない（BR7.5）。 */
  function cancelImport(): void {
    setDialogError(null);
    setImportView(IDLE_IMPORT);
  }

  const dialogOpen = importView.phase === "previewing" || importView.phase === "saving";
  return (
    <div className="app-screen">
      <CsvExportPanel />
      <CsvImportPanel
        phase={importView.phase}
        fileError={importView.fileError}
        notice={importView.notice}
        onFileSelected={(file) => void handleFile(file)}
        fileInputRef={fileInputRef}
      />
      <ImportPreviewDialog
        open={dialogOpen}
        preview={importView.preview}
        busy={importView.phase === "saving"}
        error={dialogError}
        returnFocusRef={fileInputRef}
        onConfirm={() => void confirmImport()}
        onCancel={cancelImport}
      />
    </div>
  );
}
