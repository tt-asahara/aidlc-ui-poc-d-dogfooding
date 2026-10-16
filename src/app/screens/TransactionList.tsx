// 対象月の収支一覧の本体（BR2.3、BR2.4、BR2.5、BR8.1、BR8.2）。並びは U4 の結果のまま（日付の新しい順など）。
// 0件は案内と登録欄への導線。読み直しの間（busy）は「まだありません」を出さず読み込み中を示す（BR8.1）。
import type { Category, Transaction, YearMonth } from "../../data-contract";
import { Button, DataTable, StatusPanel, type DataTableColumn } from "../../ui-kit";
import { formatEntryType, formatMonthLabel, formatThousands, formatYen } from "../format";
import { APP_MESSAGES } from "../messages";

export interface TransactionListProps {
  month: YearMonth;
  transactions: readonly Transaction[];
  categories: readonly Category[];
  /** 編集中の収支（行に「編集中」と示す）。 */
  editingId: string | null;
  /** 読み直しの間は true（前の行を残して aria-busy で示す）。 */
  busy: boolean;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onGoToForm: () => void;
  /** 操作ボタンの参照を親に渡す（削除の後・編集の後のフォーカスの戻し先に使う）。 */
  registerButton: (key: string, element: HTMLButtonElement | null) => void;
}

/** 操作ボタンの参照の鍵。 */
export function editButtonKey(id: string): string {
  return `edit:${id}`;
}

export function deleteButtonKey(id: string): string {
  return `delete:${id}`;
}

export function TransactionList({
  month,
  transactions,
  categories,
  editingId,
  busy,
  onEdit,
  onDelete,
  onGoToForm,
  registerButton,
}: TransactionListProps) {
  const categoryNameOf = (categoryId: string): string =>
    categories.find((category) => category.id === categoryId)?.name ??
    APP_MESSAGES.transactions.fallbackCategoryName;
  const summaryOf = (transaction: Transaction): string =>
    `${transaction.date} ${categoryNameOf(transaction.categoryId)} ${formatYen(transaction.amount)}`;

  if (transactions.length === 0) {
    if (busy)
      return <StatusPanel kind="loading" subject={APP_MESSAGES.transactions.loadingSubject} />;
    return (
      <div className="app-section">
        <p>{APP_MESSAGES.transactions.emptyTitle}</p>
        <p className="app-muted">{APP_MESSAGES.transactions.emptyHint}</p>
        <div>
          <Button onClick={onGoToForm}>{APP_MESSAGES.transactions.emptyAction}</Button>
        </div>
      </div>
    );
  }

  const columns: DataTableColumn<Transaction>[] = [
    { key: "date", header: APP_MESSAGES.transactions.columns.date, render: (row) => row.date },
    {
      key: "type",
      header: APP_MESSAGES.transactions.columns.type,
      render: (row) => formatEntryType(row.type),
    },
    {
      key: "category",
      header: APP_MESSAGES.transactions.columns.category,
      render: (row) => categoryNameOf(row.categoryId),
    },
    {
      key: "amount",
      header: APP_MESSAGES.transactions.columns.amount,
      align: "end",
      render: (row) => <span className="app-amount">{formatThousands(row.amount)}</span>,
    },
    { key: "memo", header: APP_MESSAGES.transactions.columns.memo, render: (row) => row.memo },
    {
      key: "actions",
      header: APP_MESSAGES.transactions.columns.actions,
      render: (row) => (
        <div className="app-actions">
          {editingId === row.id && (
            <span className="app-muted">{APP_MESSAGES.transactions.editing}</span>
          )}
          <Button
            aria-label={APP_MESSAGES.transactions.editAria(summaryOf(row))}
            ref={(element) => registerButton(editButtonKey(row.id), element)}
            onClick={() => onEdit(row)}
          >
            {APP_MESSAGES.transactions.edit}
          </Button>
          <Button
            variant="danger"
            aria-label={APP_MESSAGES.transactions.deleteAria(summaryOf(row))}
            ref={(element) => registerButton(deleteButtonKey(row.id), element)}
            onClick={() => onDelete(row)}
          >
            {APP_MESSAGES.transactions.delete}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      caption={APP_MESSAGES.transactions.listCaption(formatMonthLabel(month), transactions.length)}
      columns={columns}
      rows={[...transactions]}
      rowKey={(row) => row.id}
      busy={busy}
    />
  );
}
