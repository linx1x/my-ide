import { useState, useEffect, useRef, useCallback } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useLayout } from '../context/LayoutContext';
import { useEditor } from '../context/EditorContext';
import { useFileTree } from '../hooks/useFileTree';
import { getFileIcon } from '../utils/fileIcons';
import { scoreFile } from '../utils/quickOpenUtils';

const MAX_RESULTS = 50;

type FileEntry = { name?: string; path?: string; isDir?: boolean; score?: number };
type FileWithPath = FileEntry & { path: string };
type QuickOpenInnerProps = {
  close: () => void;
  openFile: (path: string) => void;
  flatFileList: FileEntry[];
  loadFileTree: () => void;
  recentFiles: string[];
};

function QuickOpenInner({ close, openFile, flatFileList, loadFileTree, recentFiles }: QuickOpenInnerProps) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const prevQueryRef = useRef(query);

  const files = flatFileList.filter((f: FileEntry): f is FileWithPath => !f.isDir && !!f.path);
  const recentPaths = recentFiles || [];

  const results: FileWithPath[] =
    query.trim() === ''
      ? (() => {
        const filePaths = new Set(files.map((f: FileWithPath) => f.path));
        const recentFirst = recentPaths.filter((p: string) => filePaths.has(p));
        const rest = files.filter((f: FileWithPath) => !recentFirst.includes(f.path));
        const combined = [...recentFirst.map((p: string) => files.find((f: FileWithPath) => f.path === p)), ...rest].filter(Boolean) as FileWithPath[];
        return combined.slice(0, MAX_RESULTS);
      })()
      : files
        .map((f: FileWithPath) => ({ ...f, score: scoreFile(query.trim(), f as any) }))
        .filter((f: FileWithPath) => (f.score ?? 0) > 0)
        .sort((a: FileWithPath, b: FileWithPath) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, MAX_RESULTS);

  // Reset selection when query changes (adjust during render instead of useEffect)
  if (prevQueryRef.current !== query) {
    prevQueryRef.current = query;
    setSelectedIdx(0);
  }

  useEffect(() => {
    loadFileTree();
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [loadFileTree]);

  const openSelected = useCallback(() => {
    const item = results[selectedIdx];
    if (item) {
      close();
      openFile(item.path);
    }
  }, [results, selectedIdx, close, openFile]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [close]);

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      openSelected();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  useEffect(() => {
    const el = resultsRef.current?.children[selectedIdx];
    if (el) {el.scrollIntoView({ block: 'nearest' });}
  }, [selectedIdx, results]);

  return (
    <div className="quick-open-box">
      <input
        ref={inputRef}
        type="text"
        placeholder="Type to search files..."
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div ref={resultsRef} className="quick-open-results">
        {results.length === 0 ? (
          <div className="qo-item" style={{ color: 'var(--muted)' }}>
            No matching files
          </div>
        ) : (
          results.map((f: FileWithPath, i: number) => {
            const fi = getFileIcon(f.name ?? f.path, false);
            const dir = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/') + 1) : '';
            return (
              <div
                key={f.path}
                className={`qo-item ${i === selectedIdx ? 'selected' : ''}`}
                onClick={() => {
                  close();
                  openFile(f.path);
                }}
                onMouseEnter={() => setSelectedIdx(i)}
                role="option"
                aria-selected={i === selectedIdx}
              >
                <span className="qo-item-icon" style={{ color: fi.color }}>
                  {fi.icon}
                </span>
                <span className="qo-item-name">{f.name ?? f.path.split('/').pop() ?? f.path}</span>
                {dir ? <span className="qo-item-path">{dir}</span> : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function QuickOpen() {
  const { quickOpenOpen, setQuickOpenOpen } = useLayout();
  const { openFile, recentFiles } = useEditor();
  const { flatFileList, loadFileTree } = useFileTree();

  const close = useCallback(() => {
    setQuickOpenOpen(false);
  }, [setQuickOpenOpen]);

  if (!quickOpenOpen) {return null;}

  return (
    <div
      className="quick-open-overlay"
      onClick={(e) => e.target === e.currentTarget && close()}
      role="dialog"
      aria-label="Quick Open"
    >
      <QuickOpenInner
        key="quick-open-open"
        close={close}
        openFile={openFile}
        flatFileList={(flatFileList as FileEntry[]) ?? []}
        loadFileTree={loadFileTree}
        recentFiles={recentFiles}
      />
    </div>
  );
}
