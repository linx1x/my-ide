import { useState, useCallback, useEffect } from 'react';
import { useProjects } from './useProjects';
import { api } from '../api';

const API = '/api';

type PreviewPayload = { previewPort?: number | null; previewUrl?: string | null };

function applyReadyFromPayload(
  setPreviewUrl: (url: string | null) => void,
  setLoading: (value: boolean) => void,
  setStatusMsg: (value: string | null) => void,
  payload: PreviewPayload | null | undefined,
): void {
  const port = payload?.previewPort;
  const url = payload?.previewUrl;
  if (port !== null && Number.isSafeInteger(port)) {
    setPreviewUrl(`http://localhost:${port}`);
  } else if (url) {
    setPreviewUrl(url.endsWith('/') ? url : `${url}/`);
  } else {
    return;
  }
  setLoading(false);
  setStatusMsg(null);
}

export function usePreview() {
  const { projects, activeProjectId } = useProjects();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeProject = projects.find((p: { id: string; path?: string }) => p.id === activeProjectId);
  const hasProject = !!activeProject?.path;

  // Subscribe to preview events when we have previewId but no URL yet (async provisioning).
  useEffect(() => {
    if (!previewId || previewUrl || !loading) {return;}
    let closed = false;

    const applyReady = (payload: PreviewPayload | null | undefined) => {
      if (closed) {return;}
      applyReadyFromPayload(setPreviewUrl, setLoading, setStatusMsg, payload);
      setStatus('ready');
    };

    const es = new EventSource(
      `${API}/previews/events?previewId=${encodeURIComponent(previewId)}`,
    );
    es.onmessage = (msg) => {
      if (closed) {return;}
      try {
        const event = JSON.parse(msg.data);
        if (event.type === 'status' || event.type === 'log') {
          const label = event.payload?.status;
          if (label === 'materializing') {setStatusMsg('Copying project…');}
          else if (label === 'installing') {setStatusMsg('Installing dependencies…');}
          else if (label === 'launching') {setStatusMsg('Starting dev server…');}
        }
        if (event.type === 'ready') {
          applyReady(event.payload);
          es.close();
        }
        if (event.type === 'error') {
          setError(event.payload?.error || 'Preview failed');
          setLoading(false);
          setStatusMsg(null);
          es.close();
        }
      } catch {
        // ignore malformed stream payloads
      }
    };
    es.onerror = () => {
      if (closed) {return;}
      setError('Lost connection to preview events');
      setLoading(false);
      setStatusMsg(null);
      es.close();
    };

    // Fallback: poll once in case ready before SSE connected
    api(`/previews/${previewId}`, { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (closed || !data) {return;}
        if (data.status === 'ready') {
          applyReady({ previewPort: data.previewPort, previewUrl: data.previewUrl });
          es.close();
        } else if (data.status === 'failed') {
          setError(data.error || 'Preview failed');
          setLoading(false);
          setStatusMsg(null);
          es.close();
        }
      })
      .catch(() => {
        // ignore fallback polling errors
      });

    return () => {
      closed = true;
      es.close();
    };
  }, [previewId, previewUrl, loading]);

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ projectPath?: string; projectId?: string | null }>;
      const detail = custom.detail ?? {};
      const projectPath = detail.projectPath;
      const projectId = detail.projectId;
      if (!projectPath) {return;}
      setError(null);
      setLoading(true);
      setStatusMsg('Provisioning…');
      api('/previews', {
        method: 'POST',
        body: {
          source: {
            type: 'project-path',
            projectPath,
            projectId: projectId ?? undefined,
          },
        },
      })
        .then((r) => {
          if (!r.ok) {return r.json().then((d) => Promise.reject(new Error(d.error || 'Failed to start preview')));}
          return r.json();
        })
        .then((data) => {
          const id = data.previewId ?? null;
          const base = data.previewUrl ?? (id ? `/api/previews/${id}/` : '');
          setPreviewId(id);
          setPreviewUrl(base ? (base.endsWith('/') ? base : `${base}/`) : null);
          setStatus(data.status ?? 'ready');
          setError(null);
          if (base) {setLoading(false);} else {setStatusMsg('Provisioning…');}
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'Failed to start preview';
          setError(message);
          setPreviewUrl(null);
          setPreviewId(null);
          setLoading(false);
          setStatusMsg(null);
        });
    };
    window.addEventListener('dashboard:start-preview', handler);
    return () => window.removeEventListener('dashboard:start-preview', handler);
  }, []);

  const start = useCallback(() => {
    setError(null);
    setLoading(true);
    setStatusMsg('Provisioning…');
    if (!activeProject?.path) {
      setError('No active project');
      setLoading(false);
      setStatusMsg(null);
      return;
    }
    api('/previews', {
      method: 'POST',
      body: {
        source: {
          type: 'project-path',
          projectPath: activeProject.path,
          projectId: activeProjectId ?? undefined,
        },
      },
    })
      .then((r) => {
        if (!r.ok) {return r.json().then((d) => Promise.reject(new Error(d.error || 'Failed to start preview')));}
        return r.json();
      })
      .then((data) => {
        const id = data.previewId ?? null;
        const base = data.previewUrl ?? (id ? `/api/previews/${id}/` : '');
        setPreviewId(id);
        setPreviewUrl(base ? (base.endsWith('/') ? base : `${base}/`) : null);
        setStatus(data.status ?? 'ready');
        if (base) {
          setLoading(false);
          setStatusMsg(null);
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Failed to start preview';
        setError(message);
        setPreviewUrl(null);
        setPreviewId(null);
        setLoading(false);
        setStatusMsg(null);
      });
  }, [activeProjectId, activeProject?.path]);

  const stop = useCallback(() => {
    if (!previewId) {
      setPreviewUrl(null);
      setStatus(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    api(`/previews/${previewId}/stop`, { method: 'POST' })
      .then(() => {
        setPreviewUrl(null);
        setPreviewId(null);
        setStatus(null);
        setError(null);
      })
      .catch(() => {
        setPreviewUrl(null);
        setPreviewId(null);
      })
      .finally(() => setLoading(false));
  }, [previewId]);

  return { previewUrl, previewId, status, statusMsg, loading, error, hasProject, start, stop };
}
