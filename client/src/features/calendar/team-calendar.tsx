'use client';

import * as React from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { DatesSetArg, EventContentArg } from '@fullcalendar/core';
import { useQuery } from '@tanstack/react-query';
import { addDays, format, parseISO } from 'date-fns';
import type { CalendarEventDto } from '@hajira/shared';
import { get } from '@/lib/api';
import { leaveColor } from '@/lib/leave-colors';

/**
 * Who is away. Approved leave is a solid thread, pending leave is dashed,
 * holidays are purple. Colleagues see names and types only, never reasons.
 */
export default function TeamCalendar({ departmentId, compact }: { departmentId?: string; compact: boolean }) {
  const [range, setRange] = React.useState<{ from: string; to: string } | null>(null);
  const q = useQuery({
    queryKey: ['calendar', range, departmentId],
    queryFn: () => get<CalendarEventDto[]>('/leave/calendar', { params: { ...range, departmentId } }),
    enabled: Boolean(range),
    placeholderData: (p) => p,
  });

  const events = (q.data ?? []).map((e) => ({
    id: e.id,
    title: e.kind === 'HOLIDAY' ? e.title : `${e.title}${e.isHalfDay ? ' (½)' : ''}`,
    start: e.start,
    // FullCalendar's end is exclusive.
    end: format(addDays(parseISO(e.end), 1), 'yyyy-MM-dd'),
    allDay: true,
    extendedProps: e,
  }));

  return (
    <div className={q.isFetching ? 'opacity-80 transition-opacity' : 'transition-opacity'}>
      <FullCalendar
        plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
        initialView={compact ? 'listMonth' : 'dayGridMonth'}
        key={compact ? 'list' : 'grid'}
        headerToolbar={{ left: 'title', center: '', right: compact ? 'prev,next' : 'today prev,next dayGridMonth,listMonth' }}
        buttonText={{ today: 'Today', dayGridMonth: 'Month', listMonth: 'List' }}
        firstDay={6}
        height="auto"
        dayMaxEventRows={4}
        fixedWeekCount={false}
        events={events}
        datesSet={(arg: DatesSetArg) =>
          setRange({ from: format(arg.start, 'yyyy-MM-dd'), to: format(addDays(arg.end, -1), 'yyyy-MM-dd') })
        }
        eventContent={(arg: EventContentArg) => {
          const e = arg.event.extendedProps as CalendarEventDto;
          const color = e.kind === 'HOLIDAY' ? 'var(--holiday)' : leaveColor(e.leaveTypeCode, e.color);
          const pending = e.status === 'PENDING';
          return (
            <span className="flex min-w-0 items-center gap-1.5 px-0.5 text-foreground" title={`${arg.event.title}${e.leaveType ? ` · ${e.leaveType}` : ''}${pending ? ' · pending' : ''}`}>
              <span
                aria-hidden
                className="h-[3px] w-2.5 shrink-0 rounded-full"
                style={pending ? { backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 3px, transparent 3px 5px)` } : { background: color }}
              />
              <span className={`truncate ${e.kind === 'HOLIDAY' ? 'font-semibold text-holiday-ink' : ''}`}>
                {arg.event.title}
                {pending && <span className="text-muted-foreground"> · pending</span>}
              </span>
            </span>
          );
        }}
        eventClassNames={() => ['!bg-transparent', 'hover:!bg-accent']}
      />
    </div>
  );
}
