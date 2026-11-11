import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CloudDownload,
  GitBranch,
  Loader2,
  Minus,
  Plus,
  X,
} from 'lucide-react';
import { AppCaretMotion } from './AppCaret';
import { ICON_SM, ICON_STROKE } from './iconTokens';
import { api } from '../api';
import { useLayout } from '../context/LayoutContext';
import { useEditor } from '../context/EditorContext';
import { useGitStatus } from '../hooks/useGitStatus';
import { useToast } from '../context/ToastContext';
import { queryKeys } from '../queryKeys';
import { invalidateDashboardGitQueries } from '../git/invalidateGitQueries';
import { Skeleton, SkeletonGroup } from './Skeleton';

const gitIconTransition: any = {
  type: 'tween',
  duration: 0.2,
  ease: [0.25, 0.1, 0.25, 1],
};
const gitSpinTransition: any = { repeat: Infinity, duration: 0.72, ease: 'linear' };

const GIT_CHANGES_HEIGHT_STORAGE = 'git.changesPaneHeight';
const GIT_MIN_CHANGES_PX = 140;
const GIT_MIN_GRAPH_PX = 100;
const GIT_SPLIT_HANDLE_PX = 6;

function readStoredChangesPaneHeight() {
  if (typeof window === 'undefined') {
    return 360;
  }
  try {
    const raw = localStorage.getItem(GIT_CHANGES_HEIGHT_STORAGE);
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= GIT_MIN_CHANGES_PX) {
        return n;
      }
    }
  } catch {
    /* ignore */
  }
  return Math.min(440, Math.round(window.innerHeight * 0.36));
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const fn = () => setReduced(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return reduced;
}

// ── Graph constants (lanes alternate two tokenized tones; see tokens.css) ───────
const LANE_STROKES = ['var(--git-graph-lane-a)', 'var(--git-graph-lane-b)'];
function laneStroke(lane: number) {
  return LANE_STROKES[lane % LANE_STROKES.length];
}
const ROW_H = 26;
const COL_W = 14;
const NODE_R = 4;
const GRAPH_PAD = 6;

// ── Graph layout algorithm ─────────────────────────────────────────────────────
// Assigns a lane (column) to every commit so parallel branches stay in separate lanes.
function computeGraph(commits: any[]) {
  if (!commits.length) {
    return { rows: [], hashToRowIdx: {} };
  }
  const lanes: Array<string | null> = []; // lanes[i] = hash expected in lane i, or null = free
  const hashToRowIdx: Record<string, number> = {};
  const rows = [];

  for (let i = 0; i < commits.length; i++) {
    const c = commits[i];
    hashToRowIdx[c.hash] = i;

    // Find the lane waiting for this commit, or open a new one
    let lane: number = lanes.findIndex((h) => h === c.hash);
    if (lane === -1) {
      lane = lanes.findIndex((h) => h === null);
      if (lane === -1) {
        lane = lanes.length;
      }
    }
    rows.push({ ...c, lane });

    // Free this slot then assign parent lanes
    lanes[lane] = null;
    for (let pi = 0; pi < c.parents.length; pi++) {
      const ph = c.parents[pi];
      if (lanes.includes(ph)) {
        continue;
      } // already tracked
      if (pi === 0) {
        lanes[lane] = ph; // first parent continues in current lane
      } else {
        let nl = lanes.indexOf(null);
        if (nl === -1) {
          nl = lanes.length;
        }
        lanes[nl] = ph; // merge parent opens a new lane
      }
    }
    // Compact trailing nulls to keep lane count minimal
    while (lanes.length && lanes[lanes.length - 1] === null) {
      lanes.pop();
    }
  }
  return { rows, hashToRowIdx };
}

// ── Ref label pill ─────────────────────────────────────────────────────────────
function RefLabel({ name, onContextMenu }: { name: string; onContextMenu?: any }) {
  const clean = name.startsWith('tag: ') ? name.slice(5) : name;
  const isHead = clean === 'HEAD';
  const isTag = name.startsWith('tag: ');
  const isRemote = !isHead && !isTag && clean.includes('/');
  const cls = isHead
    ? 'git-ref git-ref-head'
    : isTag
      ? 'git-ref git-ref-tag'
      : isRemote
        ? 'git-ref git-ref-remote'
        : 'git-ref git-ref-local';
  // Tags and HEAD don't get a context menu
  const handleCtx =
    onContextMenu && !isHead && !isTag
      ? (e: ReactMouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e, clean, isRemote);
      }
      : undefined;
  return (
    <span
      className={cls}
      title={clean}
      onContextMenu={handleCtx}
      style={handleCtx ? { cursor: 'context-menu' } : undefined}
    >
      {clean}
    </span>
  );
}

