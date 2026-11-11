import { useState, useRef, useEffect } from 'react';
import type { MouseEvent as ReactMouseEvent, FormEvent } from 'react';
import { useProjects } from '../hooks/useProjects';
import { useStatus } from '../hooks/useStatus';

type Project = { id: string; name: string; path?: string; gitUrl?: string };
type ProjectSwitcherProps = { onProjectChange?: () => void };

export function ProjectSwitcher({ onProjectChange }: ProjectSwitcherProps) {
  const { projects, activeProjectId, addProject, removeProject, setActive, refresh: _refresh } =
    useProjects() as any;
  const { refresh: refreshStatus } = useStatus();
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [gitUrl, setGitUrl] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [mode, setMode] = useState('git');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const activeProject = (projects as Project[]).find((p) => p.id === activeProjectId);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {document.addEventListener('click', handleClickOutside);}
    return () => document.removeEventListener('click', handleClickOutside);
  }, [open]);

  const handleSelectProject = async (id: string) => {
    if (id === activeProjectId) {
      setOpen(false);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await setActive(id);
      refreshStatus();
      window.dispatchEvent(new CustomEvent('dashboard:refresh-tree'));
      window.dispatchEvent(new CustomEvent('dashboard:project-changed'));
      onProjectChange?.();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch');
    } finally {
      setBusy(false);
    }
  };

  const handleAddProject = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'git') {
        if (!gitUrl.trim()) {return setError('Enter a Git URL');}
        await addProject({ gitUrl: gitUrl.trim() });
      } else {
        if (!localPath.trim()) {return setError('Enter a path');}
        await addProject({ path: localPath.trim() });
      }
      refreshStatus();
      setGitUrl('');
      setLocalPath('');
      setModalOpen(false);
      window.dispatchEvent(new CustomEvent('dashboard:refresh-tree'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add project');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveProject = async (e: ReactMouseEvent, id: string) => {
    e.stopPropagation();
    if (id === 'default') {return;}
    if (!window.confirm('Remove this project from the list?')) {return;}
    setBusy(true);
    setError('');
    try {
      await removeProject(id);
      refreshStatus();
      window.dispatchEvent(new CustomEvent('dashboard:refresh-tree'));
      window.dispatchEvent(new CustomEvent('dashboard:project-changed'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="project-switcher" ref={dropdownRef}>
      <button
        type="button"
        className="project-switcher-trigger"
        onClick={() => setOpen(!open)}
        title={activeProject?.path || 'Select project'}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>
        <span className="project-switcher-label">{activeProject?.name || 'Select project'}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="project-switcher-dropdown">
          {error && <div className="project-switcher-error">{error}</div>}
          {(projects as Project[]).map((p) => (
            <div
              key={p.id}
              className={`project-switcher-item ${p.id === activeProjectId ? 'active' : ''}`}
            >
              <button
                type="button"
                className="project-switcher-item-btn"
                onClick={() => handleSelectProject(p.id)}
                disabled={busy}
              >
                <span className="project-name">{p.name}</span>
                {p.gitUrl && (
                  <span className="project-hint" title={p.gitUrl}>
                    (cloned)
                  </span>
                )}
              </button>
              {p.id !== 'default' && (
                <button
                  type="button"
                  className="project-switcher-remove"
                  onClick={(e) => handleRemoveProject(e, p.id)}
                  disabled={busy}
                  title="Remove from list"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <div className="project-switcher-divider" />
          <button
            type="button"
            className="project-switcher-add"
            onClick={() => {
              setModalOpen(true);
              setError('');
            }}
          >
            + Add project (Git URL or path)
          </button>
        </div>
      )}
      {modalOpen && (
        <div className="project-modal-overlay" onClick={() => !busy && setModalOpen(false)}>
          <div
            className="project-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Add project</h3>
            <form onSubmit={handleAddProject}>
              <div className="project-modal-tabs">
                <button
                  type="button"
                  className={mode === 'git' ? 'active' : ''}
                  onClick={() => setMode('git')}
                >
                  Clone from Git (HTTPS)
                </button>
                <button
                  type="button"
                  className={mode === 'path' ? 'active' : ''}
                  onClick={() => setMode('path')}
                >
                  Existing folder
                </button>
              </div>
              {mode === 'git' ? (
                <>
                  <label>Git URL</label>
                  <input
                    type="url"
                    value={gitUrl}
                    onChange={(e) => setGitUrl(e.target.value)}
                    placeholder="https://github.com/user/repo.git"
                    autoFocus
                  />
                  <p className="project-modal-hint">
                    Clones into workspaces/ (bridge-data/workspaces locally, /data/workspaces in Docker)
                  </p>
                </>
              ) : (
                <>
                  <label>Absolute path</label>
                  <input
                    type="text"
                    value={localPath}
                    onChange={(e) => setLocalPath(e.target.value)}
                    placeholder="C:\Projects\my-app or /home/user/projects/my-app"
                    autoFocus
                  />
                </>
              )}
              {error && <p className="project-modal-error">{error}</p>}
              <div className="project-modal-actions">
                <button type="button" onClick={() => setModalOpen(false)} disabled={busy}>
                  Cancel
                </button>
                <button type="submit" disabled={busy}>
                  {busy ? '...' : mode === 'git' ? 'Clone & Add' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
