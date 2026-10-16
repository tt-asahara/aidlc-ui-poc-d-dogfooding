// 月次集計タブ（S2、US5.1〜US5.4、BR5.1〜BR5.4）。U5 の getMonthlySummary の結果を表示する。計算はしない（金額の表示の整えだけ）。
// 読み込み中と失敗では合計欄を「—」にし、0円とは表示しない（BR5.1）。収支がない月は 0 円と案内を出す（BR5.4）。
import {
  getMonthlySummary,
  type ExpenseRow,
  type IncomeRow,
  type MonthlySummary,
} from "../../monthly-summary";
import { Button, DataTable, StatusPanel, type DataTableColumn } from "../../ui-kit";
import { useShell } from "../appState";
import { MonthNavigator } from "../MonthNavigator";
import { formatMonthLabel, formatSignedNumber, formatThousands, formatYen } from "../format";
import { APP_MESSAGES, STALE_SELECTION_TEXT } from "../messages";
import { useLatestRead } from "../reads";
import type { AsyncView } from "../types";

/** 支出の表の行。合計の行を同じ表に含める（AC5.2.3）。 */
type ExpenseTableRow = { kind: "category"; row: ExpenseRow } | { kind: "total"; actual: number };

/** 金額の欄。読み込み中・失敗のときは「—」（BR5.1）。 */
function totalText(amount: number | null): string {
  return amount === null ? APP_MESSAGES.summary.noValue : formatYen(amount);
}

/** 差額（負は「−」と「（赤字）」、正は「（黒字）」。BR5.1）。 */
function balanceText(summary: MonthlySummary | null): string {
  if (summary === null) return APP_MESSAGES.summary.noValue;
  if (summary.balance < 0) return `${formatYen(summary.balance)}${APP_MESSAGES.summary.redBalance}`;
  if (summary.balance > 0)
    return `${formatYen(summary.balance)}${APP_MESSAGES.summary.blackBalance}`;
  return formatYen(summary.balance);
}

/** 予算の欄（BR5.2）。予算なしは「—（予算なし）」、引き継ぎは「(引き継ぎ)」を添える。 */
function budgetText(row: ExpenseRow): string {
  if (row.budget === null) return APP_MESSAGES.summary.noBudget;
  const carried = row.budgetSource.kind === "carried" ? ` ${APP_MESSAGES.summary.carriedNote}` : "";
  return `${formatThousands(row.budget)}${carried}`;
}

function statusText(row: ExpenseRow): string {
  if (row.over) return APP_MESSAGES.summary.overBudget;
  return row.budget === null ? APP_MESSAGES.summary.noValue : APP_MESSAGES.summary.inBudget;
}

function expenseColumns(): DataTableColumn<ExpenseTableRow>[] {
  const columns = APP_MESSAGES.summary.columns;
  return [
    {
      key: "category",
      header: columns.category,
      render: (item) =>
        item.kind === "total" ? APP_MESSAGES.summary.totalRow : item.row.categoryName,
    },
    {
      key: "budget",
      header: columns.budget,
      align: "end",
      render: (item) => (item.kind === "total" ? "" : budgetText(item.row)),
    },
    {
      key: "actual",
      header: columns.actual,
      align: "end",
      render: (item) =>
        item.kind === "total" ? formatThousands(item.actual) : formatThousands(item.row.actual),
    },
    {
      key: "remaining",
      header: columns.remaining,
      align: "end",
      render: (item) => {
        if (item.kind === "total") return "";
        return item.row.remaining === null
          ? APP_MESSAGES.summary.noValue
          : formatSignedNumber(item.row.remaining);
      },
    },
    {
      key: "status",
      header: columns.status,
      render: (item) => (item.kind === "total" ? "" : statusText(item.row)),
    },
  ];
}

function incomeColumns(): DataTableColumn<IncomeRow>[] {
  const columns = APP_MESSAGES.summary.incomeColumns;
  return [
    { key: "category", header: columns.category, render: (row) => row.categoryName },
    {
      key: "actual",
      header: columns.actual,
      align: "end",
      render: (row) => formatThousands(row.actual),
    },
  ];
}

