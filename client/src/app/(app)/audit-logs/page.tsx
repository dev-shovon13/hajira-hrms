'use client';

import * as React from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { format, parseISO } from 'date-fns';
import type { AuditLogDto } from '@hajira/shared';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/menu';
import { Sheet, SheetContent } from '@/components/ui/dialog';
import { Badge, PageHeader } from '@/components/common';
import { DataTable, useTableQuery } from '@/components/data-table';
import { errorMessage, getPage } from '@/lib/api';
import type { Tone } from '@/lib/status';

const ENTITIES = ['Attendance', 'LeaveRequest', 'LeaveBalance', 'User', 'Department', 'Designation', 'Shift', 'Holiday', 'LeaveType', 'Setting'];

const toneOf = (action: string): Tone =>
  action.includes('reject') || action.includes('delete') ? 'absent' : action.includes('approve') ? 'present' : action.includes('edit') || action.includes('regularize') || action.includes('role') ? 'late' : 'neutral';

const human = (a: string) => a.replace(/[._]/g, ' ');

function Diff({ before, after }: { before: unknown; after: unknown }) {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  if (!keys.length) return <p className="text-sm text-muted-foreground">No field details recorded.</p>;
  const show = (v: unknown) => (v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-left text-[13px] text-muted-foreground"><th scope="col" className="pb-2 font-medium">Field</th><th scope="col" className="pb-2 font-medium">Before</th><th scope="col" className="pb-2 font-medium">After</th></tr></thead>
      <tbody>
        {keys.map((k) => {
          const changed = show(b[k]) !== show(a[k]);
          return (
            <tr key={k} className="border-t align-top">
              <td className="py-2 pr-3 font-medium">{k}</td>
              <td className={`break-all py-2 pr-3 ${changed ? 'text-absent-ink line-through decoration-absent/40' : 'text-muted-foreground'}`}>{k in b ? show(b[k]) : ''}</td>
              <td className={`break-all py-2 ${changed ? 'font-medium text-present-ink' : 'text-muted-foreground'}`}>{k in a ? show(a[k]) : ''}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function AuditLogPage() {
  const table = useTableQuery({ order: 'desc' });
  const [entity, setEntity] = React.useState('all');
  const [open, setOpen] = React.useState<AuditLogDto | null>(null);
  const q = useQuery({ queryKey: ['audit', table.params, entity], queryFn: () => getPage<AuditLogDto>('/audit-logs', { ...table.params, entity }), placeholderData: keepPreviousData });

  const columns = React.useMemo<ColumnDef<AuditLogDto, unknown>[]>(() => [
    { id: 'createdAt', header: 'When', enableSorting: false, cell: ({ row }) => <span className="tabular whitespace-nowrap text-muted-foreground">{format(parseISO(row.original.createdAt), 'd MMM yyyy, HH:mm')}</span> },
    { id: 'actor', header: 'Who', enableSorting: false, cell: ({ row }) => row.original.actor?.name ?? <span className="text-muted-foreground">System</span> },
    { id: 'action', header: 'Action', enableSorting: false, cell: ({ row }) => <Badge tone={toneOf(row.original.action)}>{human(row.original.action)}</Badge> },
    { id: 'entity', header: 'Record', enableSorting: false, cell: ({ row }) => <span className="text-muted-foreground">{row.original.entity}</span> },
    { id: 'ip', header: 'IP', enableSorting: false, cell: ({ row }) => <span className="tabular text-xs text-muted-foreground">{row.original.ip?.replace('::ffff:', '') ?? '—'}</span> },
    { id: 'view', header: () => <span className="sr-only">Details</span>, enableSorting: false, meta: { align: 'right' }, cell: ({ row }) => <Button variant="ghost" size="sm" onClick={() => setOpen(row.original)}>Details</Button> },
  ], []);

  return (
    <>
      <PageHeader title="Audit log" description="Attendance edits, leave decisions, role changes and settings, with who did it and what changed." />
      <DataTable
        caption="Audit log" columns={columns} data={q.data?.rows} meta={q.data?.meta} query={table} loading={q.isLoading} error={q.error ? errorMessage(q.error) : null}
        searchPlaceholder="Search action or person"
        filters={
          <Select value={entity} onValueChange={(v) => { setEntity(v); table.reset(); }}>
            <SelectTrigger className="sm:w-48" aria-label="Record type"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Every record type</SelectItem>{ENTITIES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
          </Select>
        }
        onRowClick={setOpen}
        empty={{ title: 'Nothing logged yet' }}
      />
      <Sheet open={Boolean(open)} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-[min(100%,34rem)] overflow-y-auto p-6" aria-describedby={undefined}>
          {open && (
            <div className="grid gap-5">
              <div className="grid gap-1.5 pr-8">
                <h2 className="text-lg font-semibold capitalize">{human(open.action)}</h2>
                <p className="text-sm text-muted-foreground">
                  {open.actor?.name ?? 'System'} · {format(parseISO(open.createdAt), 'EEEE d MMM yyyy, HH:mm:ss')}
                </p>
                <p className="tabular text-xs text-muted-foreground">{open.entity} {open.entityId}</p>
              </div>
              <Diff before={open.before} after={open.after} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
