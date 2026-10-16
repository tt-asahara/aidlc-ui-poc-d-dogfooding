// 表（C6 DataTableProps、BR4.1・BR4.2）。caption と列見出し（scope=col）を持ち、金額の列は右寄せで桁をそろえる。
// 幅 768px 未満では ui-kit.css が各行を見出し付きのカードとして縦に積む（各セルの data-label に列見出しを持たせる）。
// 文字は React の通常の描画で表示し、HTML として挿入しない（NFR8.1）。
import type { ReactNode } from "react";

export interface DataTableColumn<R> {
  key: string;
  header: string;
  /** end は右寄せ・tabular-nums（金額の列）。既定は start。 */
  align?: "start" | "end";
  render: (row: R) => ReactNode;
}

export interface DataTableProps<R> {
  caption: string;
  columns: DataTableColumn<R>[];
  rows: R[];
  rowKey: (row: R) => string;
  /** 読み込み中・更新中。aria-busy を真にする。 */
  busy?: boolean;
}

function cellClassName(align: "start" | "end" | undefined): string | undefined {
  return align === "end" ? "uk-table__cell--end" : undefined;
}

export function DataTable<R>({ caption, columns, rows, rowKey, busy = false }: DataTableProps<R>) {
  return (
    <table className="uk-table" aria-busy={busy || undefined}>
      <caption className="uk-table__caption">{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key} scope="col" className={cellClassName(column.align)}>
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)}>
            {columns.map((column) => (
              <td
                key={column.key}
                className={cellClassName(column.align)}
                data-label={column.header}
              >
                {column.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
