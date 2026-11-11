import { useStatusQuery } from './queries/useStatusQuery';

type StatusData = {
  branch?: string | null;
  codebaseRoot?: string | null;
  workDir?: string | null;
  activeProjectName?: string | null;
  activeProjectId?: string | null;
};

export function useStatus() {
  const { data, error, refetch, isPending } = useStatusQuery();
  const status = data as StatusData | undefined;
  const branch = status?.branch ?? undefined;
  const workdir = status?.codebaseRoot ?? status?.workDir ?? undefined;
  return {
    branch,
    workdir,
    activeProjectName: status?.activeProjectName ?? null,
    activeProjectId: status?.activeProjectId ?? null,
    error: error?.message ?? null,
    refresh: refetch,
    isPending,
  };
}
