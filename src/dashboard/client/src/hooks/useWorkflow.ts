import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

type WorkflowState = {
  ok: boolean;
  repo: string | null;
  branch: string | null;
  prs: unknown[];
  runs: unknown[];
  error: string | null;
};

async function fetchWorkflow(): Promise<WorkflowState> {
  const r = await api('/github/workflow');
  const d = await r.json() as Partial<WorkflowState>;
  return {
    ok: d.ok ?? false,
    repo: d.repo ?? null,
    branch: d.branch ?? null,
    prs: d.prs ?? [],
    runs: d.runs ?? [],
    error: d.error ?? null,
  };
}

export function useWorkflow(activePanel: string) {
  const query = useQuery({
    queryKey: ['workflow'],
    queryFn: fetchWorkflow,
    enabled: activePanel === 'workflow',
  });

  const data = query.data ?? {
    ok: false,
    repo: null,
    branch: null,
    prs: [],
    runs: [],
    error: query.error?.message ?? null,
  };

  return {
    ...data,
    loading: query.isPending,
    refresh: query.refetch,
  };
}