// ── Branch context menu ────────────────────────────────────────────────────────
function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: any[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Clamp to viewport after first render
  useEffect(() => {
    if (ref.current) {
      const { width, height } = ref.current.getBoundingClientRect();
      setPos({
        left: x + width > window.innerWidth ? Math.max(0, x - width) : x,
        top: y + height > window.innerHeight ? Math.max(0, y - height) : y,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="git-ctx-menu"
      style={{ position: 'fixed', left: pos.left, top: pos.top, zIndex: 1000 }}
      onMouseDown={(e: ReactMouseEvent) => e.stopPropagation()}
    >
      {items.map((item: any, i: number) =>
        item === null ? (
          <div key={i} className="git-ctx-sep" />
        ) : (
          <button
            key={i}
            className={`git-ctx-item${item.danger ? ' danger' : ''}${item.disabled ? ' disabled' : ''}`}
            onClick={() => {
              if (!item.disabled) {
                item.action();
                onClose();
              }
            }}
          >
            {item.icon && <span className="git-ctx-icon">{item.icon}</span>}
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}

// ── Interactive commit graph (SVG + text rows) ─────────────────────────────────
function CommitGraph({
  rows,
  hashToRowIdx,
  selectedHash,
  onSelect,
  onRefContextMenu,
  onCheckout,
}: any) {
  const maxLane = rows.reduce((m: number, r: any) => Math.max(m, r.lane), 0);
  const svgW = GRAPH_PAD + (maxLane + 1) * COL_W + GRAPH_PAD;
  const svgH = rows.length * ROW_H;

  return (
    <div className="git-graph-scroll">
      <div style={{ position: 'relative', minHeight: svgH }}>
        {/* SVG: edges drawn first (behind nodes) */}
        <svg
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            pointerEvents: 'none',
          }}
          width={svgW}
          height={svgH}
        >
          {rows.map((row: any, ri: number) =>
            row.parents.map((ph: string) => {
              const pi = hashToRowIdx[ph];
              if (pi === undefined) {
                return null;
              }
              const pr = rows[pi];
              const x1 = GRAPH_PAD + (row.lane + 0.5) * COL_W;
              const y1 = ri * ROW_H + ROW_H / 2;
              const x2 = GRAPH_PAD + (pr.lane + 0.5) * COL_W;
              const y2 = pi * ROW_H + ROW_H / 2;
              const color = laneStroke(row.lane);
              if (Math.abs(x1 - x2) < 0.5) {
                return (
                  <line
                    key={`e-${row.hash}-${ph}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={color}
                    strokeWidth="1.5"
                  />
                );
              }
              // Bezier curve for diagonal (branch/merge) connections
              const ym = y1 + ROW_H * 0.75;
              return (
                <path
                  key={`e-${row.hash}-${ph}`}
                  d={`M${x1},${y1} C${x1},${ym} ${x2},${ym} ${x2},${y2}`}
                  stroke={color}
                  strokeWidth="1.5"
                  fill="none"
                />
              );
            }),
          )}
          {rows.map((row: any, ri: number) => {
            const cx = GRAPH_PAD + (row.lane + 0.5) * COL_W;
            const cy = ri * ROW_H + ROW_H / 2;
            const laneColor = laneStroke(row.lane);
            const sel = selectedHash === row.hash;
            return (
              <circle
                key={`n-${row.hash}`}
                cx={cx}
                cy={cy}
                r={sel ? NODE_R + 2 : NODE_R}
                fill={sel ? 'var(--git-graph-node-selected)' : laneColor}
                stroke={sel ? 'var(--text-bright)' : 'var(--bg)'}
                strokeWidth={sel ? 2 : 1.5}
              />
            );
          })}
        </svg>

        {/* Text rows: positioned to the right of the SVG */}
        <div style={{ paddingLeft: svgW }}>
          {rows.map((row: any, _ri: number) => (
            <div
              key={row.hash}
              className={`git-graph-row${selectedHash === row.hash ? ' selected' : ''}`}
              style={{ height: ROW_H }}
              onClick={() => onSelect(row)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onCheckout?.(row);
              }}
              title={row.hash}
              onContextMenu={(e) => {
                if (!onRefContextMenu) {
                  return;
                }
                // Use first non-HEAD, non-tag branch ref on this row
                const branch = row.refs.find(
                  (r: string) => r !== 'HEAD' && !r.startsWith('tag: '),
                );
                if (branch) {
                  e.preventDefault();
                  onRefContextMenu(e, branch, branch.includes('/'));
                }
              }}
            >
              {row.refs.length > 0 && (
                <div className="git-graph-refs">
                  {row.refs.slice(0, 3).map((ref: string) => (
                    <RefLabel
                      key={ref}
                      name={ref}
                      onContextMenu={onRefContextMenu}
                    />
                  ))}
                </div>
              )}
              <span className="git-graph-msg">{row.message}</span>
              <span className="git-graph-meta">
                {row.author} · {row.date}
              </span>
              <span className="git-graph-hash">{row.shortHash}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Single file row (staged or unstaged) ──────────────────────────────────────
function FileRow({
  file,
  staged,
  onStage,
  onUnstage,
  onDiscard,
  selected,
  onSelect,
}: any) {
  const idx = file.indexStatus ?? ' ';
  const wt = file.wtStatus ?? ' ';
  const isUntracked = idx === '?' && wt === '?';
  const char = staged ? (idx !== ' ' ? idx : wt) : wt !== ' ' ? wt : idx;
  const cls = char === 'A' ? 'A' : char === 'D' ? 'D' : isUntracked ? 'U' : 'M';

  return (
    <div
      className={`git-file-row${selected ? ' selected' : ''}`}
      onClick={() => onSelect(file)}
    >
      <span className={`changed-file-status ${cls}`}>
        {isUntracked ? '?' : char || 'M'}
      </span>
      <span className="git-file-name" title={file.path}>
        {file.path}
      </span>
      <div className="git-file-btns" onClick={(e) => e.stopPropagation()}>
        {staged ? (
          <motion.button
            className="git-icon-btn"
            title="Unstage"
              onClick={() => onUnstage?.(file.path)}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            transition={gitIconTransition}
          >
            <Minus size={13} strokeWidth={2.25} aria-hidden />
          </motion.button>
        ) : (
          <>
            <motion.button
              className="git-icon-btn add"
              title="Stage"
              onClick={() => onStage?.(file.path)}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              transition={gitIconTransition}
            >
              <Plus size={13} strokeWidth={2.25} aria-hidden />
            </motion.button>
            {!isUntracked && (
              <motion.button
                className="git-icon-btn del"
                title="Discard changes"
                onClick={() => onDiscard(file.path, false)}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                transition={gitIconTransition}
              >
                <X size={13} strokeWidth={2.25} aria-hidden />
              </motion.button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Changes tab ────────────────────────────────────────────────────────────────
async function fetchGitStatus() {
  const r = await api('/git/status');
  const data = await r.json();
  return data.files || [];
}

function parseStagedUnstaged(files: any[]) {
  const s = [],
    u = [];
  for (const f of files) {
    const { indexStatus: idx = ' ', wtStatus: wt = ' ' } = f;
    const isUntracked = idx === '?' && wt === '?';
    if (isUntracked) {
      u.push(f);
    } else {
      if (idx !== ' ') {
        s.push(f);
      }
      if (wt !== ' ') {
        u.push(f);
      }
    }
  }
  return { staged: s, unstaged: u };
}

function ChangesTab({
  gitPanelActive,
  statusPollMs,
  codebaseRoot,
}: any) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setEditorView } = useLayout();
  const { openGitDiffTab } = useEditor();
  const [commitMsg, setCommitMsg] = useState('');
  const [sel, setSel] = useState<any>(null); // { file, staged: bool } — highlights row; diff opens in editor

  const statusQuery = useQuery({
    queryKey: queryKeys.git.status(codebaseRoot ?? ''),
    queryFn: fetchGitStatus,
    // Always fetch while GitPanel is mounted (sidebar keeps it alive); only poll when the Git tab is active.
    refetchInterval: gitPanelActive ? statusPollMs : false,
  });
  const files = useMemo(() => statusQuery.data ?? [], [statusQuery.data]);
  const { staged, unstaged } = useMemo(
    () => parseStagedUnstaged(files),
    [files],
  );

  const invalidateAllGit = useCallback(() => {
    invalidateDashboardGitQueries(queryClient);
  }, [queryClient]);

  const stageMutation = useMutation<any, Error, any>({
    mutationFn: ({ path }) =>
      api('/git/stage', { method: 'POST', body: { path } }).then((r) =>
        r.ok
          ? undefined
          : r.json().then((d) => {
            throw new Error(d.error || 'Stage failed');
          }),
      ),
    onSuccess: invalidateAllGit,
    onError: (err) => toast(err.message, 'error'),
  });
  const stageAllMutation = useMutation<any, Error, any>({
    mutationFn: () =>
      api('/git/stage', { method: 'POST', body: { all: true } }).then((r) =>
        r.ok
          ? undefined
          : r.json().then((d) => {
            throw new Error(d.error || 'Stage all failed');
          }),
      ),
    onSuccess: invalidateAllGit,
    onError: (err) => toast(err.message, 'error'),
  });
  const unstageMutation = useMutation<any, Error, any>({
    mutationFn: ({ path }) =>
      api('/git/unstage', { method: 'POST', body: { path } }).then((r) =>
        r.ok
          ? undefined
          : r.json().then((d) => {
            throw new Error(d.error || 'Unstage failed');
          }),
      ),
    onSuccess: invalidateAllGit,
    onError: (err) => toast(err.message, 'error'),
  });
  const unstageAllMutation = useMutation<any, Error, any>({
    mutationFn: () =>
      api('/git/unstage', { method: 'POST', body: { all: true } }).then((r) =>
        r.ok
          ? undefined
          : r.json().then((d) => {
            throw new Error(d.error || 'Unstage all failed');
          }),
      ),
    onSuccess: invalidateAllGit,
    onError: (err) => toast(err.message, 'error'),
  });
  const discardMutation = useMutation<any, Error, any>({
    mutationFn: ({ path, untracked }) =>
      api('/git/discard', { method: 'POST', body: { path, untracked } }).then(
        (r) =>
          r.ok
            ? undefined
            : r.json().then((d) => {
              throw new Error(d.error || 'Discard failed');
            }),
      ),
    onSuccess: (_, { path }) => {
      setSel((prev: any) => (prev?.file?.path === path ? null : prev));
      invalidateAllGit();
    },
    onError: (err) => toast(err.message, 'error'),
  });
  const commitMutation = useMutation<any, Error, any>({
    mutationFn: ({ message }) =>
      api('/git/commit', { method: 'POST', body: { message } }).then(
        async (r) => {
          const d = await r.json();
          if (!r.ok) {
            throw new Error(d.error || 'Commit failed');
          }
          return d;
        },
      ),
    onSuccess: () => {
      setCommitMsg('');
      toast('Committed!', 'success');
      invalidateAllGit();
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const selectFile = (file: any, isStagedFile: boolean) => {
    setEditorView('code');
    setSel({ file, staged: isStagedFile });
    void openGitDiffTab({
      path: file.path,
      staged: isStagedFile,
      codebaseRoot,
    });
  };

  const doStage = (path: string) => stageMutation.mutate({ path });
  const doStageAll = () => stageAllMutation.mutate(undefined as any);
  const doUnstage = (path: string) => unstageMutation.mutate({ path });
  const doUnstageAll = () => unstageAllMutation.mutate(undefined as any);
  const doDiscard = (path: string, _untracked: boolean) => {
    if (!window.confirm(`Discard changes to ${path}?`)) {
      return;
    }
    const isUntracked = unstaged.find(
      (f) => f.path === path && f.indexStatus === '?' && f.wtStatus === '?',
    );
    discardMutation.mutate({ path, untracked: !!isUntracked });
  };
  const doCommit = () => {
    if (!commitMsg.trim()) {
      toast('Enter a commit message', 'warning');
      return;
    }
    if (!staged.length) {
      toast('Nothing staged to commit', 'warning');
      return;
    }
    commitMutation.mutate({ message: commitMsg.trim() });
  };
  const committing = commitMutation.isPending;

  return (
    <div className="git-changes-tab">
      <div className="git-changes-lists-scroll">
        {/* Staged */}
        <div className="git-section-block git-section-staged">
          <div className="git-section-hdr">
            <span className="git-section-hdr-left">
              <span className="git-section-hdr-label">Staged</span>
              <span className="git-section-hdr-count">{staged.length}</span>
            </span>
            {staged.length > 0 && (
              <motion.button
                className="git-icon-btn"
                title="Unstage all"
                onClick={doUnstageAll}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                transition={gitIconTransition}
              >
                <Minus size={13} strokeWidth={2.25} aria-hidden />
              </motion.button>
            )}
          </div>
          {staged.length ? (
            <div className="git-file-list">
              {staged.map((f: any) => (
                <FileRow
                  key={`s-${f.path}`}
                  file={f}
                  staged
                  onUnstage={doUnstage}
                  onDiscard={doDiscard}
                  selected={sel?.file.path === f.path && sel?.staged}
                  onSelect={(f: any) => selectFile(f, true)}
                />
              ))}
            </div>
          ) : (
            <div className="git-empty-hint">No staged changes</div>
          )}
        </div>

        {/* Unstaged */}
        <div className="git-section-block git-section-unstaged">
          <div className="git-section-hdr">
            <span className="git-section-hdr-left">
              <span className="git-section-hdr-label">Unstaged</span>
              <span className="git-section-hdr-count">{unstaged.length}</span>
            </span>
            {unstaged.length > 0 && (
              <motion.button
                className="git-icon-btn add"
                title="Stage all"
                onClick={doStageAll}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                transition={gitIconTransition}
              >
                <Plus size={13} strokeWidth={2.25} aria-hidden />
              </motion.button>
            )}
          </div>
          {unstaged.length ? (
            <div className="git-file-list">
              {unstaged.map((f: any) => (
                <FileRow
                  key={`u-${f.path}`}
                  file={f}
                  staged={false}
                  onStage={doStage}
                  onDiscard={doDiscard}
                  selected={sel?.file.path === f.path && !sel?.staged}
                  onSelect={(f: any) => selectFile(f, false)}
                />
              ))}
            </div>
          ) : (
            <div className="git-empty-hint">No unstaged changes</div>
          )}
        </div>
      </div>

      {/* Commit form */}
      <div className="git-commit-area">
        <textarea
          className="git-commit-input"
          placeholder="Commit message…"
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              doCommit();
            }
          }}
        />
        <div className="git-commit-actions">
          <button
            className="git-commit-btn"
            onClick={doCommit}
            disabled={committing || !commitMsg.trim() || !staged.length}
          >
            {committing ? 'Committing…' : `Commit (${staged.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Commits (Graph) tab ────────────────────────────────────────────────────────
async function fetchGitLog() {
  const r = await api('/git/log');
  const d = await r.json();
  return d.commits ?? [];
}

async function fetchGitShow(hash: string) {
  const r = await api(`/git/show?hash=${hash}`);
  const d = await r.json();
  return d.stat ?? null;
}

function CommitsTab({ currentBranch, codebaseRoot, hideHeader = false }: { currentBranch?: string | null; codebaseRoot?: string | null; hideHeader?: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<any>(null);
  const [ctxMenu, setCtxMenu] = useState<any>(null); // { x, y, branchName, isRemote }

  const invalidateAllGit = useCallback(() => {
    invalidateDashboardGitQueries(queryClient);
  }, [queryClient]);

  const checkoutMutation = useMutation<any, Error, any>({
    mutationFn: ({ branch }) =>
      api('/git/checkout', { method: 'POST', body: { branch } }).then(
        async (r) => {
          if (!r.ok) {
            throw new Error((await r.json()).error);
          }
        },
      ),
    onSuccess: (_, { successMsg }) => {
      invalidateAllGit();
      toast(successMsg, 'success');
    },
    onError: (err) => toast(err.message, 'error'),
  });
  const mergeMutation = useMutation<any, Error, any>({
    mutationFn: ({ branch }) =>
      api('/git/merge', { method: 'POST', body: { branch } }).then(
        async (r) => {
          if (!r.ok) {
            throw new Error((await r.json()).error);
          }
        },
      ),
    onSuccess: (_, { successMsg }) => {
      invalidateAllGit();
      toast(successMsg, 'success');
    },
    onError: (err) => toast(err.message, 'error'),
  });
  const rebaseMutation = useMutation<any, Error, any>({
    mutationFn: ({ branch }) =>
      api('/git/rebase', { method: 'POST', body: { branch } }).then(
        async (r) => {
          if (!r.ok) {
            throw new Error((await r.json()).error);
          }
        },
      ),
    onSuccess: (_, { successMsg }) => {
      invalidateAllGit();
      toast(successMsg, 'success');
    },
    onError: (err) => toast(err.message, 'error'),
  });
  const deleteBranchMutation = useMutation<any, Error, any>({
    mutationFn: ({ branch }) =>
      api('/git/delete-branch', { method: 'POST', body: { branch } }).then(
        async (r) => {
          if (!r.ok) {
            throw new Error((await r.json()).error);
          }
        },
      ),
    onSuccess: (_, { branch }) => {
      invalidateAllGit();
      toast(`Deleted ${branch}`, 'success');
      setCtxMenu(null);
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const logQuery = useQuery({
    queryKey: queryKeys.git.log(codebaseRoot ?? ''),
    queryFn: fetchGitLog,
  });
  const commits = useMemo(() => logQuery.data ?? [], [logQuery.data]);
  const graph = useMemo(() => computeGraph(commits), [commits]);
  const loading = logQuery.isPending;

  const showQuery = useQuery({
    queryKey: queryKeys.git.show(selected?.hash ?? '', codebaseRoot ?? ''),
    queryFn: () => fetchGitShow(selected.hash),
    enabled: !!selected?.hash,
  });
  const commitStat = showQuery.data ?? null;
  const statLoading = showQuery.isPending;

  const handleSelect = useCallback(
    (commit: any) => {
      if (selected?.hash === commit.hash) {
        setSelected(null);
        return;
      }
      setSelected(commit);
    },
    [selected],
  );

  const handleRefContextMenu = useCallback((e: MouseEvent, branchName: string, isRemote: boolean) => {
    setCtxMenu({ x: e.clientX, y: e.clientY, branchName, isRemote });
  }, []);

  const cur = currentBranch || 'current';
  const handleCheckout = useCallback(
    (row: any) => {
      const branchRef = row.refs.find(
        (r: string) => r !== 'HEAD' && !r.startsWith('tag: ') && !r.includes('/'),
      );
      const ref = branchRef || row.hash;
      const successMsg = branchRef
        ? `Switched to ${branchRef}`
        : `Checked out ${row.shortHash} (detached HEAD)`;
      checkoutMutation.mutate({ branch: ref, successMsg });
    },
    [checkoutMutation],
  );

  const runAction = useCallback(
    (endpoint: string, branch: string, successMsg: string) => {
      if (endpoint === '/git/checkout') {
        checkoutMutation.mutate({ branch, successMsg });
      } else if (endpoint === '/git/merge') {
        mergeMutation.mutate({ branch, successMsg });
      } else if (endpoint === '/git/rebase') {
        rebaseMutation.mutate({ branch, successMsg });
      }
    },
    [checkoutMutation, mergeMutation, rebaseMutation],
  );

  const handleDeleteBranch = useCallback(
    (branchName: string) => {
      if (
        !window.confirm(`Delete branch "${branchName}"? This cannot be undone.`)
      ) {
        return;
      }
      deleteBranchMutation.mutate({ branch: branchName });
    },
    [deleteBranchMutation],
  );

  const buildCtxItems = useCallback(
    (branchName: string, isRemote: boolean) => {
      const isCurrent = branchName === currentBranch;
      const items = [];

      if (isCurrent) {
        items.push({
          icon: '✓',
          label: `"${branchName}" is the current branch`,
          action: () => {},
          disabled: true,
        });
        items.push(null);
      } else {
        items.push({
          icon: '⎇',
          label: `Checkout "${branchName}"`,
          action: () =>
            runAction('/git/checkout', branchName, `Switched to ${branchName}`),
        });
        items.push({
          icon: '⤵',
          label: `Merge "${branchName}" into ${cur}`,
          action: () =>
            runAction(
              '/git/merge',
              branchName,
              `Merged ${branchName} into ${cur}`,
            ),
        });
        items.push({
          icon: '↩',
          label: `Rebase ${cur} onto "${branchName}"`,
          action: () =>
            runAction(
              '/git/rebase',
              branchName,
              `Rebased ${cur} onto ${branchName}`,
            ),
        });
        items.push(null);
      }

      items.push({
        icon: '⧉',
        label: 'Copy branch name',
        action: () => navigator.clipboard.writeText(branchName).catch(() => {}),
      });

      if (!isRemote && !isCurrent) {
        items.push(null);
        items.push({
          icon: '✕',
          label: `Delete "${branchName}"`,
          danger: true,
          action: () => handleDeleteBranch(branchName),
        });
      }

      return items;
    },
    [currentBranch, cur, runAction, handleDeleteBranch],
  );

  if (loading) {
    return (
      <div className="git-commits-tab" aria-busy="true">
        {!hideHeader && (
          <div className="git-graph-header">
            <span className="git-graph-header-title">History</span>
          </div>
        )}
        <SkeletonGroup>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 0',
              }}
            >
              <Skeleton variant="rect" width={20} height={14} />
              <Skeleton variant="text" style={{ width: 48, flexShrink: 0 }} />
              <Skeleton
                variant="text"
                style={{ flex: 1, maxWidth: i % 2 ? '60%' : '80%' }}
              />
            </div>
          ))}
        </SkeletonGroup>
      </div>
    );
  }
  if (!graph.rows.length) {
    return <div className="git-empty-hint">No commits found</div>;
  }

  return (
    <div className="git-commits-tab">
      {!hideHeader && (
        <div className="git-graph-header">
          <span className="git-graph-header-title">History</span>
        </div>
      )}
      <CommitGraph
        rows={graph.rows}
        hashToRowIdx={graph.hashToRowIdx}
        selectedHash={selected?.hash}
        onSelect={handleSelect}
        onRefContextMenu={handleRefContextMenu}
        onCheckout={handleCheckout}
      />
      {selected && (
        <div className="git-commit-detail">
          <div className="git-commit-detail-head">
            <span className="git-graph-hash">{selected.shortHash}</span>
            {selected.refs.slice(0, 4).map((r: string) => (
              <RefLabel key={r} name={r} />
            ))}
          </div>
          <div className="git-commit-detail-msg">{selected.message}</div>
          <div className="git-commit-detail-meta">
            {selected.author} · {selected.date}
          </div>
          {statLoading && <div className="git-diff-empty">Loading…</div>}
          {!statLoading && commitStat && (
            <pre className="git-commit-stat">{commitStat}</pre>
          )}
        </div>
      )}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={buildCtxItems(ctxMenu.branchName, ctxMenu.isRemote)}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}

async function fetchGitBranches() {
  const r = await api('/git/branches');
  if (!r.ok) {
    return { local: [], remote: [], current: null };
  }
  return r.json();
}

// ── Main GitPanel ──────────────────────────────────────────────────────────────
export function GitPanel() {
  const queryClient = useQueryClient();
  const { activePanel } = useLayout();
  const gitPanelActive = activePanel === 'git';
  const { gitPanelStatusPollMs, codebaseRoot } = useGitStatus(activePanel);
  const { toast } = useToast();
  const [showBranchMenu, setShowBranchMenu] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const branchMenuRef = useRef<HTMLDivElement | null>(null);
  /** Expanded on every mount (fresh session / panel mount), like Cursor’s graph default */
  const [graphExpanded, setGraphExpanded] = useState(true);
  const [changesPaneHeight, setChangesPaneHeight] = useState(
    readStoredChangesPaneHeight,
  );
  const [maxChangesPanePx, setMaxChangesPanePx] = useState(520);
  const panelBodyRef = useRef<HTMLDivElement | null>(null);
  const splitHandleRef = useRef<HTMLDivElement | null>(null);
  const changesPaneHeightRef = useRef(changesPaneHeight);
  changesPaneHeightRef.current = changesPaneHeight;

  const branchesQuery = useQuery({
    queryKey: queryKeys.git.branches(codebaseRoot ?? ''),
    queryFn: fetchGitBranches,
    enabled: gitPanelActive,
  });
  const branches = branchesQuery.data ?? {
    local: [],
    remote: [],
    current: null,
  };

  useEffect(() => {
    if (!gitPanelActive) {
      return;
    }
    let es: EventSource | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        invalidateDashboardGitQueries(queryClient);
      }, 180);
    };
    try {
      es = new EventSource('/api/git/live', { withCredentials: true });
      es.addEventListener('git', bump);
    } catch {
      /* ignore */
    }
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      if (es) {
        es.close();
      }
    };
  }, [gitPanelActive, queryClient, codebaseRoot]);

  const invalidateAllGitToolbar = useCallback(() => {
    invalidateDashboardGitQueries(queryClient);
  }, [queryClient]);

  const checkoutBranchMutation = useMutation<any, Error, any>({
    mutationFn: (name) =>
      api('/git/checkout', { method: 'POST', body: { branch: name } }).then(
        async (r) => {
          if (!r.ok) {
            throw new Error((await r.json()).error);
          }
        },
      ),
    onSuccess: (name) => {
      setShowBranchMenu(false);
      invalidateAllGitToolbar();
      toast(`Switched to ${name}`, 'success');
    },
    onError: (err) => toast(err.message, 'error'),
  });
  const createBranchMutation = useMutation<any, Error, any>({
    mutationFn: (name) =>
      api('/git/create-branch', { method: 'POST', body: { name } }).then(
        async (r) => {
          if (!r.ok) {
            throw new Error((await r.json()).error);
          }
        },
      ),
    onSuccess: (name) => {
      setNewBranchName('');
      setShowBranchMenu(false);
      invalidateAllGitToolbar();
      toast(`Created branch ${name}`, 'success');
    },
    onError: (err) => toast(err.message, 'error'),
  });
  const fetchMutation = useMutation<any, Error, any>({
    mutationFn: () =>
      api('/git/fetch', { method: 'POST' }).then((r) => {
        if (!r.ok) {
          return r.json().then((d) => {
            throw new Error(d.error);
          });
        }
      }),
    onSuccess: () => {
      invalidateAllGitToolbar();
      toast('Fetched', 'success');
    },
    onError: (err) => toast(err.message, 'error'),
  });
  const pullMutation = useMutation<any, Error, any>({
    mutationFn: () =>
      api('/git/pull', { method: 'POST' }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) {
          throw new Error(d.error);
        }
        return d;
      }),
    onSuccess: (d) => {
      invalidateAllGitToolbar();
      toast(d?.output || 'Pulled', 'success');
    },
    onError: (err) => toast(err.message, 'error'),
  });
  const pushMutation = useMutation<any, Error, any>({
    mutationFn: () =>
      api('/git/push', { method: 'POST' }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) {
          throw new Error(d.error);
        }
        return d;
      }),
    onSuccess: (d) => {
      invalidateAllGitToolbar();
      toast(d?.output || 'Pushed', 'success');
    },
    onError: (err) => toast(err.message, 'error'),
  });
  const doCheckout = (name: string) => checkoutBranchMutation.mutate(name);
  const doCreateBranch = () => {
    if (!newBranchName.trim()) {
      return;
    }
    createBranchMutation.mutate(newBranchName.trim());
  };
  const doFetch = () => fetchMutation.mutate(undefined as any);
  const doPull = () => pullMutation.mutate(undefined as any);
  const doPush = () => pushMutation.mutate(undefined as any);

  const fetching = fetchMutation.isPending;
  const pulling = pullMutation.isPending;
  const pushing = pushMutation.isPending;
  const reducedMotion = useReducedMotion();
  const iconEase = reducedMotion ? { duration: 0 } : gitIconTransition;
  const spinProps = reducedMotion
    ? {}
    : { animate: { rotate: 360 }, transition: gitSpinTransition };

  // Close branch menu on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (branchMenuRef.current && !branchMenuRef.current.contains(e.target as Node)) {
        setShowBranchMenu(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Size cap for the changes (top) pane from available body height when graph is open
  useEffect(() => {
    const body = panelBodyRef.current;
    if (!body) {
      return;
    }
    const update = () => {
      const h = body.getBoundingClientRect().height;
      if (!graphExpanded) {
        setMaxChangesPanePx(Math.max(GIT_MIN_CHANGES_PX, h));
        return;
      }
      const maxTop = h - GIT_MIN_GRAPH_PX - GIT_SPLIT_HANDLE_PX;
      setMaxChangesPanePx(Math.max(GIT_MIN_CHANGES_PX, maxTop));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(body);
    return () => ro.disconnect();
  }, [graphExpanded]);

  useEffect(() => {
    setChangesPaneHeight((prev) => Math.min(prev, maxChangesPanePx));
  }, [maxChangesPanePx]);

  // Drag handle between changes and graph (down = more space for changes)
  useEffect(() => {
    if (!graphExpanded) {
      return;
    }
    const el = splitHandleRef.current;
    if (!el) {
      return;
    }
    const onDown = (e: MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startH = changesPaneHeightRef.current;
      el.classList.add('dragging');
      const onMove = (moveEvent: MouseEvent) => {
        const dy = moveEvent.clientY - startY;
        const next = Math.max(
          GIT_MIN_CHANGES_PX,
          Math.min(maxChangesPanePx, startH + dy),
        );
        changesPaneHeightRef.current = next;
        setChangesPaneHeight(next);
      };
      const onUp = () => {
        el.classList.remove('dragging');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        try {
          localStorage.setItem(
            GIT_CHANGES_HEIGHT_STORAGE,
            String(changesPaneHeightRef.current),
          );
        } catch {
          /* ignore */
        }
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };
    el.addEventListener('mousedown', onDown);
    return () => el.removeEventListener('mousedown', onDown);
  }, [graphExpanded, maxChangesPanePx]);

  return (
    <div className="git-panel">
      {/* Toolbar: branch selector + remote actions */}
      <div className="git-toolbar">
        <div className="git-branch-selector" ref={branchMenuRef}>
          <button
            className="git-branch-btn"
            onClick={() => setShowBranchMenu((v) => !v)}
            title={
              branches.current
                ? `Branch: ${branches.current}`
                : 'Switch / create branch'
            }
          >
            <motion.span
              className="git-branch-icon-wrap"
              aria-hidden
              whileHover={reducedMotion ? {} : { scale: 1.07 }}
              transition={iconEase}
            >
              <GitBranch
                size={ICON_SM}
                strokeWidth={ICON_STROKE}
                className="git-branch-svg"
              />
            </motion.span>
            <span className="git-branch-name">{branches.current || '—'}</span>
            <AppCaretMotion
              className="git-branch-caret-wrap"
              iconClassName="git-branch-caret-svg"
              isOpen={showBranchMenu}
              closedDirection="down"
              openDirection="up"
              size={ICON_SM}
              strokeWidth={ICON_STROKE}
            />
          </button>

          {showBranchMenu && (
            <div className="git-branch-menu">
              <div className="git-branch-menu-label">New branch</div>
              <div className="git-branch-new-row">
                <input
                  className="git-branch-input"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="branch-name"
                  onKeyDown={(e) => e.key === 'Enter' && doCreateBranch()}
                  autoFocus
                />
                <motion.button
                  className="git-icon-btn add"
                  onClick={doCreateBranch}
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.94 }}
                  transition={gitIconTransition}
                  title="Create branch"
                >
                  <Plus size={13} strokeWidth={2.25} aria-hidden />
                </motion.button>
              </div>
              {branches.local.length > 0 && (
                <>
                  <div className="git-branch-menu-label">Local</div>
                  {branches.local.map((b: any) => (
                    <button
                      key={b.name}
                      className={`git-branch-item${b.isCurrent ? ' current' : ''}`}
                      onClick={() => !b.isCurrent && doCheckout(b.name)}
                    >
                      {b.isCurrent ? '✓ ' : '  '}
                      {b.name}
                    </button>
                  ))}
                </>
              )}
              {branches.remote.length > 0 && (
                <>
                  <div className="git-branch-menu-label">Remote</div>
                  {branches.remote.map((b: any) => (
                    <button
                      key={b.name}
                      className="git-branch-item remote"
                      onClick={() => doCheckout(b.name)}
                    >
                      {b.name}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        <div className="git-toolbar-btns">
          <button
            className="git-tb-btn"
            onClick={doFetch}
            disabled={fetching}
            title="Fetch all remotes"
          >
            {fetching ? (
              <motion.span
                className="git-tb-btn-icon"
                style={{ display: 'inline-flex' }}
                {...spinProps}
              >
                <Loader2 size={ICON_SM} strokeWidth={ICON_STROKE} aria-hidden />
              </motion.span>
            ) : (
              <CloudDownload
                size={ICON_SM}
                strokeWidth={ICON_STROKE}
                className="git-tb-btn-icon"
                aria-hidden
              />
            )}
            <span>Fetch</span>
          </button>
          <button
            className="git-tb-btn"
            onClick={doPull}
            disabled={pulling}
            title="Pull"
          >
            {pulling ? (
              <motion.span
                className="git-tb-btn-icon"
                style={{ display: 'inline-flex' }}
                {...spinProps}
              >
                <Loader2 size={ICON_SM} strokeWidth={ICON_STROKE} aria-hidden />
              </motion.span>
            ) : (
              <ArrowDownToLine
                size={14}
                strokeWidth={2}
                className="git-tb-btn-icon"
                aria-hidden
              />
            )}
            <span>Pull</span>
          </button>
          <button
            className="git-tb-btn"
            onClick={doPush}
            disabled={pushing}
            title="Push"
          >
            {pushing ? (
              <motion.span
                className="git-tb-btn-icon"
                style={{ display: 'inline-flex' }}
                {...spinProps}
              >
                <Loader2 size={ICON_SM} strokeWidth={ICON_STROKE} aria-hidden />
              </motion.span>
            ) : (
              <ArrowUpFromLine
                size={ICON_SM}
                strokeWidth={ICON_STROKE}
                className="git-tb-btn-icon"
                aria-hidden
              />
            )}
            <span>Push</span>
          </button>
        </div>
      </div>

      <div className="git-panel-body" ref={panelBodyRef}>
        <div
          className="git-section git-section-changes"
          style={
            graphExpanded
              ? {
                flex: '0 0 auto',
                height: changesPaneHeight,
                minHeight: GIT_MIN_CHANGES_PX,
              }
              : { flex: 1, minHeight: 0 }
          }
        >
          <ChangesTab
            gitPanelActive={gitPanelActive}
            statusPollMs={gitPanelStatusPollMs}
          />
        </div>
        {graphExpanded && (
          <div
            ref={splitHandleRef}
            className="git-panel-resize-handle"
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize between changes and graph"
            title="Drag to resize"
          />
        )}
        <div
          className={`git-section git-section-graph${graphExpanded ? '' : ' is-collapsed'}`}
        >
          <button
            type="button"
            className="git-graph-section-toggle"
            onClick={() => setGraphExpanded((v) => !v)}
            aria-expanded={graphExpanded}
            aria-controls="git-commit-graph-panel"
            id="git-graph-section-label"
          >
            <AppCaretMotion
              className="git-graph-section-chevron"
              isOpen={graphExpanded}
              closedDirection="right"
              openDirection="down"
              size={ICON_SM}
              strokeWidth={ICON_STROKE}
            />
            <span className="git-graph-section-title">Graph</span>
          </button>
          <AnimatePresence initial={false}>
            {graphExpanded && (
              <motion.div
                key="git-graph-body"
                id="git-commit-graph-panel"
                className="git-graph-section-body"
                role="region"
                aria-labelledby="git-graph-section-label"
                initial={(reducedMotion ? false : { opacity: 0, y: -6 }) as any}
                animate={{ opacity: 1, y: 0 }}
                exit={(reducedMotion ? undefined : { opacity: 0, y: -4 }) as any}
                transition={
                  reducedMotion
                    ? { duration: 0 }
                    : { duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }
                }
              >
                <CommitsTab
                  currentBranch={branches.current}
                  codebaseRoot={codebaseRoot}
                  hideHeader
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
