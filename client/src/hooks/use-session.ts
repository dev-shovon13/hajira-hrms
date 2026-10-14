'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type { Role, SessionUser } from '@hajira/shared';
import { get, send } from '@/lib/api';

export function useSession() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => get<SessionUser>('/auth/me'),
    staleTime: 5 * 60_000,
  });
}

export function useRole() {
  const { data } = useSession();
  const role: Role | undefined = data?.role;
  return {
    role,
    isHR: role === 'HR' || role === 'ADMIN',
    isAdmin: role === 'ADMIN',
    isApprover: role === 'MANAGER' || role === 'HR' || role === 'ADMIN',
    isManager: role === 'MANAGER',
  };
}

export function useSignOut() {
  const qc = useQueryClient();
  const router = useRouter();
  return async () => {
    try {
      await send('post', '/auth/logout');
    } finally {
      qc.clear();
      router.replace('/login');
      router.refresh();
    }
  };
}
