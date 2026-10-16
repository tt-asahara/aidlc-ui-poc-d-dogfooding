// CSV の書き出し（US6.1〜US6.3、BR6.1〜BR6.3、NFR9.1）。U6 の Blob を一時的な URL にして保存させ、すぐに解放する（ネットワークは使わない）。
// 書き出した内容は U6 の結果のまま（画面では加工しない。NFR8.2）。
import { useEffect, useRef, useState } from "react";
import { exportTransactions } from "../../csv-exchange";
import type { YearMonth } from "../../data-contract";
import { Button, RadioGroup, Select } from "../../ui-kit";
import { shiftYearMonth, useShell } from "../appState";
import { formatMonthLabel } from "../format";
import { APP_MESSAGES } from "../messages";
import { createNotice, NoticeView } from "../status";
import type { Notice } from "../types";

/** 保存を始めた後、一時的な URL を解放するまでの時間（ms。performance-design・security-design 3章）。 */
export const DOWNLOAD_RELEASE_MS = 1000;

/** 月の候補（対象の月の前後12か月。2000-01〜2099-12 の内。重複は除く）。 */
export function monthChoices(center: YearMonth): YearMonth[] {
  const choices: YearMonth[] = [];
  for (let delta = -12; delta <= 12; delta += 1) {
    // 範囲の端では同じ月に丸められるので、重複を除く。
    const candidate = shiftYearMonth(center, delta);
    if (!choices.includes(candidate)) choices.push(candidate);
  }
  return choices;
}

interface PendingRelease {
  url: string;
  timer: ReturnType<typeof setTimeout>;
}

export function CsvExportPanel() {
  const { book, month, onNewerVersion } = useShell();
  const [rangeKind, setRangeKind] = useState<"all" | "month">("all");
  const [selectedMonth, setSelectedMonth] = useState<YearMonth>(month);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [headerOnly, setHeaderOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const pendingRef = useRef<PendingRelease | null>(null);

  // 画面を離れたら、残っている一時的な URL を解放する（BR6.1）。
  useEffect(() => {
    return () => {
      const pending = pendingRef.current;
      if (pending === null) return;
      clearTimeout(pending.timer);
      URL.revokeObjectURL(pending.url);
      pendingRef.current = null;
    };
  }, []);

  function releasePending(): void {
    const pending = pendingRef.current;
    if (pending === null) return;
    clearTimeout(pending.timer);
    URL.revokeObjectURL(pending.url);
    pendingRef.current = null;
  }

  /** Blob を一時的な URL にして保存させ、少し後に解放する。 */
  function saveBlob(blob: Blob, fileName: string): void {
    releasePending();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    const timer = setTimeout(() => {
      URL.revokeObjectURL(url);
      pendingRef.current = null;
    }, DOWNLOAD_RELEASE_MS);
    pendingRef.current = { url, timer };
  }

  async function runExport(): Promise<void> {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    setHeaderOnly(false);
    try {
      const range = rangeKind === "all" ? "all" : { month: selectedMonth };
      const result = await exportTransactions(book, range);
      if (!result.ok) {
        if (result.error.kind === "newer-version") {
          onNewerVersion();
        } else {
          setNotice(
            createNotice(
              "error",
              result.error.kind === "storage" ? result.error.message : APP_MESSAGES.readFailed,
            ),
          );
        }
        return;
      }
      saveBlob(result.value.blob, result.value.fileName);
      setNotice(
        createNotice(
          "success",
          APP_MESSAGES.csv.exported(result.value.fileName, result.value.count),
        ),
      );
      setHeaderOnly(result.value.headerOnly);
    } catch {
      // 想定外の例外も書き出しの失敗として表示する（黙って捨てない）。
      setNotice(createNotice("error", APP_MESSAGES.csv.exportFailed));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="app-section" aria-labelledby="csv-export-title">
      <h2 id="csv-export-title" className="app-section__title">
        {APP_MESSAGES.csv.exportTitle}
      </h2>
      <div className="app-form-row">
        <RadioGroup<"all" | "month">
          legend={APP_MESSAGES.csv.rangeLegend}
          name="csv-export-range"
          value={rangeKind}
          options={[
            { value: "all", label: APP_MESSAGES.csv.rangeAll },
            { value: "month", label: APP_MESSAGES.csv.rangeMonth },
          ]}
          onChange={setRangeKind}
        />
        {rangeKind === "month" && (
          <Select
            id="csv-export-month"
            label={APP_MESSAGES.csv.monthSelectLabel}
            value={selectedMonth}
            options={monthChoices(month).map((value) => ({
              value,
              label: formatMonthLabel(value),
            }))}
            onChange={setSelectedMonth}
          />
        )}
      </div>
      <div className="app-actions">
        <Button
          variant="primary"
          busy={busy}
          busyLabel={APP_MESSAGES.csv.exporting}
          onClick={() => void runExport()}
        >
          {APP_MESSAGES.csv.exportButton}
        </Button>
      </div>
      <NoticeView notice={notice} onHidden={() => setNotice(null)} />
      {headerOnly && <p className="app-hint">{APP_MESSAGES.csv.headerOnly}</p>}
    </section>
  );
}
