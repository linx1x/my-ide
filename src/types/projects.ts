export type ProjectRecord = {
  id: string;
  path: string;
  name: string;
  gitUrl: string | null;
};

export type ProjectsStore = {
  projects: ProjectRecord[];
  activeProjectId: string | null;
};

export type AddProjectOptions = {
  path?: string;
  gitUrl?: string;
};
