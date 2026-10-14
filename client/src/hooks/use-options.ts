'use client';

import { useQuery } from '@tanstack/react-query';
import type { LeaveTypeDto, Role, SettingsDto, ShiftDto } from '@hajira/shared';
import { get } from '@/lib/api';

/** Reference data for selects. Long staleTime: it rarely changes and the API caches it too. */

export const useDepartments = () =>
  useQuery({
    queryKey: ['departments', 'options'],
    queryFn: () => get<{ id: string; name: string; code: string }[]>('/departments/options'),
    staleTime: 10 * 60_000,
  });

export const useDesignations = (departmentId?: string) =>
  useQuery({
    queryKey: ['designations', 'options', departmentId ?? 'all'],
    queryFn: () =>
      get<{ id: string; title: string; departmentId: string | null }[]>('/designations/options', {
        params: departmentId ? { departmentId } : undefined,
      }),
    staleTime: 10 * 60_000,
  });

export const useShifts = () => useQuery({ queryKey: ['shifts'], queryFn: () => get<ShiftDto[]>('/shifts'), staleTime: 5 * 60_000 });

export const useLeaveTypes = (all = false) =>
  useQuery({
    queryKey: ['leave-types', all ? 'all' : 'active'],
    queryFn: () => get<LeaveTypeDto[]>('/leave-types', { params: all ? { all: 'true' } : undefined }),
    staleTime: 10 * 60_000,
  });

export const usePeople = (roles?: Role[], enabled = true) =>
  useQuery({
    queryKey: ['users', 'options', roles?.join(',') ?? 'all'],
    queryFn: () =>
      get<{ id: string; name: string; role: Role; avatarUrl: string | null; departmentId: string | null; employeeCode: string | null }[]>(
        '/users/options',
        { params: roles ? { roles: roles.join(',') } : undefined },
      ),
    staleTime: 5 * 60_000,
    enabled,
  });

export const useSettings = () => useQuery({ queryKey: ['settings'], queryFn: () => get<SettingsDto>('/settings'), staleTime: 5 * 60_000 });
