import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useStatusQuery } from './queries/useStatusQuery';
import { api } from '../api';

type GitStatusData = {
  gitPanelStatusPollMs?: number;
  codebaseRoot?: string | null;
};

async function fetchChangedFiles(): Promise<string[]> {
  const r = await api('/files/changed');
  const data = await r.json() as { files?: string[] };
  return data.files ?? [];
}

export function useGitStatus(activePanel: string) {
  const queryClient = useQueryClient();
  const { data: statusData } = useStatusQuery();
  const status = statusData as GitStatusData | undefined;

  const changedFilesQuery = useQuery({
    queryKey: ['files', 'changed'],
    queryFn: fetchChangedFiles,
    enabled: activePanel === 'git',
  });

  useEffect(() => {
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['files', 'changed'] });
    };
    window.addEventListener('dashboard:refresh-git', handler);
    return () => window.removeEventListener('dashboard:refresh-git', handler);
  }, [queryClient]);

  const refresh = (): void => {
    queryClient.invalidateQueries({ queryKey: ['status'] });
    queryClient.invalidateQueries({ queryKey: ['files', 'changed'] });
  };

  return {
    changedFiles: changedFilesQuery.data ?? [],
    loading: changedFilesQuery.isPending,
    error: changedFilesQuery.error?.message ?? null,
    loadChangedFiles: changedFilesQuery.refetch,
    refresh,
    gitPanelStatusPollMs: status?.gitPanelStatusPollMs ?? 4000,
    codebaseRoot: status?.codebaseRoot ?? null,
  };
}
