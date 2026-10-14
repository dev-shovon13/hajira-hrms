'use client';

import * as React from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import type { LateReportRow, LeaveReportRow, MonthlySheetDto } from '@hajira/shared';
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_MARKS } from '@hajira/shared';
import { Button } from '@/components/ui/button';
import { Card, Input, Skeleton, Tooltip } from '@/components/ui/primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/menu';
import { EmptyState, ErrorState, PageHeader, RequestBadge } from '@/components/common';
import { MonthNav } from '@/components/month-nav';
import { useRole } from '@/hooks/use-session';
import { useDepartments } from '@/hooks/use-options';
import { api, clean, download, errorMessage, get } from '@/lib/api';
import { DEFAULT_TZ, fmtDay, fmtRange, fmtTime, todayIn } from '@/lib/format';
import { ATTENDANCE_TONE, TONES } from '@/lib/status';
import { cn } from '@/lib/utils';

const tz = DEFAULT_TZ;

function ExportButtons({ path, params, name }: { path: string; params: Record<string, unknown>; name: string }) {
  const [busy, setBusy] = React.useState<'xlsx' | 'pdf' | null>(null);
  const run = async (format: 'xlsx' | 'pdf') => {
    setBusy(format);
    try {
      const file = await download(path, { ...params, format }, `${name}.${format}`);
      toast.success(`Downloaded ${file}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={() => run('xlsx')} loading={busy === 'xlsx'}>
        {busy !== 'xlsx' && <FileSpreadsheet />} Excel
      </Button>
      <Button variant="outline" onClick={() => run('pdf')} loading={busy === 'pdf'}>
        {busy !== 'pdf' && <FileDown />} PDF
      </Button>
    </div>
  );
}

function DeptSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { isHR } = useRole();
  const departments = useDepartments();
  if (!isHR) return null;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="sm:w-52" aria-label="Department"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All departments</SelectItem>
        {departments.data?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/** The monthly sheet: one row per person, one stitch per day, status letter for print and colour-blind readers. */
function MonthlySheet() {
  const today = todayIn(tz);
  const [month, setMonth] = React.useState(today.slice(0, 7));
  const [dept, setDept] = React.useState('all');
  const params = { month, departmentId: dept };
  const q = useQuery({
    queryKey: ['reports', 'monthly', params],
    queryFn: () => get<MonthlySheetDto>('/reports/monthly', { params: clean(params) }),
    placeholderData: keepPreviousData,
  });

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:flex-wrap sm:items-center">
        <MonthNav month={month} onChange={setMonth} max={today.slice(0, 7)} />
        <DeptSelect value={dept} onChange={setDept} />
        <div className="sm:ml-auto"><ExportButtons path="/reports/monthly" params={params} name={`attendance-${month}`} /></div>
      </div>
      {q.isLoading ? (
        <Skeleton className="m-4 h-80" />
      ) : q.error ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : !q.data?.rows.length ? (
        <EmptyState title="No one to report on" description="Nobody matches these filters for this month." />
      ) : (
        <div className={cn('overflow-x-auto transition-opacity', q.isFetching && 'opacity-60')}>
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Monthly attendance sheet for {month}</caption>
            <thead>
              <tr className="border-b bg-muted/50 text-[12px] text-muted-foreground">
                <th scope="col" className="sticky left-0 z-10 min-w-48 bg-muted px-4 py-2.5 text-left font-medium">Employee</th>
                {q.data.dates.map((d) => (
                  <th key={d} scope="col" className={cn('tabular w-7 px-0 py-2.5 text-center font-medium', d === today && 'text-foreground')}>
                    <span className="block text-[10px] font-normal">{format(parseISO(d), 'EEEEE')}</span>
                    {Number(d.slice(8))}
                  </th>
                ))}
                {['P', 'L', 'A', 'LV', 'Hrs'].map((h) => (
                  <th key={h} scope="col" className="tabular px-2 py-2.5 text-right font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.data.rows.map((r) => (
                <tr key={r.user.id} className="border-b last:border-0 hover:bg-accent/40">
                  <th scope="row" className="sticky left-0 z-10 bg-card px-4 py-2 text-left font-normal">
                    <span className="block font-medium leading-tight">{r.user.name}</span>
                    <span className="text-xs text-muted-foreground">{r.user.department}</span>
                  </th>
                  {r.days.map((s, i) => {
                    const date = q.data!.dates[i];
                    if (!s) return <td key={date} className="px-[2px]" aria-label="no record" />;
                    const color = TONES[ATTENDANCE_TONE[s]].mark;
                    return (
                      <td key={date} className="px-[2px] text-center">
                        <Tooltip content={`${fmtDay(date)}: ${ATTENDANCE_STATUS_LABELS[s]}`}>
                          <span className="grid justify-items-center gap-1" aria-label={`${fmtDay(date)}: ${ATTENDANCE_STATUS_LABELS[s]}`}>
                            <span className="block w-4 rounded-full" style={{ height: s === 'WEEKEND' ? 1 : 3, background: color }} />
                            <span className={cn('text-[9px] font-semibold leading-none', s === 'WEEKEND' ? 'text-muted-foreground/60' : 'text-muted-foreground')}>
                              {s === 'WEEKEND' ? '' : ATTENDANCE_STATUS_MARKS[s]}
                            </span>
                          </span>
                        </Tooltip>
                      </td>
                    );
                  })}
                  <td className="tabular px-2 text-right">{r.totals.present}</td>
                  <td className="tabular px-2 text-right text-late-ink">{r.totals.late || ''}</td>
                  <td className="tabular px-2 text-right text-absent-ink">{r.totals.absent || ''}</td>
                  <td className="tabular px-2 text-right text-leave-ink">{r.totals.leave || ''}</td>
                  <td className="tabular px-3 text-right">{r.totals.workHours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="border-t px-4 py-3 text-xs text-muted-foreground">
        P present · L late · H half day · A absent · LV leave · HO holiday · hairline weekly off
      </p>
    </Card>
  );
}

function useRangeReport<T>(path: string) {
  const today = todayIn(tz);
  const [from, setFrom] = React.useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = React.useState(today);
  const [dept, setDept] = React.useState('all');
  const [page, setPage] = React.useState(1);
  const params = { from, to, departmentId: dept };
  const q = useQuery({
    queryKey: ['reports', path, params, page],
    queryFn: async () => {
      const res = await api.get(path, { params: clean({ ...params, page, limit: 25 }) });
      return { ...(res.data.data as { rows: T[]; summary: unknown }), meta: res.data.meta as { page: number; totalPages: number; total: number } };
    },
    placeholderData: keepPreviousData,
  });
  const filters = (
    <>
      <div className="flex items-center gap-2">
        <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-40" aria-label="From" />
        <span className="text-muted-foreground">to</span>
        <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-40" aria-label="To" />
      </div>
      <DeptSelect value={dept} onChange={(v) => { setDept(v); setPage(1); }} />
    </>
  );
  return { q, params, filters, page, setPage };
}

function Pager({ page, totalPages, total, onPage }: { page: number; totalPages: number; total: number; onPage: (p: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t px-4 py-3 text-sm">
      <span className="tabular text-muted-foreground">{total} rows</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <span className="tabular text-muted-foreground">{page} / {totalPages}</span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

function LateReport() {
  const { q, params, filters, page, setPage } = useRangeReport<LateReportRow>('/reports/late');
  const summary = q.data?.summary as { averageMinutes: number; totalMinutes: number } | undefined;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:flex-wrap sm:items-center">
        {filters}
        <div className="sm:ml-auto"><ExportButtons path="/reports/late" params={params} name="late-report" /></div>
      </div>
      {summary && q.data && (
        <p className="border-b px-4 py-3 text-sm text-muted-foreground">
          <strong className="tabular text-foreground">{q.data.meta.total}</strong> late arrivals · average{' '}
          <strong className="tabular text-foreground">{summary.averageMinutes} min</strong> · {Math.round(summary.totalMinutes / 60)} hours lost in total
        </p>
      )}
      {q.isLoading ? <Skeleton className="m-4 h-60" /> : q.error ? <ErrorState message={errorMessage(q.error)} /> : !q.data?.rows.length ? (
        <EmptyState tone="present" title="No late arrivals in this range" description="Either everyone was on time, or the range is empty." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <caption className="sr-only">Late arrivals</caption>
            <thead><tr className="border-b bg-muted/50 text-left text-[13px] text-muted-foreground">
              <th scope="col" className="h-10 px-4 font-medium">Date</th><th scope="col" className="px-3 font-medium">Employee</th>
              <th scope="col" className="px-3 font-medium">Department</th><th scope="col" className="px-3 font-medium">Checked in</th>
              <th scope="col" className="px-4 text-right font-medium">Minutes late</th>
            </tr></thead>
            <tbody>
              {q.data.rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="h-12 whitespace-nowrap px-4">{fmtDay(r.date)}</td>
                  <td className="px-3 font-medium">{r.user.name}</td>
                  <td className="px-3 text-muted-foreground">{r.user.department}</td>
                  <td className="tabular px-3">{fmtTime(r.checkIn, tz)}</td>
                  <td className="px-4 text-right">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-[3px] rounded-full bg-late" style={{ width: Math.min(64, 6 + r.lateMinutes) }} aria-hidden />
                      <span className="tabular w-8 font-medium text-late-ink">{r.lateMinutes}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} totalPages={q.data.meta.totalPages} total={q.data.meta.total} onPage={setPage} />
        </div>
      )}
    </Card>
  );
}

function LeaveReport() {
  const { q, params, filters, page, setPage } = useRangeReport<LeaveReportRow>('/reports/leave');
  const summary = q.data?.summary as { leaveType: string; days: number }[] | undefined;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:flex-wrap sm:items-center">
        {filters}
        <div className="sm:ml-auto"><ExportButtons path="/reports/leave" params={params} name="leave-report" /></div>
      </div>
      {summary && summary.length > 0 && (
        <p className="border-b px-4 py-3 text-sm text-muted-foreground">
          Approved: {summary.map((s) => <span key={s.leaveType} className="mr-3 inline-block"><strong className="tabular text-foreground">{s.days}</strong> {s.leaveType.toLowerCase()}</span>)}
        </p>
      )}
      {q.isLoading ? <Skeleton className="m-4 h-60" /> : q.error ? <ErrorState message={errorMessage(q.error)} /> : !q.data?.rows.length ? (
        <EmptyState tone="leave" title="No leave in this range" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <caption className="sr-only">Leave requests</caption>
            <thead><tr className="border-b bg-muted/50 text-left text-[13px] text-muted-foreground">
              <th scope="col" className="h-10 px-4 font-medium">Employee</th><th scope="col" className="px-3 font-medium">Type</th>
              <th scope="col" className="px-3 font-medium">Dates</th><th scope="col" className="px-3 text-right font-medium">Days</th>
              <th scope="col" className="px-4 font-medium">Status</th>
            </tr></thead>
            <tbody>
              {q.data.rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="h-12 px-4"><span className="block font-medium">{r.user.name}</span><span className="text-xs text-muted-foreground">{r.user.department}</span></td>
                  <td className="px-3">{r.leaveType}</td>
                  <td className="whitespace-nowrap px-3">{fmtRange(r.startDate, r.endDate)}</td>
                  <td className="tabular px-3 text-right">{r.days}</td>
                  <td className="px-4"><RequestBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} totalPages={q.data.meta.totalPages} total={q.data.meta.total} onPage={setPage} />
        </div>
      )}
    </Card>
  );
}

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Reports" description="Monthly sheets, late arrivals and leave, filtered your way and ready to export to Excel or PDF." />
      <Tabs defaultValue="monthly">
        <TabsList>
          <TabsTrigger value="monthly">Monthly sheet</TabsTrigger>
          <TabsTrigger value="late">Late arrivals</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
        </TabsList>
        <TabsContent value="monthly"><MonthlySheet /></TabsContent>
        <TabsContent value="late"><LateReport /></TabsContent>
        <TabsContent value="leave"><LeaveReport /></TabsContent>
      </Tabs>
    </>
  );
}
