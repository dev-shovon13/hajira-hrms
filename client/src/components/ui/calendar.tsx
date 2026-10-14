'use client';

import * as React from 'react';
import { DayPicker, type DayPickerProps } from 'react-day-picker';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from './button';

/** react-day-picker v9 styled for the app (Saturday-first weeks are not assumed: weeks start Sunday). */
export function Calendar({ className, classNames, showOutsideDays = true, ...props }: DayPickerProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-1', className)}
      classNames={{
        months: 'relative flex flex-col gap-4 sm:flex-row',
        month: 'flex w-full flex-col gap-3',
        month_caption: 'flex h-9 items-center justify-center',
        caption_label: 'text-sm font-semibold',
        nav: 'absolute inset-x-0 top-0 flex items-center justify-between',
        button_previous: cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'z-10'),
        button_next: cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'z-10'),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'w-9 text-center text-xs font-medium text-muted-foreground',
        week: 'mt-1 flex w-full',
        day: 'relative size-9 p-0 text-center text-sm tabular',
        day_button:
          'inline-flex size-9 items-center justify-center rounded-md outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring aria-selected:hover:bg-primary-hover',
        selected: '[&>button]:bg-primary [&>button]:text-primary-foreground',
        range_start: '[&>button]:rounded-r-none',
        range_end: '[&>button]:rounded-l-none',
        range_middle: '[&>button]:!bg-accent [&>button]:!text-accent-foreground [&>button]:rounded-none',
        today: '[&>button]:font-bold [&>button]:underline [&>button]:decoration-marigold [&>button]:decoration-2 [&>button]:underline-offset-4',
        outside: 'text-muted-foreground/50',
        disabled: 'text-muted-foreground/40 [&>button]:cursor-not-allowed [&>button]:hover:bg-transparent',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />,
      }}
      {...props}
    />
  );
}
