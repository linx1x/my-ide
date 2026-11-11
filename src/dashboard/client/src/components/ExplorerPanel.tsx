import { useEffect, useState, useCallback, useRef } from 'react';
import type { FormEvent } from 'react';
import * as Toolbar from '@radix-ui/react-toolbar';
import { FilePlus, FolderPlus, RefreshCw, CircleDot, Trash2 } from 'lucide-react';
import { AppCaretMotion } from './AppCaret';
import { useFileTree } from '../hooks/useFileTree';
import { useEditor } from '../context/EditorContext';
import { useLayout } from '../context/LayoutContext';
import { FileTree } from './FileTree';
import { Skeleton, SkeletonGroup } from './Skeleton';
import { getFileIcon } from '../utils/fileIcons';

type TreeItem = {
  name: string;
  path: string;
  isDir?: boolean;
  children?: TreeItem[];
};

type PromptModalProps = {
  open: boolean;
  title: string;
  initialValue: string;
  placeholder: string;
  submitLabel: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
};

type PromptState = {
  open: boolean;
  title: string;
  initialValue: string;
  placeholder: string;
  submitLabel: string;
  onConfirm: ((value: string) => void | Promise<void>) | null;
};

function PromptModal({ open, title, initialValue, placeholder, submitLabel, onConfirm, onCancel }: PromptModalProps) {
  const [value, setValue] = useState(initialValue ?? '');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setValue(initialValue ?? '');
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open, initialValue]);

  if (!open) {return null;}

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = value.trim();
    if (v) {onConfirm(v);}
    else {onCancel();}
  };

  return (
    <div
      className="project-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <form className="project-modal" onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onCancel()}
          placeholder={placeholder}
          aria-label={placeholder}
        />
        <div className="project-modal-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={!value.trim()}>
            {submitLabel ?? 'OK'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function ExplorerPanel() {
  const { openFile, deleteFile, renameFile, createFile, recentFiles, clearRecentFiles } = useEditor();
  const { isMobile, setMobileSidebarOpen } = useLayout();
  const {
    fileTreeData,
    loading,
    error,
    loadFileTree,
    toggleDotfiles,
    showDotfiles,
  } = useFileTree();
  const [selectedItem, setSelectedItem] = useState<TreeItem | null>(null);
  const selectedPath = selectedItem?.path ?? null;
  const [recentOpen, setRecentOpen] = useState(true);
  const [prompt, setPrompt] = useState<PromptState>({
    open: false,
    title: '',
    initialValue: '',
    placeholder: '',
    submitLabel: 'OK',
    onConfirm: null,
  });

  const closePrompt = useCallback(() => {
    setPrompt((p) => ({ ...p, open: false, onConfirm: null }));
  }, []);

  useEffect(() => {
    loadFileTree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = () => loadFileTree();
    window.addEventListener('dashboard:refresh-tree', handler);
    return () => window.removeEventListener('dashboard:refresh-tree', handler);
  }, [loadFileTree]);

  const handleSelect = useCallback((_path: string, item: TreeItem) => {
    setSelectedItem(item || null);
  }, []);

  const openFileAndMaybeCloseSidebar = useCallback(
    (path: string) => {
      openFile(path);
      if (isMobile) {setMobileSidebarOpen(false);}
    },
    [openFile, isMobile, setMobileSidebarOpen]
  );

  const getNewItemBasePath = useCallback(() => {
    if (!selectedItem) {return '';}
    if (selectedItem.isDir) {return selectedItem.path;}
    const parts = selectedItem.path.split('/');
    parts.pop();
    return parts.join('/');
  }, [selectedItem]);

  const handleNewFile = useCallback(() => {
    const base = getNewItemBasePath();
    setPrompt({
      open: true,
      title: 'New file',
      initialValue: '',
      placeholder: base ? `Name (under ${base})` : 'File name',
      submitLabel: 'Create',
      onConfirm: async (name: string) => {
        closePrompt();
        const path = base ? base + '/' + name : name;
        const ok = await createFile(path, false);
        if (ok) {
          loadFileTree();
          openFileAndMaybeCloseSidebar(path);
        }
      },
    });
  }, [getNewItemBasePath, createFile, loadFileTree, openFileAndMaybeCloseSidebar, closePrompt]);

  const handleNewFolder = useCallback(() => {
    const base = getNewItemBasePath();
    setPrompt({
      open: true,
      title: 'New folder',
      initialValue: '',
      placeholder: base ? `Name (under ${base})` : 'Folder name',
      submitLabel: 'Create',
      onConfirm: async (name: string) => {
        closePrompt();
        const path = base ? base + '/' + name : name;
        const ok = await createFile(path, true);
        if (ok) {loadFileTree();}
      },
    });
  }, [getNewItemBasePath, createFile, loadFileTree, closePrompt]);

  const runRename = useCallback(
    (item: TreeItem, newName: string) => {
      const parts = item.path.split('/');
      parts[parts.length - 1] = newName;
      const newPath = parts.join('/');
      return renameFile(item.path, newPath).then((ok) => {
        if (ok) {loadFileTree();}
      });
    },
    [renameFile, loadFileTree]
  );

  function buildMenuItems(item: TreeItem) {
    const menu = [];

    if (!item.isDir) {
      menu.push({ label: 'Open', icon: '↗', action: () => openFileAndMaybeCloseSidebar(item.path) });
      menu.push(null);
    }

    if (item.isDir) {
      menu.push({
        label: 'New File inside…',
        icon: '+',
        action: () => {
          setPrompt({
            open: true,
            title: 'New file',
            initialValue: '',
            placeholder: `Name (under ${item.path})`,
            submitLabel: 'Create',
            onConfirm: async (name: string) => {
              closePrompt();
              const path = item.path + '/' + name;
              const ok = await createFile(path, false);
              if (ok) {
                loadFileTree();
                openFileAndMaybeCloseSidebar(path);
              }
            },
          });
        },
      });
      menu.push({
        label: 'New Folder inside…',
        icon: '+',
        action: () => {
          setPrompt({
            open: true,
            title: 'New folder',
            initialValue: '',
            placeholder: `Name (under ${item.path})`,
            submitLabel: 'Create',
            onConfirm: async (name: string) => {
              closePrompt();
              const path = item.path + '/' + name;
              const ok = await createFile(path, true);
              if (ok) {loadFileTree();}
            },
          });
        },
      });
      menu.push(null);
    }

    menu.push({
      label: 'Rename…',
      icon: '✎',
      action: () => {
        const oldName = item.path.split('/').pop() || item.path;
        setPrompt({
          open: true,
          title: 'Rename',
          initialValue: oldName,
          placeholder: 'New name',
          submitLabel: 'Rename',
          onConfirm: async (newName: string) => {
            closePrompt();
            if (newName.trim() === oldName) {return;}
            await runRename(item, newName.trim());
          },
        });
      },
    });

    menu.push({
      label: 'Delete',
      icon: '✕',
      danger: true,
      action: async () => {
        const label = item.isDir ? `folder "${item.name}" and all its contents` : `"${item.name}"`;
        if (!window.confirm(`Delete ${label}?`)) {return;}
        const ok = await deleteFile(item.path);
        if (ok) {loadFileTree();}
      },
    });

    menu.push(null);

    menu.push({
      label: 'Copy Path',
      icon: '⎘',
      action: () => navigator.clipboard.writeText(item.path).catch(() => {}),
    });

    return menu;
  }

  return (
    <div className="explorer-panel">
      <PromptModal
        open={prompt.open}
        title={prompt.title}
        initialValue={prompt.initialValue}
        placeholder={prompt.placeholder}
        submitLabel={prompt.submitLabel}
        onConfirm={
          prompt.onConfirm
            ? (value: string) => {
              closePrompt();
              prompt.onConfirm?.(value);
            }
            : () => {}
        }
        onCancel={closePrompt}
      />
      <div className="sidebar-header">
        <span className="sidebar-title">EXPLORER</span>
        <Toolbar.Root className="sidebar-actions explorer-toolbar" aria-label="Explorer actions">
          <Toolbar.Button
            className={`icon-btn ${showDotfiles ? 'active-toggle' : ''}`}
            title={showDotfiles ? 'Hide dotfiles' : 'Show dotfiles'}
            onClick={() => toggleDotfiles()}
            aria-pressed={showDotfiles}
          >
            <CircleDot size={16} strokeWidth={2} />
          </Toolbar.Button>
          <Toolbar.Separator className="explorer-toolbar-sep" />
          <Toolbar.Button className="icon-btn" title="New File" onClick={handleNewFile}>
            <FilePlus size={16} strokeWidth={2} />
          </Toolbar.Button>
          <Toolbar.Button className="icon-btn" title="New Folder" onClick={handleNewFolder}>
            <FolderPlus size={16} strokeWidth={2} />
          </Toolbar.Button>
          <Toolbar.Button className="icon-btn" title="Refresh" onClick={() => loadFileTree()}>
            <RefreshCw size={16} strokeWidth={2} />
          </Toolbar.Button>
        </Toolbar.Root>
      </div>
      <div className="sidebar-body">
        {recentFiles.length > 0 && (
          <div className="explorer-recent-section">
            <button
              type="button"
              className="explorer-recent-header"
              onClick={() => setRecentOpen((o) => !o)}
              aria-expanded={recentOpen}
            >
              <AppCaretMotion isOpen={recentOpen} closedDirection="right" openDirection="down" />
              <span className="explorer-recent-title">Recent</span>
              <span className="explorer-recent-count">{recentFiles.length}</span>
              <button
                type="button"
                className="explorer-recent-clear"
                title="Clear recent files"
                onClick={(e) => {
                  e.stopPropagation();
                  clearRecentFiles();
                }}
                aria-label="Clear recent files"
              >
                <Trash2 size={12} />
              </button>
            </button>
            {recentOpen && (
              <ul className="explorer-recent-list">
                {recentFiles.map((path: string) => {
                  const name = path.split('/').pop();
                  const fi = getFileIcon(name || path, false);
                  return (
                    <li key={path} className="explorer-recent-item">
                      <button
                        type="button"
                        className="explorer-recent-item-btn"
                        onClick={() => openFileAndMaybeCloseSidebar(path)}
                        title={path}
                      >
                        <span className="explorer-recent-icon" style={{ color: fi.color }}>
                          {fi.icon}
                        </span>
                        <span className="explorer-recent-name">{name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
        {loading ? (
          <div className="file-tree-skeleton" style={{ padding: '8px 12px' }} aria-busy="true">
            <SkeletonGroup>
              {[0, 12, 12, 28, 28, 44, 44].map((indent, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: indent }}>
                  <Skeleton variant="rect" width={14} height={14} style={{ flexShrink: 0 }} />
                  <Skeleton variant="text" style={{ flex: 1, maxWidth: i % 2 ? '60%' : '80%' }} />
                </div>
              ))}
            </SkeletonGroup>
          </div>
        ) : error ? (
          <span className="muted" style={{ padding: '8px 12px', display: 'block', fontSize: 12, color: 'var(--error)' }}>
            {error}
          </span>
        ) : (
          <FileTree
            items={fileTreeData as any}
            onOpenFile={openFileAndMaybeCloseSidebar}
            onContextMenu={undefined}
            selectedPath={selectedPath}
            onSelect={handleSelect}
            buildContextMenuItems={buildMenuItems}
          />
        )}
      </div>
    </div>
  );
}
