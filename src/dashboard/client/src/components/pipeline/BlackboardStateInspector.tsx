import { useEffect, useMemo, useState } from 'react';

type DiffOp = { path?: string };
type Snapshot = {
  phase: string;
  timestamp: string;
  state?: Record<string, unknown>;
  diffFromPrev?: DiffOp[];
};
type PipelineStateLike = {
  buildId?: string;
  blackboard?: Record<string, unknown>;
  blackboardSnapshots?: Snapshot[];
  lastBlackboardDiff?: { changedPaths?: string[] };
  phases?: Array<{ id: string; label?: string }>;
} | null;

function escapeJsonPointerPart(part: string | number) {
  return String(part).replace(/~/g, '~0').replace(/\//g, '~1');
}

function stringifyPretty(v: unknown) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function getPhaseLabel(pipelineState: PipelineStateLike, phaseId: string) {
  const phases = pipelineState?.phases || [];
  return phases.find((p) => p.id === phaseId)?.label || phaseId;
}

function computeChangedPathsFromOps(diffOps: DiffOp[] | undefined) {
  const out = new Set();
  if (!Array.isArray(diffOps)) {return [];}
  for (const op of diffOps) {
    if (op && typeof op.path === 'string' && op.path) {out.add(op.path);}
  }
  return Array.from(out);
}

function JsonTreeNode({
  value,
  pointerPath,
  level,
  expandedSet,
  toggle,
  changedPathsSet,
  queryActive,
  matchPrefixesSet,
  onCopy,
}: {
  value: unknown;
  pointerPath: string;
  level: number;
  expandedSet: Set<string>;
  toggle: (pointerPath: string) => void;
  changedPathsSet: Set<string>;
  queryActive: boolean;
  matchPrefixesSet: Set<string>;
  onCopy: (value: unknown) => void | Promise<void>;
}) {
  const isObj = value && typeof value === 'object';
  const isArr = Array.isArray(value);
  const isCollection = isObj; // arrays are also objects

  const canExpand = isCollection;
  const isExpanded = canExpand ? expandedSet.has(pointerPath) : false;
  const shouldAutoExpand = queryActive && matchPrefixesSet.has(pointerPath);
  const effectiveExpanded = shouldAutoExpand ? true : isExpanded;

  const isChanged =
    changedPathsSet.has(pointerPath) ||
    (pointerPath && Array.from(changedPathsSet).some((p) => p.startsWith(pointerPath + '/')));

  if (!canExpand) {
    return (
      <div className={`pipeline-json-row ${isChanged ? 'is-changed' : ''}`}>
        <span className="pipeline-json-key">{pointerPath.split('/').pop() || '/'}</span>
        <span className="pipeline-json-sep">:</span>
        <span className="pipeline-json-value">{typeof value === 'string' ? JSON.stringify(value) : String(value)}</span>
        <button type="button" className="pipeline-json-copy-btn" onClick={() => onCopy(value)} title="Copy">
          Copy
        </button>
      </div>
    );
  }

  const objValue = (isObj ? (value as Record<string, unknown>) : {}) as Record<string, unknown>;
  const arrValue = (isArr ? (value as unknown[]) : []) as unknown[];
  const children = isArr
    ? arrValue.map((v, i) => ({ k: String(i), v, childPointer: `${pointerPath}/${escapeJsonPointerPart(i)}` }))
    : Object.entries(objValue).map(([k, v]) => ({ k, v, childPointer: `${pointerPath}/${escapeJsonPointerPart(k)}` }));

  return (
    <div className="pipeline-json-node">
      <div className={`pipeline-json-row pipeline-json-row--object ${isChanged ? 'is-changed' : ''}`} style={{ paddingLeft: 10 + level * 12 }}>
        <button
          type="button"
          className={`pipeline-json-expander ${effectiveExpanded ? 'is-open' : ''}`}
          onClick={() => toggle(pointerPath)}
          disabled={queryActive && !shouldAutoExpand}
          title={effectiveExpanded ? 'Collapse' : 'Expand'}
        >
          {effectiveExpanded ? '▾' : '▸'}
        </button>
        <span className="pipeline-json-key">{pointerPath === '' ? '(root)' : pointerPath.split('/').pop()}</span>
        <span className="pipeline-json-meta">{isArr ? `Array(${children.length})` : `Object(${children.length})`}</span>
        <button
          type="button"
          className="pipeline-json-copy-btn"
          onClick={() => onCopy(value)}
          title="Copy subtree"
        >
          Copy
        </button>
      </div>
      {effectiveExpanded ? (
        <div className="pipeline-json-children">
          {children.length ? (
            children.slice(0, 500).map((c) => (
              <JsonTreeNode
                key={c.childPointer}
                value={c.v}
                pointerPath={c.childPointer}
                level={level + 1}
                expandedSet={expandedSet}
                toggle={toggle}
                changedPathsSet={changedPathsSet}
                queryActive={queryActive}
                matchPrefixesSet={matchPrefixesSet}
                onCopy={onCopy}
              />
            ))
          ) : (
            <div className="pipeline-json-empty">Empty</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function BlackboardStateInspector({ pipelineState }: { pipelineState: PipelineStateLike }) {
  const liveState = useMemo(() => pipelineState?.blackboard || {}, [pipelineState?.blackboard]);
  const changedPaths = useMemo(() => {
    const diff = pipelineState?.lastBlackboardDiff?.changedPaths || [];
    return new Set<string>(diff);
  }, [pipelineState?.lastBlackboardDiff?.changedPaths]);

  const snapshots = pipelineState?.blackboardSnapshots || [];
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [copiedAt, setCopiedAt] = useState(0);

  // default: collapse top-level keys only
  useEffect(() => {
    setExpanded(new Set());
  }, [pipelineState?.buildId]);

  const selectedDiffPaths = useMemo(() => {
    if (!selectedSnapshot) {return null;}
    const changed = computeChangedPathsFromOps(selectedSnapshot.diffFromPrev);
    return new Set<string>(changed as string[]);
  }, [selectedSnapshot]);

  const activeState = useMemo(() => (selectedSnapshot ? selectedSnapshot.state || {} : liveState), [selectedSnapshot, liveState]);
  const activeChangedSet = selectedSnapshot ? selectedDiffPaths : changedPaths;

  const queryActive = query.trim().length > 0;
  const matchPrefixesSet = useMemo(() => {
    if (!queryActive) {return new Set<string>();}
    const q = query.trim().toLowerCase();
    const prefixes = new Set<string>();

    const visit = (v: unknown, pointer: string) => {
      if (!v || typeof v !== 'object') {
        return;
      }
      const entries = Array.isArray(v)
        ? v.map((x, i) => [String(i), x] as const)
        : Object.entries(v as Record<string, unknown>);
      for (const [k, childVal] of entries) {
        const childPointer = `${pointer}/${escapeJsonPointerPart(k)}`.replace(/\/+/g, '/');
        if (childPointer.toLowerCase().includes(q) || k.toLowerCase().includes(q)) {
          prefixes.add(childPointer);
          prefixes.add(pointer);
        }
        // also include prefixes up the chain
        if (childPointer.includes('/')) {
          const parts = childPointer.split('/');
          let acc = '';
          for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i] ?? '';
            acc = acc ? `${acc}/${part}` : part;
            if (acc) {prefixes.add(acc);}
          }
        }
        visit(childVal, childPointer);
      }
    };
    visit(activeState, '');
    return prefixes;
  }, [queryActive, query, activeState]);

  const toggle = (pointerPath: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(pointerPath)) {next.delete(pointerPath);}
      else {next.add(pointerPath);}
      return next;
    });
  };

  const onCopy = async (v: unknown) => {
    try {
      await navigator.clipboard.writeText(typeof v === 'string' ? v : stringifyPretty(v));
      setCopiedAt(Date.now());
    } catch {}
  };

  const downloadSnapshot = () => {
    const blob = new Blob([stringifyPretty(activeState)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedSnapshot ? `blackboard-${selectedSnapshot.phase}-${selectedSnapshot.timestamp}.json` : 'blackboard-live.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="pipeline-blackboard">
      <div className="pipeline-panel-header">
        <div className="pipeline-panel-title">Blackboard Inspector</div>
        <div className="pipeline-panel-actions">
          {selectedSnapshot ? (
            <button type="button" className="pipeline-btn" onClick={() => setSelectedSnapshot(null)}>
              Return to Live
            </button>
          ) : null}
          <button type="button" className="pipeline-btn" onClick={downloadSnapshot}>
            Download snapshot
          </button>
        </div>
      </div>

      <div className="pipeline-blackboard-search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pipeline-input"
          placeholder="Search keys (e.g. prdGeneration, research...)"
        />
        {copiedAt ? <span className="pipeline-copy-toast">Copied</span> : null}
      </div>

      <div className="pipeline-snapshot-timeline">
        <div className="pipeline-snapshot-title">Snapshots</div>
        <div className="pipeline-snapshot-dots">
          {snapshots.length ? (
            snapshots
              .slice(-20)
              .map((s, idx) => (
                <button
                  type="button"
                  key={`${s.phase}-${s.timestamp}-${idx}`}
                  className={`pipeline-snapshot-dot ${selectedSnapshot?.timestamp === s.timestamp ? 'is-on' : ''}`}
                  title={`${getPhaseLabel(pipelineState, s.phase)} @ ${new Date(s.timestamp).toLocaleTimeString()}`}
                  onClick={() => setSelectedSnapshot(s)}
                />
              ))
          ) : (
            <div className="pipeline-snapshot-empty">No snapshots yet</div>
          )}
        </div>
      </div>

      <div className="pipeline-json-card">
        <div className="pipeline-json-tree">
          <JsonTreeNode
            value={activeState}
            pointerPath={''}
            level={0}
            expandedSet={expanded}
            toggle={toggle}
            changedPathsSet={activeChangedSet || new Set<string>()}
            queryActive={queryActive}
            matchPrefixesSet={matchPrefixesSet as Set<string>}
            onCopy={onCopy}
          />
        </div>
      </div>
    </div>
  );
}

