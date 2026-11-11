import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { MutableRefObject, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { invalidateDashboardGitQueries } from '../git/invalidateGitQueries';
import { queryKeys } from '../queryKeys';

type ToastFn = (message: string, level?: 'success' | 'error') => void;
let toastFn: ToastFn | null = null;
export function setEditorToast(fn: ToastFn | null): void {
  toastFn = fn;
}

const RECENT_FILES_KEY = 'dashboard_recent_files';
const RECENT_FILES_MAX = 15;

function loadRecentFiles(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_FILES_KEY);
    if (raw) {return JSON.parse(raw) as string[];}
  } catch {}
  return [];
}

function saveRecentFiles(files: string[]): void {
  try {
    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(files));
  } catch {}
}

type BaseTab = {
  id: string;
  type: string;
  name?: string;
  path?: string;
  url?: string;
  webId?: string;
  gitPath?: string;
  gitStaged?: boolean;
  content?: string;
  originalContent?: string;
  [key: string]: unknown;
};

function isNonFileEditorTab(tab: BaseTab | null | undefined): boolean {
  return (
    tab?.type === 'web' ||
    tab?.type === 'git-diff'
  );
}

type EditorContextValue = {
  tabs: BaseTab[];
  activeTabId: string | null;
  activeTab: BaseTab | undefined;
  viewMode: string;
  editorPath: string | null;
  recentFiles: string[];
  isDirty: boolean;
  monacoEditorRef: MutableRefObject<unknown>;
  pendingGotoLineRef: MutableRefObject<number | null>;
  updateTabContent: (tabId: string, content: string) => void;
  openFile: (path: string) => Promise<void>;
  openWebTab: (opts: { id?: string; title?: string; url: string; icon?: string }) => void;
  activateTab: (tabId: string) => void;
  closeTab: (tabId: string) => void;
  deleteFile: (path: string) => Promise<boolean>;
  renameFile: (oldPath: string, newPath: string) => Promise<boolean>;
  createFile: (path: string, isDir?: boolean) => Promise<boolean>;
  saveCurrentFile: () => Promise<void>;
  setViewMode: (mode: string) => void;
  setEditorPath: (path: string | null) => void;
  addToRecent: (path: string) => void;
  clearRecentFiles: () => void;
  openFileAtLine: (path: string, line: number) => Promise<void>;
  openGitDiffTab: (opts: { path: string; staged?: boolean; codebaseRoot?: string }) => Promise<void>;
  openDiffView: () => Promise<void>;
  diffContent: string | null;
  cursorPosition: unknown;
  setCursorPosition: (pos: unknown) => void;
};

const EditorContext = createContext<EditorContextValue | null>(null);

async function fetchFileContent(path: string): Promise<string> {
  const r = await api('/files/content?path=' + encodeURIComponent(path));
  const data = await r.json();
  if (!r.ok || data.content === undefined) {throw new Error(data.error || 'Could not load file');}
  return data.content ?? '';
}

