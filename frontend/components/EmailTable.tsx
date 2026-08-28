import { LoadingSkeleton } from './LoadingSkeleton';
import { EmptyState } from './EmptyState';

interface Column {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
  width?: string;
}

interface EmailTableProps {
  columns: Column[];
  data: any[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

export function EmailTable({
  columns,
  data,
  loading = false,
  emptyTitle = 'No emails yet',
  emptyDescription,
  page = 1,
  totalPages = 1,
  onPageChange,
}: EmailTableProps) {
  if (loading) {
    return (
      <div className="bg-white border border-surface-border rounded-lg overflow-hidden">
        <LoadingSkeleton rows={5} />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white border border-surface-border rounded-lg">
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  return (
    <div className="bg-white border border-surface-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-border bg-primary-50/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="text-left text-xs font-medium text-primary-600 uppercase tracking-wider px-4 py-3"
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr
                key={row.id || i}
                className="table-row-hover border-b border-surface-border last:border-b-0 transition-colors duration-100"
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-sm text-primary-800">
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-surface-border bg-primary-50/30">
          <p className="text-xs text-primary-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1 text-xs font-medium text-primary-700 bg-white border border-primary-300 rounded hover:bg-primary-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1 text-xs font-medium text-primary-700 bg-white border border-primary-300 rounded hover:bg-primary-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
