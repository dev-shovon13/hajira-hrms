'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogIn, LogOut, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import type { AttendanceDto, EmployeeDashboardDto, TodayDto } from '@hajira/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/primitives';
import { AttendanceBadge, Badge } from '@/components/common';
import { ShiftSeam } from '@/components/stitch/shift-seam';
import { useServerClock } from '@/hooks/use-server-clock';
import { errorMessage, send } from '@/lib/api';
import { fmtClock, fmtMinutes, fmtTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const KEY = ['dashboard', 'employee'];

function patchToday(qc: ReturnType<typeof useQueryClient>, fn: (t: TodayDto) => TodayDto) {
  qc.setQueryData<EmployeeDashboardDto>(KEY, (old) => (old ? { ...old, today: fn(old.today) } : old));
}

export function TodayCard({ today, className }: { today: TodayDto; className?: string }) {
  const qc = useQueryClient();
  const now = useServerClock(today.serverTime);
  const tz = today.timezone;
  const att = today.attendance;

  const settle = () => {
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
    void qc.invalidateQueries({ queryKey: ['attendance'] });
    void qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  // Optimistic: the stitch is pulled through immediately; the server's timestamp replaces ours on success.
  const checkIn = useMutation({
    mutationFn: () => send<AttendanceDto>('post', '/attendance/check-in'),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<EmployeeDashboardDto>(KEY);
      const late = today.window && now > new Date(today.window.graceEnd) && today.dayType === 'WORKDAY';
      patchToday(qc, (t) => ({
        ...t,
        canCheckIn: false,
        canCheckOut: true,
        attendance: {
          id: 'optimistic',
          date: t.date,
          checkIn: now.toISOString(),
          checkOut: null,
          status: late ? 'LATE' : 'PRESENT',
          lateMinutes: 0,
          earlyLeaveMinutes: 0,
          workMinutes: 0,
          overtimeMinutes: 0,
          isFlagged: false,
          flagReason: null,
          autoClosed: false,
          note: null,
        },
      }));
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev);
      toast.error(errorMessage(err));
    },
    onSuccess: ({ data, message }) => {
      patchToday(qc, (t) => ({ ...t, attendance: data }));
      if (data.status === 'LATE') toast.warning(message);
      else toast.success(message);
    },
    onSettled: settle,
  });

  const checkOut = useMutation({
    mutationFn: () => send<AttendanceDto>('post', '/attendance/check-out'),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<EmployeeDashboardDto>(KEY);
      patchToday(qc, (t) => ({
        ...t,
        canCheckOut: false,
        attendance: t.attendance ? { ...t.attendance, checkOut: now.toISOString() } : t.attendance,
      }));
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev);
      toast.error(errorMessage(err));
    },
    onSuccess: ({ data, message }) => {
      patchToday(qc, (t) => ({ ...t, attendance: data }));
      toast.success(message);
    },
    onSettled: settle,
  });

  const [hh, mm, ss] = fmtClock(now, tz).split(':');
  const done = Boolean(att?.checkIn && att.checkOut);
  const openMinutes = att?.checkIn && !att.checkOut ? Math.max(0, Math.round((now.getTime() - new Date(att.checkIn).getTime()) / 60_000)) : 0;

  const dayNote =
    today.dayType === 'HOLIDAY'
      ? `Holiday: ${today.holiday?.name}`
      : today.dayType === 'WEEKEND'
        ? 'Weekly off'
        : today.dayType === 'LEAVE'
          ? `On ${today.leave?.type.toLowerCase()}`
          : null;

  const shiftLine = today.shift
    ? `${today.shift.name} shift ${today.shift.startTime}–${today.shift.endTime}${today.shift.graceMinutes ? ` · grace until ${fmtTime(today.window?.graceEnd, tz)}` : ''}`
    : 'No shift assigned';

  const statusLine = done
    ? `Done for today · ${fmtMinutes(att!.workMinutes)} worked`
    : att?.checkIn
      ? `In since ${fmtTime(att.checkIn, tz)} · ${fmtMinutes(openMinutes)} so far`
      : today.dayType === 'WORKDAY' && today.window && now > new Date(today.window.graceEnd)
        ? 'Not checked in · past your grace period'
        : 'Not checked in yet';

  const action = (
    <TodayAction
      today={today}
      done={done}
      onCheckIn={() => checkIn.mutate()}
      onCheckOut={() => checkOut.mutate()}
      checkingIn={checkIn.isPending}
      checkingOut={checkOut.isPending}
    />
  );

  return (
    <Card className={cn('flex flex-col', className)}>
      <div className="flex flex-1 flex-col gap-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[17px] font-semibold">Today</h2>
          <div className="flex items-center gap-2">
            {dayNote && <Badge tone={today.dayType === 'HOLIDAY' ? 'holiday' : today.dayType === 'LEAVE' ? 'leave' : 'neutral'}>{dayNote}</Badge>}
            {att?.status && att.id !== 'optimistic' && <AttendanceBadge status={att.status} />}
          </div>
        </div>

        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid gap-3">
            <p className="text-[13px] text-muted-foreground">Office time · {tz}</p>
            <p className="tabular text-figure-xl font-semibold tracking-[-0.03em]" aria-live="off" suppressHydrationWarning>
              {hh}:{mm}
              <span className="ml-1 text-[0.42em] font-medium text-muted-foreground">:{ss}</span>
            </p>
            <div className="grid gap-1 text-[15px]">
              <p className={cn('font-medium', att?.status === 'LATE' && !done && 'text-late-ink')}>{statusLine}</p>
              <p className="text-muted-foreground">{shiftLine}</p>
            </div>
          </div>

          {/* On phones the action sits at the bottom of the card (thumb reach); see below. */}
          <div className="hidden gap-2 sm:grid sm:justify-items-end">{action}</div>
        </div>

        {today.window && (
          <ShiftSeam window={today.window} checkIn={att?.checkIn ?? null} checkOut={att?.checkOut ?? null} status={att?.status ?? null} now={now} tz={tz} />
        )}

        <div className="grid gap-2 sm:hidden">{action}</div>
      </div>
    </Card>
  );
}

function TodayAction({
  today,
  done,
  onCheckIn,
  onCheckOut,
  checkingIn,
  checkingOut,
}: {
  today: TodayDto;
  done: boolean;
  onCheckIn: () => void;
  onCheckOut: () => void;
  checkingIn: boolean;
  checkingOut: boolean;
}) {
  const att = today.attendance;
  const tz = today.timezone;
  return (
    <>
      {today.canCheckIn && !done ? (
        <Button size="xl" className="w-full sm:w-auto" onClick={onCheckIn} loading={checkingIn} disabled={!today.ipAllowed}>
          {!checkingIn && <LogIn />} Check in
        </Button>
      ) : today.canCheckOut ? (
        <Button size="xl" variant="outline" className="w-full border-2 sm:w-auto" onClick={onCheckOut} loading={checkingOut} disabled={!today.ipAllowed}>
          {!checkingOut && <LogOut />} Check out
        </Button>
      ) : (
        <p className="tabular text-sm text-muted-foreground">
          {fmtTime(att?.checkIn, tz)} – {fmtTime(att?.checkOut, tz)}
        </p>
      )}
      {!today.ipAllowed && (
        <p className="flex items-center gap-1.5 text-[13px] text-absent-ink">
          <ShieldAlert className="size-4" aria-hidden /> Connect to the office network to check in
        </p>
      )}
    </>
  );
}
