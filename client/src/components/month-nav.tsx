'use client';

import { addMonths, format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** "October 2026" with previous / next. `month` is YYYY-MM; `max` stops at the current month. */
export function MonthNav({ month, onChange, max }: { month: string; onChange: (m: string) => void; max?: string }) {
  const date = parseISO(`${month}-01`);
  const shift = (n: number) => format(addMonths(date, n), 'yyyy-MM');
  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon-sm" onClick={() => onChange(shift(-1))} aria-label="Previous month">
        <ChevronLeft />
      </Button>
      <span className="tabular min-w-36 text-center text-[15px] font-semibold" aria-live="polite">
        {format(date, 'MMMM yyyy')}
      </span>
      <Button variant="outline" size="icon-sm" onClick={() => onChange(shift(1))} disabled={Boolean(max && month >= max)} aria-label="Next month">
        <ChevronRight />
      </Button>
    </div>
  );
}