interface SummaryViewProps {
  month: string;
  /** 表に出す集計（読み直しの間は前の値を残す）。 */
  summary: MonthlySummary | null;
  /** 合計を出してよいか。読み込み中と失敗では false（合計は「—」。BR5.1）。 */
  showTotals: boolean;
  busy: boolean;
}

/** 合計の3つと、支出・収入の表。合計は showTotals が真のときだけ数を出す。 */
function SummaryView({ month, summary, showTotals, busy }: SummaryViewProps) {
  const { navigate } = useShell();
  const monthLabel = formatMonthLabel(month);
  const totals = showTotals && summary !== null ? summary : null;
  const expenseRows: ExpenseTableRow[] =
    summary === null
      ? []
      : [
          ...summary.expenseRows.map((row): ExpenseTableRow => ({ kind: "category", row })),
          { kind: "total", actual: summary.expenseTotal },
        ];
  return (
    <div className="app-screen">
      <dl className="app-section">
        <div>
          <dt>{APP_MESSAGES.summary.incomeTotal}</dt>
          <dd>{totalText(totals === null ? null : totals.incomeTotal)}</dd>
        </div>
        <div>
          <dt>{APP_MESSAGES.summary.expenseTotal}</dt>
          <dd>{totalText(totals === null ? null : totals.expenseTotal)}</dd>
        </div>
        <div>
          <dt>{APP_MESSAGES.summary.balance}</dt>
          <dd>{balanceText(totals)}</dd>
        </div>
      </dl>
      {totals !== null && !totals.hasTransactions && (
        <div className="app-section">
          <p>{APP_MESSAGES.summary.emptyTitle}</p>
          <div>
            <Button onClick={() => navigate("transactions")}>
              {APP_MESSAGES.summary.emptyAction}
            </Button>
          </div>
        </div>
      )}
      {summary !== null && (
        <>
          <DataTable
            caption={APP_MESSAGES.summary.expenseCaption(monthLabel)}
            columns={expenseColumns()}
            rows={expenseRows}
            rowKey={(item) => (item.kind === "total" ? "total" : item.row.categoryId)}
            busy={busy}
          />
          <DataTable
            caption={APP_MESSAGES.summary.incomeCaption(monthLabel)}
            columns={incomeColumns()}
            rows={summary.incomeRows}
            rowKey={(row) => row.categoryId}
            busy={busy}
          />
        </>
      )}
    </div>
  );
}

/** 読み取りの失敗の表示。食い違い（category-missing）は画面の更新を促す（BR3.5、BR4.2）。 */
function FailureView({
  view,
  onRetry,
}: {
  view: Extract<AsyncView<MonthlySummary>, { state: "failed" }>;
  onRetry: () => void;
}) {
  if (view.error.kind === "rule" && view.error.violation.code === "category-missing") {
    return (
      <div role="alert" className="app-section">
        <p>{`⚠ ${STALE_SELECTION_TEXT}`}</p>
        <div>
          <Button onClick={onRetry}>{APP_MESSAGES.refreshScreen}</Button>
        </div>
      </div>
    );
  }
  return (
    <StatusPanel
      kind="error"
      subject={APP_MESSAGES.summary.subject}
      action={{ label: APP_MESSAGES.retry, onClick: onRetry }}
    />
  );
}

export function SummaryScreen() {
  const { book, month, setMonth, onNewerVersion } = useShell();
  const read = useLatestRead(() => getMonthlySummary(book, month), month, onNewerVersion);
  const { view } = read;

  return (
    <div className="app-screen">
      <div className="app-actions">
        <h2 className="app-section__title">{APP_MESSAGES.summary.title}</h2>
        <MonthNavigator month={month} onChange={setMonth} />
      </div>
      {view.state === "failed" ? (
        <>
          <SummaryView month={month} summary={null} showTotals={false} busy={false} />
          <FailureView view={view} onRetry={read.reload} />
        </>
      ) : view.data === null ? (
        <>
          <SummaryView month={month} summary={null} showTotals={false} busy={false} />
          <StatusPanel kind="loading" subject={APP_MESSAGES.summary.subject} />
        </>
      ) : (
        <SummaryView
          month={month}
          summary={view.data}
          showTotals={view.state === "loaded"}
          busy={view.state === "loading"}
        />
      )}
    </div>
  );
}
