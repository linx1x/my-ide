import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchStatus } from '../../api';
import { queryKeys } from '../../queryKeys';

const STATUS_QUERY_KEY = queryKeys.status;

export function useStatusQuery() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: STATUS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['files', 'changed'] });
      queryClient.invalidateQueries({ queryKey: ['git', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['git', 'log'] });
      queryClient.invalidateQueries({ queryKey: ['git', 'branches'] });
    };
    window.addEventListener('dashboard:refresh-git', handler);
    return () => window.removeEventListener('dashboard:refresh-git', handler);
  }, [queryClient]);

  return useQuery({
    queryKey: queryKeys.status,
    queryFn: fetchStatus,
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
}

export { STATUS_QUERY_KEY };
