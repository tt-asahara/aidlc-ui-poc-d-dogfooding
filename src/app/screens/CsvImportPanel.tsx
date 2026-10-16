// CSV の読み込み（US7.1、US7.3、BR7.1）。ファイルを選んで U6 で確認する。理由が出たら D3 は開かず、この欄に表示する。
// message を持つ理由（malformed、read-failed）は U6 の文言をそのまま表示し、持たない理由は画面の固定の文言にする（BR7.1）。
import type { RefObject } from "react";
import type { ImportFileError } from "../../csv-exchange";
import { FileInput, InlineMessage } from "../../ui-kit";
import { APP_MESSAGES } from "../messages";
import { NoticeView } from "../status";
import type { ImportView, Notice } from "../types";

export interface CsvImportPanelProps {
  phase: ImportView["phase"];
  fileError: ImportFileError | null;
  notice: Notice | null;
  onFileSelected: (file: File) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
}

/** 読み込みの理由の表示（tone が status のものは失敗ではなく「データがありません」。BR7.1）。 */
export function fileErrorView(error: ImportFileError): { tone: "error" | "status"; text: string } {
  switch (error.kind) {
    case "malformed":
      return {
        tone: "error",
        text: `${APP_MESSAGES.csv.malformedPrefix(error.line)}${error.message}`,
      };
    case "read-failed":
      return { tone: "error", text: error.message };
    case "header-mismatch":
      return { tone: "error", text: APP_MESSAGES.csv.headerMismatch };
    case "empty":
      return { tone: "status", text: APP_MESSAGES.csv.empty };
    case "too-large":
      return { tone: "error", text: APP_MESSAGES.csv.tooLarge };
    case "too-many-rows":
      return { tone: "error", text: APP_MESSAGES.csv.tooManyRows };
  }
}

export function CsvImportPanel({
  phase,
  fileError,
  notice,
  onFileSelected,
  fileInputRef,
}: CsvImportPanelProps) {
  const busy = phase === "analyzing" || phase === "saving";
  const errorView = fileError === null ? null : fileErrorView(fileError);
  return (
    <section className="app-section" aria-labelledby="csv-import-title">
      <h2 id="csv-import-title" className="app-section__title">
        {APP_MESSAGES.csv.importTitle}
      </h2>
      <p className="app-hint">{APP_MESSAGES.csv.importFormat}</p>
      <FileInput
        id="csv-import-file"
        label={APP_MESSAGES.csv.chooseFile}
        accept=".csv,text/csv"
        disabled={busy}
        onSelect={onFileSelected}
        ref={fileInputRef}
      />
      {phase === "analyzing" && <p role="status">{APP_MESSAGES.csv.analyzing}</p>}
      {errorView !== null &&
        (errorView.tone === "status" ? (
          <p role="status">{errorView.text}</p>
        ) : (
          <InlineMessage tone="error">{errorView.text}</InlineMessage>
        ))}
      <NoticeView notice={notice} />
    </section>
  );
}
