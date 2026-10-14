'use client';

import Link from 'next/link';
import { useTheme } from 'next-themes';
import { KeyRound, LogOut, Menu, Monitor, Moon, Search, Sun, UserRound } from 'lucide-react';
import { ROLE_LABELS } from '@hajira/shared';
import { Button } from '@/components/ui/button';
import { Avatar, Tooltip } from '@/components/ui/primitives';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/menu';
import { useSession, useSignOut } from '@/hooks/use-session';
import { useUi } from '@/stores/ui';
import { LogoMark } from './logo';
import { NotificationBell } from './notifications';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  const label = `Theme: ${theme ?? 'system'}. Switch to ${next}.`;
  return (
    <Tooltip content={label}>
      <Button variant="ghost" size="icon" onClick={() => setTheme(next)} aria-label={label}>
        <Icon className="size-[18px]" suppressHydrationWarning />
      </Button>
    </Tooltip>
  );
}

export function Topbar() {
  const { data: me } = useSession();
  const signOut = useSignOut();
  const setMobileNav = useUi((s) => s.setMobileNav);
  const setCommand = useUi((s) => s.setCommand);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:px-6 lg:px-8">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open menu">
        <Menu className="size-5" />
      </Button>
      <Link href="/dashboard" className="lg:hidden" aria-label="Hajira home">
        <LogoMark />
      </Link>

      <button
        type="button"
        onClick={() => setCommand(true)}
        className="ml-1 hidden h-10 w-full max-w-sm items-center gap-3 rounded-lg border bg-card px-3 text-sm text-muted-foreground outline-none transition-colors hover:border-ring/40 focus-visible:ring-2 focus-visible:ring-ring sm:flex lg:ml-0"
      >
        <Search className="size-4" aria-hidden />
        <span>Search pages or people…</span>
        <kbd className="ml-auto rounded border bg-muted px-1.5 font-sans text-[11px] font-medium">Ctrl K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setCommand(true)} aria-label="Search">
          <Search className="size-[18px]" />
        </Button>
        <NotificationBell />
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ml-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label="Account menu"
            >
              <Avatar name={me?.name ?? '…'} src={me?.avatarUrl} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            {me && (
              <DropdownMenuLabel className="grid gap-0.5">
                <span className="truncate font-semibold">{me.name}</span>
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {me.email} · {ROLE_LABELS[me.role]}
                </span>
              </DropdownMenuLabel>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile">
                <UserRound /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/profile#password">
                <KeyRound /> Change password
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void signOut()}>
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
