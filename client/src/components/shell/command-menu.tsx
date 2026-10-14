'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { useQuery } from '@tanstack/react-query';
import { Search, UserRound } from 'lucide-react';
import type { UserRow } from '@hajira/shared';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { getPage } from '@/lib/api';
import { useRole, useSession } from '@/hooks/use-session';
import { useDebounced } from '@/hooks/use-debounced';
import { useUi } from '@/stores/ui';
import { navFor } from './nav';

/** ⌘K / Ctrl+K: jump to any page, or find a person (managers and HR). */
export function CommandMenu() {
  const open = useUi((s) => s.commandOpen);
  const setOpen = useUi((s) => s.setCommand);
  const router = useRouter();
  const { data: me } = useSession();
  const { isApprover } = useRole();
  const [query, setQuery] = React.useState('');
  const search = useDebounced(query, 250);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!useUi.getState().commandOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  const people = useQuery({
    queryKey: ['users', 'search', search],
    queryFn: () => getPage<UserRow>('/users', { search, limit: 6, status: 'ACTIVE' }),
    enabled: open && isApprover && search.length >= 2,
  });

  const go = (href: string) => {
    setOpen(false);
    setQuery('');
    router.push(href);
  };

  const item =
    'flex cursor-default items-center gap-3 rounded-md px-3 py-2.5 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg]:size-4 [&_svg]:text-muted-foreground';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[18%] translate-y-0 gap-0 overflow-hidden p-0" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Search</DialogTitle>
        <Command shouldFilter={!people.data?.rows.length} className="flex flex-col">
          <div className="flex items-center gap-3 border-b px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder={isApprover ? 'Search pages or people…' : 'Search pages…'}
              className="h-13 w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-[22rem] overflow-y-auto p-2">
            <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">
              Nothing matches “{query}”.
            </Command.Empty>
            {people.data && people.data.rows.length > 0 && (
              <Command.Group heading="People" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
                {people.data.rows.map((u) => (
                  <Command.Item key={u.id} value={`person ${u.name} ${u.email}`} onSelect={() => go(`/employees/${u.id}`)} className={item}>
                    <UserRound />
                    <span className="truncate">{u.name}</span>
                    <span className="ml-auto truncate text-xs text-muted-foreground">{u.department?.name}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            {navFor(me?.role).map((g) => (
              <Command.Group key={g.label} heading={g.label} className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
                {g.items.map((i) => (
                  <Command.Item key={i.href} value={`${i.label} ${g.label}`} onSelect={() => go(i.href)} className={item}>
                    <i.icon />
                    {i.label}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
            <Command.Group heading="Me" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
              <Command.Item value="profile account password" onSelect={() => go('/profile')} className={item}>
                <UserRound /> Profile & password
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
