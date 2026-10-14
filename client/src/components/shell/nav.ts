import {
  BadgeCheck,
  Building2,
  CalendarCheck2,
  CalendarHeart,
  CalendarRange,
  Clock3,
  Contact,
  FileSpreadsheet,
  Inbox,
  Layers,
  LayoutDashboard,
  ScrollText,
  Settings2,
  TreePalm,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@hajira/shared';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[];
  badge?: 'approvals' | 'accounts';
}

export interface NavGroup {
  label: string;
  roles?: Role[];
  items: NavItem[];
}

const APPROVERS: Role[] = ['MANAGER', 'HR', 'ADMIN'];
const HR: Role[] = ['HR', 'ADMIN'];

export const NAV: NavGroup[] = [
  {
    label: 'My work',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/attendance', label: 'My attendance', icon: CalendarCheck2 },
      { href: '/leave', label: 'Leave', icon: TreePalm },
      { href: '/calendar', label: 'Team calendar', icon: CalendarRange },
      { href: '/holidays', label: 'Holidays', icon: CalendarHeart },
    ],
  },
  {
    label: 'Team',
    roles: APPROVERS,
    items: [
      { href: '/approvals', label: 'Approvals', icon: Inbox, badge: 'approvals' },
      { href: '/team', label: 'Team attendance', icon: Users },
      { href: '/reports', label: 'Reports', icon: FileSpreadsheet },
    ],
  },
  {
    label: 'Company',
    roles: HR,
    items: [
      { href: '/employees', label: 'Employees', icon: Contact, badge: 'accounts' },
      { href: '/admin/departments', label: 'Departments', icon: Building2 },
      { href: '/admin/designations', label: 'Designations', icon: BadgeCheck },
      { href: '/admin/shifts', label: 'Shifts', icon: Clock3 },
      { href: '/admin/leave-types', label: 'Leave types', icon: Layers },
      { href: '/admin/settings', label: 'Settings', icon: Settings2 },
      { href: '/audit-logs', label: 'Audit log', icon: ScrollText },
    ],
  },
];

export function navFor(role: Role | undefined) {
  if (!role) return [];
  return NAV.filter((g) => !g.roles || g.roles.includes(role)).map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.roles || i.roles.includes(role)),
  }));
}

export const isActive = (pathname: string, href: string) =>
  pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));
