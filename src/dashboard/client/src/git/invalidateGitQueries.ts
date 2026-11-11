import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

export const DASHBOARD_REFRESH_GIT_EVENT = 'dashboard:refresh-git';

/** Invalidate all dashboard queries that back the Git panel (changes + graph + branch picker). */
export function invalidateDashboardGitQueries(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ['git', 'branches'] });
  queryClient.invalidateQueries({ queryKey: ['git', 'status'] });
  queryClient.invalidateQueries({ queryKey: ['git', 'log'] });
  queryClient.invalidateQueries({ queryKey: ['git', 'file-diff'] });
  queryClient.invalidateQueries({ queryKey: ['git', 'show'] });
  queryClient.invalidateQueries({ queryKey: queryKeys.files.changed });
  queryClient.invalidateQueries({ queryKey: queryKeys.status });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DASHBOARD_REFRESH_GIT_EVENT));
  }
}
