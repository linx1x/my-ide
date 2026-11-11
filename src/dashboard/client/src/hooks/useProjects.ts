import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useStatusQuery } from './queries/useStatusQuery';
import { api } from '../api';
import { invalidateDashboardGitQueries } from '../git/invalidateGitQueries';

const STATUS_QUERY_KEY = ['status'];

type ProjectEntry = {
  id: string;
  name: string;
  path?: string;
  gitUrl?: string;
};

type StatusProjectsData = {
  projects?: ProjectEntry[];
  activeProjectId?: string | null;
};

type AddProjectInput = {
  path?: string;
  gitUrl?: string;
};

type RemoveProjectInput = {
  id: string;
  deleteFiles?: boolean;
};

export function useProjects() {
  const queryClient = useQueryClient();
  const { data, isPending, error, refetch } = useStatusQuery();
  const status = data as StatusProjectsData | undefined;
  const projects = status?.projects ?? [];
  const activeProjectId = status?.activeProjectId ?? null;

  const addProject = useMutation<unknown, Error, AddProjectInput>({
    mutationFn: async ({ path, gitUrl }) => {
      const r = await api('/projects', {
        method: 'POST',
        body: { path, gitUrl: gitUrl || undefined },
      });
      const res = await r.json().catch(() => ({}));
      if (!r.ok) {throw new Error(res.error || 'Failed to add project');}
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STATUS_QUERY_KEY });
      invalidateDashboardGitQueries(queryClient);
    },
  });

  const removeProject = useMutation<void, Error, RemoveProjectInput>({
    mutationFn: async ({ id, deleteFiles = false }) => {
      const r = await api(`/projects/${id}${deleteFiles ? '?deleteFiles=1' : ''}`, {
        method: 'DELETE',
      });
      const res = await r.json().catch(() => ({}));
      if (!r.ok) {throw new Error(res.error || 'Failed to remove project');}
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STATUS_QUERY_KEY });
      invalidateDashboardGitQueries(queryClient);
    },
  });

  const setActive = useMutation<unknown, Error, string>({
    mutationFn: async (projectId) => {
      const r = await api('/projects/active', {
        method: 'PUT',
        body: { projectId },
      });
      const res = await r.json().catch(() => ({}));
      if (!r.ok) {throw new Error(res.error || 'Failed to set active project');}
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STATUS_QUERY_KEY });
      invalidateDashboardGitQueries(queryClient);
    },
  });

  return {
    projects,
    activeProjectId,
    loading: isPending,
    error: error?.message ?? null,
    refresh: refetch,
    addProject: (opts: AddProjectInput) => addProject.mutateAsync(opts),
    removeProject: (id: string, deleteFiles = false) => removeProject.mutateAsync({ id, deleteFiles }),
    setActive: (projectId: string) => setActive.mutateAsync(projectId),
  };
}
