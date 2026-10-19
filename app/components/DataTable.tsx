"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "../store/useLanguage";

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyText?: ReactNode;
  header?: ReactNode;
  toolbarLeft?: ReactNode;
  toolbarRight?: ReactNode;
  paginate?: boolean;
  pageSizeOptions?: number[];
  defaultPageSize?: number;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
  footerRow?: ReactNode;
  footer?: ReactNode;
}

const ALIGN = { left: "text-left", center: "text-center", right: "text-right" } as const;

export default function DataTable<T>({
  columns,
  data,
  rowKey,
  loading = false,
  emptyText,
  header,
  toolbarLeft,
  toolbarRight,
  paginate = true,
  pageSizeOptions = [10, 25, 50, 100],
  defaultPageSize = 10,
  onRowClick,
  rowClassName,
  footerRow,
  footer,
}: DataTableProps<T>) {
  const { t } = useLanguage();
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [requestedPage, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const page = Math.min(requestedPage, totalPages);

  const rows = useMemo(
    () => (paginate ? data.slice((page - 1) * pageSize, page * pageSize) : data),
    [data, paginate, page, pageSize]
  );

  const colSpan = columns.length;

  return (
    <div className="card overflow-hidden">
      {header && <div className="border-b border-stone-200">{header}</div>}
      {(toolbarLeft || toolbarRight) && (
        <div className="flex flex-col gap-3 border-b border-stone-100 p-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">{toolbarLeft}</div>
          <div className="flex flex-wrap items-center gap-2">{toolbarRight}</div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-200">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`px-5 py-3.5 ${ALIGN[c.align ?? "left"]} ${c.className ?? ""}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {loading ? (
              <tr>
                <td colSpan={colSpan} className="p-10 text-center text-stone-400">
                  {t("loading")}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="p-10 text-center text-stone-400">
                  {emptyText ?? t("shared_noRecords")}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`hover:bg-stone-50/70 ${onRowClick ? "cursor-pointer" : ""} ${rowClassName?.(row) ?? ""}`}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={`px-5 py-4 text-stone-700 ${ALIGN[c.align ?? "left"]} ${c.className ?? ""}`}>
                      {c.cell(row, (page - 1) * pageSize + i)}
                    </td>
                  ))}
                </tr>
              ))
            )}
            {!loading && footerRow}
          </tbody>
        </table>
      </div>

      {footer}

      {paginate && !loading && data.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-stone-100 px-5 py-3 text-sm text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2">
            {t("shared_rowsPerPage")}
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-lg border border-stone-200 py-1 pl-2.5 text-sm outline-none"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            {t("shared_entries")}
          </label>

          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  const { t } = useLanguage();
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1
  );

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="flex h-8 w-8 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 disabled:opacity-30 disabled:hover:bg-transparent"
        aria-label={t("shared_prevPage")}
      >
        <ChevronLeft size={16} />
      </button>
      {pages.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && p - pages[i - 1] > 1 && <span className="text-stone-400">…</span>}
          <button
            onClick={() => onChange(p)}
            className={`h-8 min-w-8 rounded-full px-2 text-xs font-bold transition ${
              p === page ? "bg-brand-500 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            {p}
          </button>
        </span>
      ))}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="flex h-8 w-8 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 disabled:opacity-30 disabled:hover:bg-transparent"
        aria-label={t("shared_nextPage")}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