export function EditorProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [tabs, setTabs] = useState<BaseTab[]>([]);
  const [activeTabId, setActiveTabIdState] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<string>('welcome');
  const [editorPath, setEditorPathState] = useState<string | null>(null);
  const [diffContent, setDiffContent] = useState<string | null>(null);
  const [recentFiles, setRecentFiles] = useState(loadRecentFiles);
  const [cursorPosition, setCursorPosition] = useState<unknown>(null);
  const monacoEditorRef = useRef<unknown>(null);
  const pendingGotoLineRef = useRef<number | null>(null);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs; // ref sync during render (no Effect)
  const makeTabId = useCallback(
    (prefix = 'tab') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    []
  );

  const addToRecent = useCallback((path: string) => {
    if (!path || typeof path !== 'string') {return;}
    setRecentFiles((prev) => {
      const next = [path, ...prev.filter((p) => p !== path)].slice(0, RECENT_FILES_MAX);
      saveRecentFiles(next);
      return next;
    });
  }, []);

  const clearRecentFiles = useCallback(() => {
    setRecentFiles([]);
    saveRecentFiles([]);
  }, []);

  const updateTabContent = useCallback((tabId: string, content: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, content } : t))
    );
  }, []);

  const openFile = useCallback(
    async (path: string) => {
      const currentTabs = tabsRef.current;
      const existing = currentTabs.find((t) => t.type === 'file' && t.path === path);
      if (existing) {
        setActiveTabIdState(existing.id);
        setViewMode('editor');
        setEditorPathState(path);
        return;
      }

      if (path.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|bmp)$/i)) {
        setViewMode('image');
        setEditorPathState(path);
        addToRecent(path);
        return;
      }

      try {
        const content = await queryClient.fetchQuery({
          queryKey: ['file', path],
          queryFn: () => fetchFileContent(path),
        });
        const id = makeTabId();
        const tab = {
          id,
          type: 'file',
          path,
          name: path.split('/').pop() || path,
          content,
          originalContent: content,
        };
        setTabs((prev) => [...prev, tab]);
        setActiveTabIdState(id);
        setViewMode('editor');
        setEditorPathState(path);
        addToRecent(path);
      } catch (err: unknown) {
        console.error('Failed to load file:', err);
      }
    },
    [addToRecent, makeTabId, queryClient]
  );

  const openGitDiffTab = useCallback(
    async ({ path, staged, codebaseRoot }: { path: string; staged?: boolean; codebaseRoot?: string }) => {
      const currentTabs = tabsRef.current;
      const existing = currentTabs.find(
        (t) => t.type === 'git-diff' && t.gitPath === path && t.gitStaged === !!staged,
      );
      if (existing) {
        setActiveTabIdState(existing.id);
        setViewMode('editor');
        setEditorPathState(`${path} (${staged ? 'Index' : 'Working Tree'})`);
        return;
      }

      const basename = path.split('/').pop() || path;
      const name = staged ? `${basename} (Index)` : `${basename} (Working Tree)`;

      try {
        const diffText = await queryClient.fetchQuery({
          queryKey: queryKeys.git.fileDiff(path, !!staged, codebaseRoot ?? ''),
          queryFn: async () => {
            const r = await api(
              `/git/file-diff?path=${encodeURIComponent(path)}&staged=${staged ? '1' : '0'}`,
            );
            const d = await r.json();
            return d.diff ?? '';
          },
        });

        const id = makeTabId('gitdiff');
        const tab = {
          id,
          type: 'git-diff',
          path,
          gitPath: path,
          gitStaged: !!staged,
          name,
          content: diffText ?? '',
          originalContent: diffText ?? '',
        };
        setTabs((prev) => [...prev, tab]);
        setActiveTabIdState(id);
        setViewMode('editor');
        setEditorPathState(`${path} (${staged ? 'Index' : 'Working Tree'})`);
      } catch (err: unknown) {
        console.error('Failed to load git diff:', err);
        const id = makeTabId('gitdiff');
        const msg = `Could not load diff:\n\n${err instanceof Error ? err.message : String(err)}`;
        const tab = {
          id,
          type: 'git-diff',
          path,
          gitPath: path,
          gitStaged: !!staged,
          name,
          content: msg,
          originalContent: msg,
        };
        setTabs((prev) => [...prev, tab]);
        setActiveTabIdState(id);
        setViewMode('editor');
        setEditorPathState(`${path} (${staged ? 'Index' : 'Working Tree'})`);
      }
    },
    [makeTabId, queryClient],
  );

  const activateTab = useCallback((tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) {return;}
    setActiveTabIdState(tabId);
    setEditorPathState(
      tab.type === 'git-diff'
        ? `${tab.gitPath ?? tab.path ?? ''} (${tab.gitStaged ? 'Index' : 'Working Tree'})`
        : (tab.path || tab.url || tab.name || null),
    );
    setViewMode(tab.type === 'web' ? 'web' : 'editor');
  }, [tabs]);

  const openWebTab = useCallback(({ id, title, url, icon }: { id?: string; title?: string; url: string; icon?: string }) => {
    if (!url) {return;}
    const existing = id ? tabs.find((t) => t.type === 'web' && t.webId === id) : null;
    if (existing) {
      setActiveTabIdState(existing.id);
      setEditorPathState((existing.name || existing.url || null) as string | null);
      setViewMode('web');
      return;
    }
    const tabId = makeTabId('web');
    const tab = {
      id: tabId,
      type: 'web',
      webId: id || tabId,
      name: title || 'Web',
      path: title || url,
      url,
      icon: icon || 'globe',
      content: '',
      originalContent: '',
    };
    setTabs((prev) => [...prev, tab]);
    setActiveTabIdState(tabId);
    setEditorPathState(tab.name || null);
    setViewMode('web');
  }, [tabs, makeTabId]);

  const closeAllTabs = useCallback(() => {
    setTabs([]);
    setActiveTabIdState(null);
    setViewMode('welcome');
    setEditorPathState(null);
  }, []);

  const closeTab = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) {return;}

      const isDirty =
        !isNonFileEditorTab(tab) && tab.content !== tab.originalContent;
      if (isDirty && !window.confirm(`"${tab.name}" has unsaved changes. Close anyway?`)) {return;}

      const remaining = tabs.filter((t) => t.id !== tabId);
      setTabs(remaining);

      if (activeTabId === tabId) {
        if (remaining.length > 0) {
          const idx = tabs.findIndex((t) => t.id === tabId);
          const nextTab = remaining[Math.min(idx, remaining.length - 1)];
          if (!nextTab) {return;}
          setActiveTabIdState(nextTab.id);
          setEditorPathState(
            nextTab.type === 'git-diff'
              ? `${nextTab.gitPath} (${nextTab.gitStaged ? 'Index' : 'Working Tree'})`
              : (nextTab.path || nextTab.url || nextTab.name || null),
          );
          setViewMode(nextTab.type === 'web' ? 'web' : 'editor');
        } else {
          setActiveTabIdState(null);
          setViewMode('welcome');
          setEditorPathState(null);
        }
      }
    },
    [tabs, activeTabId]
  );

  const openFileAtLine = useCallback(
    async (path: string, line: number) => {
      await openFile(path);
      pendingGotoLineRef.current = line;
    },
    [openFile]
  );

  const openDiffView = useCallback(async () => {
    try {
      const r = await api('/diff');
      const data = await r.json();
      setDiffContent(data.diff || 'No changes or not a git repository.');
      setViewMode('diff');
      setEditorPathState('Git Diff');
      setActiveTabIdState(null);
    } catch (err: unknown) {
      console.error(err);
      setDiffContent('Failed to load diff.');
      setViewMode('diff');
      setEditorPathState('Git Diff');
    }
  }, []);

  const deleteFile = useCallback(async (path: string) => {
    try {
      const r = await api('/files/delete?path=' + encodeURIComponent(path), { method: 'DELETE' });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || 'Delete failed');
      }
      queryClient.invalidateQueries({ queryKey: ['files', 'tree'] });
      invalidateDashboardGitQueries(queryClient);
      queryClient.removeQueries({ queryKey: ['file', path] });
      const isDeleted = (t: BaseTab) => {
        const p = t.type === 'git-diff' ? t.gitPath : t.path;
        return typeof p === 'string' && (p === path || p.startsWith(path + '/'));
      };
      const remaining = tabs.filter((t) => !isDeleted(t));
      setTabs(remaining);
      if (!remaining.some((t) => t.id === activeTabId)) {
        if (remaining.length > 0) {
          const last = remaining[remaining.length - 1];
          if (!last) {return false;}
          setActiveTabIdState(last.id);
          setEditorPathState(
            last.type === 'git-diff'
              ? `${last.gitPath} (${last.gitStaged ? 'Index' : 'Working Tree'})`
              : (last.path || null),
          );
          setViewMode('editor');
        } else {
          setActiveTabIdState(null);
          setEditorPathState(null);
          setViewMode('welcome');
        }
      }
      toastFn?.((path.split('/').pop() || path) + ' deleted', 'success');
      return true;
    } catch (err: unknown) {
      toastFn?.('Delete failed: ' + (err instanceof Error ? err.message : String(err)), 'error');
      return false;
    }
  }, [tabs, activeTabId, queryClient]);

  const renameFile = useCallback(async (oldPath: string, newPath: string) => {
    try {
      const r = await api('/files/rename', { method: 'POST', body: { oldPath, newPath } });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || 'Rename failed');
      }
      queryClient.invalidateQueries({ queryKey: ['files', 'tree'] });
      invalidateDashboardGitQueries(queryClient);
      queryClient.removeQueries({ queryKey: ['file', oldPath] });
      setTabs((prev) => prev.map((t) => {
        if (t.type === 'git-diff') {
          if (t.gitPath === oldPath) {
            const base = newPath.split('/').pop() || newPath;
            return {
              ...t,
              path: newPath,
              gitPath: newPath,
              name: `${base} (${t.gitStaged ? 'Index' : 'Working Tree'})`,
            };
          }
          if (typeof t.gitPath === 'string' && t.gitPath.startsWith(oldPath + '/')) {
            const np = newPath + t.gitPath.slice(oldPath.length);
            const base = np.split('/').pop() || np;
            return {
              ...t,
              path: np,
              gitPath: np,
              name: `${base} (${t.gitStaged ? 'Index' : 'Working Tree'})`,
            };
          }
          return t;
        }
        if (t.path === oldPath) {return { ...t, path: newPath, name: newPath.split('/').pop() || newPath };}
        if (typeof t.path === 'string' && t.path.startsWith(oldPath + '/')) {
          const np = newPath + t.path.slice(oldPath.length);
          return { ...t, path: np, name: np.split('/').pop() || np };
        }
        return t;
      }));
      if (editorPath === oldPath) {setEditorPathState(newPath);}
      else if (editorPath?.startsWith(oldPath + '/')) {setEditorPathState(newPath + editorPath.slice(oldPath.length));}
      toastFn?.((oldPath.split('/').pop() || oldPath) + ' renamed', 'success');
      return true;
    } catch (err: unknown) {
      toastFn?.('Rename failed: ' + (err instanceof Error ? err.message : String(err)), 'error');
      return false;
    }
  }, [editorPath, queryClient]);

  const createFile = useCallback(async (path: string, isDir = false) => {
    try {
      const r = await api('/files/create', { method: 'POST', body: { path, isDir } });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || 'Create failed');
      }
      queryClient.invalidateQueries({ queryKey: ['files', 'tree'] });
      invalidateDashboardGitQueries(queryClient);
      toastFn?.((isDir ? 'Folder' : 'File') + ' created', 'success');
      return true;
    } catch (err: unknown) {
      toastFn?.('Create failed: ' + (err instanceof Error ? err.message : String(err)), 'error');
      return false;
    }
  }, [queryClient]);

  const saveCurrentFile = useCallback(async () => {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) {return;}
    if (isNonFileEditorTab(tab)) {return;}

    const content = tab.content ?? '';
    try {
      const r = await api('/files/content', { method: 'PUT', body: { path: tab.path ?? '', content } });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || 'Save failed');
      }
      queryClient.setQueryData(['file', tab.path], content);
      queryClient.invalidateQueries({ queryKey: ['files', 'tree'] });
      invalidateDashboardGitQueries(queryClient);
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, originalContent: content } : t))
      );
      toastFn?.('Saved', 'success');
    } catch (err: unknown) {
      console.error(err);
      toastFn?.('Save failed: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  }, [tabs, activeTabId, queryClient]);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isDirty = Boolean(
    activeTab &&
    activeTab.type !== 'web' &&
    activeTab.type !== 'git-diff' &&
    activeTab.content !== activeTab.originalContent
  );

  useEffect(() => {
    const handler = () => closeAllTabs();
    window.addEventListener('dashboard:project-changed', handler);
    return () => window.removeEventListener('dashboard:project-changed', handler);
  }, [closeAllTabs]);

  const value: EditorContextValue = {
    tabs,
    activeTabId,
    activeTab,
    viewMode,
    editorPath,
    recentFiles,
    isDirty,
    monacoEditorRef,
    pendingGotoLineRef,
    updateTabContent,
    openFile,
    openWebTab,
    activateTab,
    closeTab,
    deleteFile,
    renameFile,
    createFile,
    saveCurrentFile,
    setViewMode,
    setEditorPath: setEditorPathState,
    addToRecent,
    clearRecentFiles,
    openFileAtLine,
    openGitDiffTab,
    openDiffView,
    diffContent,
    cursorPosition,
    setCursorPosition: (pos: unknown) => setCursorPosition(pos),
  };

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) {throw new Error('useEditor must be used within EditorProvider');}
  return ctx;
}
