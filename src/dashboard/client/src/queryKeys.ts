/**
 * Central query keys for TanStack Query. Use these for queryKey and invalidateQueries
 * so keys stay consistent across the app.
 *
 * Invalidation map:
 * - Auth logout -> status
 * - File write -> files.tree(), file(path)
 */
export const queryKeys = {
  status: ['status'],
  auth: {
    status: ['auth', 'status'],
  },
  files: {
    tree: (showHidden?: boolean) => (showHidden === undefined ? ['files', 'tree'] : ['files', 'tree', showHidden]),
    file: (path: string) => ['file', path],
    changed: ['files', 'changed'],
  },
  git: {
    /** Include resolved repo root so switching projects does not reuse another repo's cache. */
    status: (codebaseRoot: string | null | undefined) => ['git', 'status', codebaseRoot ?? ''],
    fileDiff: (path: string, staged: boolean, codebaseRoot: string | null | undefined) =>
      ['git', 'file-diff', codebaseRoot ?? '', path, staged],
    log: (codebaseRoot: string | null | undefined) => ['git', 'log', codebaseRoot ?? ''],
    show: (hash: string, codebaseRoot: string | null | undefined) => ['git', 'show', codebaseRoot ?? '', hash],
    branches: (codebaseRoot: string | null | undefined) => ['git', 'branches', codebaseRoot ?? ''],
  },
  search: (query: string, matchCase: boolean, useRegex: boolean) => ['search', query, matchCase, useRegex],
  db: {
    tables: (connectionId: string) => ['db', 'tables', connectionId],
    schema: (connectionId: string, table: string | null) => ['db', 'schema', connectionId, table],
  },
  n8n: {
    status: ['n8n', 'status'],
    workflows: () => ['n8n', 'workflows'],
  },
  workflow: ['workflow'],
  previews: {
    status: (previewId: string) => ['previews', previewId],
  },
};
