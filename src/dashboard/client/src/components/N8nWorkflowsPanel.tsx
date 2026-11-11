import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { queryKeys } from '../queryKeys';
import { Skeleton, SkeletonGroup } from './Skeleton';

async function fetchWorkflows() {
  const r = await api('/n8n/workflows');
  const data = (await r.json()) as { workflows?: unknown[]; error?: string; hint?: string };
  if (!r.ok) {
    const parts = [data.error || 'Failed to load workflows'];
    if (data.hint) {parts.push(data.hint);}
    throw new Error(parts.join('\n\n'));
  }
  return data.workflows ?? [];
}

type N8nWorkflow = { id: string; name?: string | null };

async function exportWorkflow(id: string) {
  const r = await api(`/n8n/workflows/${encodeURIComponent(id)}/export`);
  const data = await r.json();
  if (!r.ok) {throw new Error(data.error || 'Export failed');}
  return data.workflow;
}

export function N8nWorkflowsPanel() {
  const queryClient = useQueryClient();
  const [importJson, setImportJson] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const workflowsQuery = useQuery({
    queryKey: queryKeys.n8n.workflows(),
    queryFn: fetchWorkflows,
    retry: false,
  });

  const workflows = workflowsQuery.data ?? [];
  const loading = workflowsQuery.isPending;
  const error = workflowsQuery.error?.message ?? null;

  const importMutation = useMutation<any, Error, Record<string, unknown>>({
    mutationFn: async (workflow) => {
      const r = await api('/n8n/workflows/import', {
        method: 'POST',
        body: { workflow },
      });
      const data = await r.json();
      if (!r.ok) {throw new Error(data.error || 'Import failed');}
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.n8n.workflows() });
      setImportOpen(false);
      setImportJson('');
      setImportError(null);
    },
    onError: (err) => {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    },
  });

  const handleExport = useCallback(async (id: string, name?: string | null) => {
    try {
      const workflow = await exportWorkflow(id);
      const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (name || 'workflow').replace(/[^a-z0-9-_]/gi, '-') + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Export failed');
    }
  }, []);

  const handleImportSubmit = useCallback(() => {
    setImportError(null);
    let workflow: Record<string, unknown>;
    try {
      workflow = JSON.parse(importJson.trim());
    } catch {
      setImportError('Invalid JSON');
      return;
    }
    if (!workflow || typeof workflow !== 'object') {
      setImportError('Workflow must be a JSON object');
      return;
    }
    importMutation.mutate(workflow);
  }, [importJson, importMutation]);

  return (
    <div className="n8n-workflows-panel">
      <div className="sidebar-header">
        <span className="sidebar-title">N8N WORKFLOWS</span>
      </div>
      <div className="sidebar-body">
        {error && (
          <div className="n8n-workflows-error">
            {error}
          </div>
        )}
        {loading ? (
          <div style={{ padding: '8px 12px' }} aria-busy="true">
            <SkeletonGroup>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <Skeleton variant="text" style={{ flex: 1, maxWidth: '70%' }} />
                  <Skeleton variant="rect" width={52} height={24} />
                </div>
              ))}
            </SkeletonGroup>
          </div>
        ) : (
          <>
            <div className="n8n-workflows-actions">
              <button
                type="button"
                className="n8n-workflows-btn"
                onClick={() => { setImportOpen(true); setImportError(null); }}
              >
                Import workflow
              </button>
            </div>
            {importOpen && (
              <div className="n8n-workflows-import-box">
                <textarea
                  className="n8n-workflows-import-textarea"
                  placeholder="Paste workflow JSON…"
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  rows={6}
                />
                {importError && <p className="n8n-workflows-import-error">{importError}</p>}
                <div className="n8n-workflows-import-actions">
                  <button type="button" className="n8n-workflows-btn secondary" onClick={() => { setImportOpen(false); setImportJson(''); setImportError(null); }}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="n8n-workflows-btn"
                    onClick={handleImportSubmit}
                    disabled={!importJson.trim() || importMutation.isPending}
                  >
                    {importMutation.isPending ? 'Importing…' : 'Import'}
                  </button>
                </div>
              </div>
            )}
            <ul className="n8n-workflows-list">
              {workflows.length === 0 && !loading && (
                <li className="n8n-workflows-empty">No workflows. Import one or create in n8n.</li>
              )}
              {(workflows as N8nWorkflow[]).map((w) => (
                <li key={w.id} className="n8n-workflows-item">
                  <span className="n8n-workflows-item-name" title={w.name ?? undefined}>{w.name ?? w.id}</span>
                  <button
                    type="button"
                    className="n8n-workflows-item-export"
                    onClick={() => handleExport(w.id, w.name)}
                    title="Export JSON"
                  >
                    Export
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
