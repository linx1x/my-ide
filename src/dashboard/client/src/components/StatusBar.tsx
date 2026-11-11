import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEditor } from '../context/EditorContext';
import { useStatus } from '../hooks/useStatus';
import { useConnection } from '../hooks/useConnection';
import { usePreview } from '../hooks/usePreview';
import { getLanguageLabel } from '../utils/editorUtils';
import { ProjectSwitcher } from './ProjectSwitcher';
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import { queryKeys } from '../queryKeys';

async function fetchGitBranches() {
  const r = await api('/git/branches');
  if (!r.ok) {return { local: [], remote: [], current: null };}
  return r.json();
}

type BranchItem = { name: string; isCurrent?: boolean };
type BranchesResponse = { local: BranchItem[]; remote: BranchItem[]; current: string | null };

function StatusBarBranchDropdown({ currentBranch, codebaseRoot, onBranchChange }: { currentBranch?: string | null; codebaseRoot?: string | null; onBranchChange?: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const menuRef = useRef<HTMLDivElement | null>(null);

  const branchesQuery = useQuery({
    queryKey: queryKeys.git.branches(codebaseRoot ?? ''),
    queryFn: fetchGitBranches,
    enabled: open,
  });
  const branches = (branchesQuery.data as BranchesResponse | undefined) ?? { local: [], remote: [], current: null };

  const invalidateGit = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['git', 'branches'] });
    queryClient.invalidateQueries({ queryKey: ['git', 'status'] });
    queryClient.invalidateQueries({ queryKey: ['git', 'log'] });
    queryClient.invalidateQueries({ queryKey: queryKeys.files.changed });
    queryClient.invalidateQueries({ queryKey: queryKeys.status });
    onBranchChange?.();
  }, [queryClient, onBranchChange]);

  const checkoutMutation = useMutation<any, Error, string>({
    mutationFn: async (branch) => {
      const r = await api('/git/checkout', { method: 'POST', body: { branch } });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || 'Checkout failed');
      }
    },
    onSuccess: (_, name) => {
      setOpen(false);
      invalidateGit();
      toast(`Switched to ${name}`, 'success');
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const createBranchMutation = useMutation<any, Error, string>({
    mutationFn: async (name) => {
      const r = await api('/git/create-branch', { method: 'POST', body: { name } });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || 'Create branch failed');
      }
    },
    onSuccess: (_, name) => {
      setNewBranchName('');
      setOpen(false);
      invalidateGit();
      toast(`Created branch ${name}`, 'success');
    },
    onError: (err) => toast(err.message, 'error'),
  });

  useEffect(() => {
    if (!open) {return;}
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {setOpen(false);}
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const doCheckout = (name: string) => checkoutMutation.mutate(name);
  const doCreateBranch = () => {
    if (!newBranchName.trim()) {return;}
    createBranchMutation.mutate(newBranchName.trim());
  };

  const gitPending = checkoutMutation.isPending || createBranchMutation.isPending;

  return (
    <div className="status-bar-branch-wrap" ref={menuRef}>
      <button
        type="button"
        id="status-branch"
        className="status-bar-branch-trigger"
        onClick={() => setOpen((v) => !v)}
        title={currentBranch ? `Branch: ${currentBranch}` : 'Switch or create branch'}
      >
        <span className="status-bar-branch-icon" aria-hidden>⎇</span>
        <span className="status-bar-branch-name">{currentBranch || '—'}</span>
        <span className="status-bar-branch-caret" aria-hidden>▾</span>
      </button>
      {open && (
        <div className="status-bar-branch-menu git-branch-menu">
          <div className="git-branch-menu-label">New branch</div>
          <div className="git-branch-new-row">
            <input
              className="git-branch-input"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              placeholder="branch-name"
              onKeyDown={(e) => e.key === 'Enter' && doCreateBranch()}
              autoFocus
              disabled={gitPending}
            />
            <button type="button" className="git-icon-btn add" onClick={doCreateBranch} disabled={gitPending}>
              {createBranchMutation.isPending ? '…' : '+'}
            </button>
          </div>
          {branches.local?.length > 0 && (
            <>
              <div className="git-branch-menu-label">Local</div>
              {branches.local.map((b: BranchItem) => (
                <button
                  key={b.name}
                  type="button"
                  className={`git-branch-item${b.isCurrent ? ' current' : ''}`}
                  onClick={() => !b.isCurrent && doCheckout(b.name)}
                  disabled={gitPending}
                >
                  {b.isCurrent ? '✓ ' : '  '}{b.name}
                </button>
              ))}
            </>
          )}
          {branches.remote?.length > 0 && (
            <>
              <div className="git-branch-menu-label">Remote</div>
              {branches.remote.map((b: BranchItem) => (
                <button
                  key={b.name}
                  type="button"
                  className="git-branch-item remote"
                  onClick={() => doCheckout(b.name)}
                  disabled={gitPending}
                >
                  {b.name}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function StatusBar() {
  const { branch, workdir, refresh } = useStatus();
  const { online, reconnecting } = useConnection();
  const { previewUrl, loading: previewLoading, statusMsg: previewStatusMsg } = usePreview();
  const { editorPath, cursorPosition, viewMode, activeTab } = useEditor();
  const cursorPos = cursorPosition as { row?: number; column?: number } | null;

  const lang =
    viewMode === 'editor' && editorPath && activeTab
      ? getLanguageLabel(editorPath)
      : null;
  const cursorStr =
    viewMode === 'editor' && cursorPos
      ? `Ln ${cursorPos.row ?? 1}, Col ${cursorPos.column ?? 1}`
      : '';

  const workdirShort = workdir
    ? workdir.split(/[/\\]/).pop() || workdir
    : '—';

  return (
    <footer className="status-bar">
      <div className="status-left">
        <ProjectSwitcher onProjectChange={refresh} />
        <StatusBarBranchDropdown
          currentBranch={branch ?? null}
          codebaseRoot={workdir ?? null}
          onBranchChange={() => {
            void refresh();
          }}
        />
        <span id="status-workdir" className="status-item" title={workdir}>
          {workdirShort}
        </span>
      </div>
      <div className="status-right">
        {(previewLoading || previewStatusMsg || previewUrl) ? (
          <span className="status-item status-preview" title={previewStatusMsg || 'Preview'}>
            {previewLoading || previewStatusMsg ? (
              previewStatusMsg || 'Preview…'
            ) : previewUrl ? (
              <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="status-preview-link">
                Preview
              </a>
            ) : null}
          </span>
        ) : null}
        {!online || reconnecting ? (
          <span className="status-item status-connecting">
            Reconnecting...
          </span>
        ) : null}
        <span id="status-cursor" className="status-item">
          {cursorStr}
        </span>
        <span id="status-lang" className="status-item">
          {lang || ''}
        </span>
        <span id="status-encoding" className="status-item">
          UTF-8
        </span>
      </div>
    </footer>
  );
}
