'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useRole } from './use-session';

/** Badge counts for the sidebar: pending approvals and pending accounts. */
export function useNavCounts() {
  const { isApprover, isHR } = useRole();
  const approvals = useQuery({
    queryKey: ['counts', 'approvals'],
    enabled: isApprover,
    refetchInterval: 60_000,
    queryFn: async () => {
      const [leave, reg] = await Promise.all([
        api.get('/leave/requests', { params: { scope: 'approvals', limit: 1 } }),
        api.get('/regularizations', { params: { scope: 'approvals', limit: 1 } }),
      ]);
      return (leave.data.meta?.total ?? 0) + (reg.data.meta?.total ?? 0);
    },
  });
  const accounts = useQuery({
    queryKey: ['counts', 'accounts'],
    enabled: isHR,
    refetchInterval: 120_000,
    queryFn: async () => {
      const res = await api.get('/users', { params: { status: 'PENDING', limit: 1 } });
      return res.data.meta?.total ?? 0;
    },
  });
  return { approvals: approvals.data ?? 0, accounts: accounts.data ?? 0 };
}
