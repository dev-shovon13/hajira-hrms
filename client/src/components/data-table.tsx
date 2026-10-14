'use client';

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { PageMeta } from '@hajira/shared';
import { Button } from '@/components/ui/button';
import { Input, Skeleton } from '@/components/ui/primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/menu';
import { EmptyState, ErrorState } from '@/components/common';
import { useDebounced } from '@/hooks/use-debounced';
import { cn } from '@/lib/utils';

export interface TableQuery {
  page: number;
  limit: number;
  sort?: string;
  order: 'asc' | 'desc';
  search: string;
}

/** Table state for server-side paging, sorting and search. Changing a filter resets to page 1. */
export function useTableQuery(initial: Partial<TableQuery> = {}) {
  const [state, setState] = React.useState<TableQuery>({ page: 1, limit: 20, order: 'desc', search: '', ...initial });
  const search = useDebounced(state.search, 300);
  const params = { page: state.page, limit: state.limit, sort: state.sort, order: state.order, search };
  return {
    state,
    params,
    setPage: (page: number) => setState((s) => ({ ...s, page })),
    setLimit: (limit: number) => setState((s) => ({ ...s, limit, page: 1 })),
    setSearch: (value: string) => setState((s) => ({ ...s, search: value, page: 1 })),
    setSort: (sort: string | undefined, order: 'asc' | 'desc') => setState((s) => ({ ...s, sort, order, page: 1 })),
    reset: () => setState((s) => ({ ...s, page: 1 })),
  };
}

export type TableQueryApi = ReturnType<typeof useTableQuery>;

interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[] | undefined;
  meta?: PageMeta;
  query: TableQueryApi;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  empty?: { title: string; description?: string; action?: React.ReactNode };
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  caption: string;
}

export function DataTable<T>({
  columns,
  data,
  meta,
  query,
  loading,
  error,
  onRetry,
  searchPlaceholder,
  filters,
  empty,
  onRowClick,
  rowClassName,
  caption,
}: DataTableProps<T>) {
  const sorting: SortingState = query.state.sort ? [{ id: query.state.sort, desc: query.state.order === 'desc' }] : [];
  const table = useReactTable({
    data: data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      query.setSort(next[0]?.id, next[0]?.desc ? 'desc' : 'asc');
    },
  });

  const from = meta && meta.total ? (meta.page - 1) * meta.limit + 1 : 0;
  const to = meta ? Math.min(meta.page * meta.limit, meta.total) : 0;
  const hasFilters = Boolean(query.state.search);

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-raised">
      {(searchPlaceholder || filters) && (
        <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:flex-wrap sm:items-center sm:p-4">
          {searchPlaceholder && (
            <div className="relative sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={query.state.search}
                onChange={(e) => query.setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-9"
                aria-label={searchPlaceholder}
                type="search"
              />
            </div>
          )}
          {filters}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b bg-muted/50">
                {hg.headers.map((h) => {
                  const canSort = h.column.getCanSort();
                  const dir = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : undefined}
                      className={cn(
                        'h-11 whitespace-nowrap px-4 text-left text-[13px] font-medium text-muted-foreground',
                        (h.column.columnDef.meta as { align?: string } | undefined)?.align === 'right' && 'text-right',
                      )}
                    >
                      {canSort ? (
                        <button
                          type="button"
                          onClick={h.column.getToggleSortingHandler()}
                          className="-mx-1.5 inline-flex items-center gap-1 rounded px-1.5 py-1 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {dir === 'asc' ? (
                            <ArrowUp className="size-3.5" aria-hidden />
                          ) : dir === 'desc' ? (
                            <ArrowDown className="size-3.5" aria-hidden />
                          ) : (
                            <ArrowUpDown className="size-3.5 opacity-40" aria-hidden />
                          )}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading && !data
              ? Array.from({ length: 6 }, (_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {columns.map((_c, j) => (
                      <td key={j} className="h-14 px-4">
                        <Skeleton className={cn('h-4', j === 0 ? 'w-40' : 'w-20')} />
                      </td>
                    ))}
                  </tr>
                ))
              : table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    className={cn(
                      'border-b transition-colors last:border-0 hover:bg-accent/50',
                      onRowClick && 'cursor-pointer',
                      rowClassName?.(row.original),
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={cn(
                          'h-14 px-4 align-middle',
                          (cell.column.columnDef.meta as { align?: string } | undefined)?.align === 'right' && 'text-right',
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
        {error ? (
          <ErrorState message={error} onRetry={onRetry} />
        ) : !loading && data && data.length === 0 ? (
          <EmptyState
            title={hasFilters ? 'No matches' : (empty?.title ?? 'Nothing here yet')}
            description={hasFilters ? 'Try a different search or clear the filters.' : empty?.description}
            action={hasFilters ? undefined : empty?.action}
          />
        ) : null}
      </div>

      {meta && meta.total > 0 && (
        <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="tabular text-muted-foreground">
            {from}–{to} of {meta.total}
          </p>
          <div className="flex items-center gap-2">
            <Select value={String(query.state.limit)} onValueChange={(v) => query.setLimit(Number(v))}>
              <SelectTrigger className="h-8 w-[7.5rem]" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} per page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => query.setPage(meta.page - 1)}
              disabled={meta.page <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft />
            </Button>
            <span className="tabular min-w-16 text-center text-muted-foreground">
              {meta.page} / {meta.totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => query.setPage(meta.page + 1)}
              disabled={meta.page >= meta.totalPages}
              aria-label="Next page"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
