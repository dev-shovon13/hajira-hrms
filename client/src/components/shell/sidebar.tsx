'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { useNavCounts } from '@/hooks/use-counts';
import { useUi } from '@/stores/ui';
import { Avatar, Tooltip } from '@/components/ui/primitives';
import { Sheet, SheetContent } from '@/components/ui/dialog';
import { ROLE_LABELS } from '@hajira/shared';
import { cn } from '@/lib/utils';
import { Logo } from './logo';
import { isActive, navFor } from './nav';

function NavList({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: me } = useSession();
  const counts = useNavCounts();
  const groups = navFor(me?.role);

  return (
    <nav aria-label="Main" className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.label} className="grid gap-0.5">
          {collapsed ? (
            <div className="mx-3 mb-1 h-px bg-rail-border" aria-hidden />
          ) : (
            <p className="px-3 pb-1.5 text-[13px] font-medium text-rail-muted">{group.label}</p>
          )}
          {group.items.map((item) => {
            const active = isActive(pathname, item.href);
            const count = item.badge ? counts[item.badge] : 0;
            const link = (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative flex h-10 items-center gap-3 rounded-lg px-3 text-[15px] text-rail-foreground/85 outline-none transition-colors',
                  'hover:bg-rail-raised/70 hover:text-white focus-visible:ring-2 focus-visible:ring-marigold',
                  active && 'bg-rail-raised text-white',
                  collapsed && 'justify-center px-0',
                )}
              >
                {/* The active mark is a marigold stitch at the rail's edge. */}
                <span
                  aria-hidden
                  className={cn(
                    'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-marigold transition-opacity',
                    active ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <item.icon className="size-[18px] shrink-0" aria-hidden />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {count > 0 && (
                  <span
                    className={cn(
                      'tabular rounded-full bg-marigold px-1.5 text-[11px] font-bold leading-5 text-marigold-foreground',
                      collapsed ? 'absolute right-1.5 top-1 min-w-4 text-center leading-4' : 'ml-auto min-w-5 text-center',
                    )}
                    aria-label={`${count} waiting`}
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </Link>
            );
            return collapsed ? (
              <Tooltip key={item.href} content={item.label} side="right">
                {link}
              </Tooltip>
            ) : (
              link
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function UserFoot({ collapsed }: { collapsed: boolean }) {
  const { data: me } = useSession();
  if (!me) return null;
  return (
    <Link
      href="/profile"
      className={cn(
        'flex items-center gap-3 rounded-lg p-2 outline-none transition-colors hover:bg-rail-raised/70 focus-visible:ring-2 focus-visible:ring-marigold',
        collapsed && 'justify-center',
      )}
    >
      <Avatar name={me.name} src={me.avatarUrl} className="ring-2 ring-rail-border" />
      {!collapsed && (
        <span className="grid min-w-0 leading-tight">
          <span className="truncate text-sm font-semibold text-white">{me.name}</span>
          <span className="truncate text-[13px] text-rail-muted">
            {me.designation?.title ?? ROLE_LABELS[me.role]}
          </span>
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const toggle = useUi((s) => s.toggleSidebar);
  return (
    // The outer column paints the rail the full height of the page; the inner one sticks.
    <div className="hidden shrink-0 bg-rail lg:block">
    <aside
      className={cn(
        'sticky top-0 flex h-dvh flex-col text-rail-foreground transition-[width] duration-200 ease-out',
        collapsed ? 'w-[76px]' : 'w-[252px]',
      )}
    >
      <div className={cn('flex h-16 items-center px-5', collapsed && 'justify-center px-0')}>
        <Link href="/dashboard" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-marigold" aria-label="Hajira home">
          <Logo tone="light" collapsed={collapsed} />
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4 [scrollbar-color:var(--rail-border)_transparent]">
        <NavList collapsed={collapsed} />
      </div>
      <div className="grid gap-1 border-t border-rail-border p-3">
        <UserFoot collapsed={collapsed} />
        <button
          type="button"
          onClick={toggle}
          className={cn(
            'flex h-9 items-center gap-3 rounded-lg px-3 text-sm text-rail-muted outline-none transition-colors hover:bg-rail-raised/70 hover:text-white focus-visible:ring-2 focus-visible:ring-marigold',
            collapsed && 'justify-center px-0',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
          {!collapsed && 'Collapse'}
        </button>
      </div>
    </aside>
    </div>
  );
}

export function MobileNav() {
  const open = useUi((s) => s.mobileNavOpen);
  const setOpen = useUi((s) => s.setMobileNav);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" className="w-[min(100%-3rem,19rem)] border-rail-border bg-rail p-0 text-rail-foreground" hideClose aria-describedby={undefined}>
        <div className="flex h-16 items-center px-5">
          <Logo tone="light" />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <NavList collapsed={false} onNavigate={() => setOpen(false)} />
        </div>
        <div className="border-t border-rail-border p-3" onClick={() => setOpen(false)}>
          <UserFoot collapsed={false} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
