'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import type { NotificationDto, NotificationType } from '@hajira/shared';
import { Popover, PopoverContent, PopoverTrigger, Skeleton } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { api, get, send } from '@/lib/api';
import { fmtAgo } from '@/lib/format';
import { cn } from '@/lib/utils';

const TONE: Record<NotificationType, string> = {
  LEAVE_STATUS: 'var(--leave)',
  LEAVE_REQUEST: 'var(--leave)',
  LATE_WARNING: 'var(--late)',
  MISSING_CHECKOUT: 'var(--absent)',
  ACCOUNT_APPROVAL: 'var(--present)',
  REGULARIZATION: 'var(--halfday)',
  LATE_PENALTY: 'var(--absent)',
  GENERAL: 'var(--holiday)',
};

export function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);

  const unread = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => get<{ count: number }>('/notifications/unread-count'),
    refetchInterval: 30_000,
  });
  const list = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: async () => (await api.get('/notifications', { params: { limit: 12 } })).data.data as { items: NotificationDto[]; unread: number },
    enabled: open,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['notifications'] });
  const readOne = useMutation({ mutationFn: (id: string) => send('post', `/notifications/${id}/read`), onSuccess: refresh });
  const readAll = useMutation({ mutationFn: () => send('post', '/notifications/read-all'), onSuccess: refresh });

  const count = unread.data?.count ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={count ? `Notifications, ${count} unread` : 'Notifications'}>
          <Bell className="size-[18px]" />
          {count > 0 && (
            <span className="tabular absolute right-1 top-1 min-w-4 rounded-full bg-absent px-1 text-center text-[10px] font-bold leading-4 text-white">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Notifications</h2>
          <Button variant="ghost" size="sm" onClick={() => readAll.mutate()} disabled={!count || readAll.isPending}>
            <CheckCheck /> Mark all read
          </Button>
        </div>
        <div className="max-h-[26rem] overflow-y-auto">
          {list.isLoading ? (
            <div className="grid gap-3 p-4">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : list.data?.items.length ? (
            <ul>
              {list.data.items.map((n) => {
                const body = (
                  <>
                    <span
                      aria-hidden
                      className="mt-2 h-[3px] w-3 shrink-0 rounded-full"
                      style={{ background: TONE[n.type], opacity: n.readAt ? 0.4 : 1 }}
                    />
                    <span className="grid min-w-0 gap-0.5">
                      <span className={cn('text-sm', n.readAt ? 'text-muted-foreground' : 'font-semibold')}>{n.title}</span>
                      <span className="line-clamp-2 text-[13px] text-muted-foreground">{n.body}</span>
                      <span className="text-xs text-muted-foreground">{fmtAgo(n.createdAt)}</span>
                    </span>
                  </>
                );
                const cls = 'flex w-full gap-3 border-b px-4 py-3 text-left transition-colors last:border-0 hover:bg-accent focus-visible:bg-accent focus-visible:outline-none';
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link
                        href={n.link}
                        className={cls}
                        onClick={() => {
                          if (!n.readAt) readOne.mutate(n.id);
                          setOpen(false);
                        }}
                      >
                        {body}
                      </Link>
                    ) : (
                      <button type="button" className={cls} onClick={() => !n.readAt && readOne.mutate(n.id)}>
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="grid justify-items-center gap-2 px-6 py-10 text-center">
              <span className="stitch-line h-[3px] w-20 [--thread:var(--off)]" aria-hidden />
              <p className="text-sm font-medium">You are all caught up</p>
              <p className="text-[13px] text-muted-foreground">Leave decisions, late warnings and approvals show up here.</p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
