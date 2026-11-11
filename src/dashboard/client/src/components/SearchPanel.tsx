import { useState, useRef, useCallback, useEffect } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useEditor } from '../context/EditorContext';
import { useLayout } from '../context/LayoutContext';
import { getFileIcon } from '../utils/fileIcons';
import { AppCaretMotion } from './AppCaret';

type SearchResult = { path: string; line: number; text: string };

async function fetchSearch(q: string, caseSensitive: boolean, regex: boolean, wholeWord: boolean, include: string, exclude: string): Promise<SearchResult[]> {
  let url = '/search?q=' + encodeURIComponent(q);
  if (caseSensitive) {url += '&caseSensitive=1';}
  if (regex) {url += '&regex=1';}
  if (wholeWord) {url += '&wholeWord=1';}
  if (include && include.trim()) {url += '&include=' + encodeURIComponent(include.trim());}
  if (exclude && exclude.trim()) {url += '&exclude=' + encodeURIComponent(exclude.trim());}
  const r = await api(url);
  const data = await r.json();
  return data.results ?? [];
}

/** Build a RegExp for highlighting. Returns null if pattern is invalid or empty. */
function buildHighlightRegex(query: string, matchCase: boolean, useRegex: boolean, wholeWord: boolean) {
  if (!query) {return null;}
  try {
    const flags = matchCase ? 'g' : 'gi';
    if (useRegex) {return new RegExp(query, flags);}
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (wholeWord) {return new RegExp('(?:^|[^\\w])(' + escaped + ')(?=[^\\w]|$)', flags);}
    return new RegExp(escaped, flags);
  } catch {
    return null;
  }
}

/** Split line text into segments; match segments are for highlighting. */
function highlightSegments(text: string, query: string, matchCase: boolean, useRegex: boolean, wholeWord: boolean) {
  const re = buildHighlightRegex(query, matchCase, useRegex, wholeWord);
  if (!re || !text) {return [{ type: 'text', value: text }];}
  const segments = [];
  let lastEnd = 0;
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastEnd) {segments.push({ type: 'text', value: text.slice(lastEnd, m.index) });}
    const value = m[1] !== undefined ? m[1] : m[0];
    segments.push({ type: 'match', value });
    lastEnd = re.lastIndex;
  }
  if (lastEnd < text.length) {segments.push({ type: 'text', value: text.slice(lastEnd) });}
  return segments.length ? segments : [{ type: 'text', value: text }];
}

export function SearchPanel() {
  const queryClient = useQueryClient();
  const { openFileAtLine, openFile } = useEditor();
  const { activePanel } = useLayout();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [_replaceMode, _setReplaceMode] = useState(false);
  const [replaceText, setReplaceText] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [includePattern, setIncludePattern] = useState('');
  const [excludePattern, setExcludePattern] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchHistoryRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const editingQueryRef = useRef('');

  useEffect(() => {
    if (!query.trim()) {
      setDebouncedQuery('');
      setError(null);
      return;
    }
    if (debounceRef.current) {clearTimeout(debounceRef.current);}
    debounceRef.current = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => {
      if (debounceRef.current) {clearTimeout(debounceRef.current);}
    };
  }, [query]);

  const searchQuery = useQuery({
    queryKey: ['search', debouncedQuery, matchCase, useRegex, wholeWord, includePattern, excludePattern],
    queryFn: () =>
      fetchSearch(debouncedQuery, matchCase, useRegex, wholeWord, includePattern, excludePattern),
    enabled: !!debouncedQuery,
  });
  const results = searchQuery.data ?? [];
  const loading = searchQuery.isPending;
  const displayError = error ?? (searchQuery.error ? 'Search failed' : null);

  const runSearch = useCallback(() => {
    setDebouncedQuery(query.trim());
  }, [query]);

  useEffect(() => {
    if (activePanel === 'search') {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [activePanel]);

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (debounceRef.current) {clearTimeout(debounceRef.current);}
      const q = query.trim();
      setDebouncedQuery(q);
      if (q && searchHistoryRef.current[searchHistoryRef.current.length - 1] !== q) {
        searchHistoryRef.current = [...searchHistoryRef.current.slice(-49), q];
      }
      historyIndexRef.current = -1;
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const hist = searchHistoryRef.current;
      if (hist.length === 0) {return;}
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIndexRef.current === -1) {
          editingQueryRef.current = query;
          historyIndexRef.current = hist.length - 1;
        } else if (historyIndexRef.current > 0) {
          historyIndexRef.current--;
        }
        if (historyIndexRef.current >= 0) {setQuery(hist[historyIndexRef.current] ?? '');}
      } else {
        e.preventDefault();
        if (historyIndexRef.current === -1) {return;}
        if (historyIndexRef.current < hist.length - 1) {
          historyIndexRef.current++;
          setQuery(hist[historyIndexRef.current] ?? '');
        } else {
          historyIndexRef.current = -1;
          setQuery(editingQueryRef.current);
        }
      }
    }
  };

  const replaceMutation = useMutation<any, Error, { query: string; replacement: string; preview: boolean }>({
    mutationFn: async ({ query, replacement, preview }) => {
      const r = await api('/search/replace', {
        method: 'POST',
        body: { query, replacement, preview },
      });
      const data = await r.json();
      if (!r.ok) {throw new Error(data.error || (preview ? 'Preview failed' : 'Replace failed'));}
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: ['search', vars.query, matchCase, useRegex, wholeWord, includePattern, excludePattern],
      });
    },
  });

  const runReplace = useCallback(async () => {
    if (!query.trim()) {return;}
    setError(null);
    try {
      const previewData = await replaceMutation.mutateAsync({
        query: query.trim(),
        replacement: replaceText,
        preview: true,
      });
      if (!previewData.total) {
        setError('No matches to replace');
        return;
      }
      const ok = window.confirm(`Replace ${previewData.total} matches in ${previewData.replacedIn.length} files?`);
      if (!ok) {return;}
      await replaceMutation.mutateAsync({
        query: query.trim(),
        replacement: replaceText,
        preview: false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Replace failed');
    }
  }, [query, replaceText, replaceMutation]);

  const grouped = (results as SearchResult[]).reduce((acc: Record<string, SearchResult[]>, r: SearchResult) => {
    const bucket = acc[r.path] ?? (acc[r.path] = []);
    bucket.push(r);
    return acc;
  }, {});

  const totalMatches = results.length;
  const fileCount = Object.keys(grouped).length;

  return (
    <div className="search-panel">
      <div className="search-panel-header">
        <span className="search-panel-title">SEARCH</span>
        <div className="search-panel-header-actions">
          <button type="button" className="search-header-btn" title="Refresh" onClick={() => runSearch()} aria-label="Refresh search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64-4.36A9 9 0 0120.49 15" />
            </svg>
          </button>
          <button type="button" className="search-header-btn" title="Clear" onClick={() => { setQuery(''); setReplaceText(''); setDebouncedQuery(''); }} aria-label="Clear search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
            </svg>
          </button>
        </div>
      </div>
      <div className="search-panel-body">
        <div className="search-input-row">
          <input
            ref={inputRef}
            id="search-input"
            type="text"
            className="search-input-field"
            placeholder="Search (↑↓ history)"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="search-toggles">
            <button
              type="button"
              className={`search-toggle ${matchCase ? 'is-on' : ''}`}
              title="Match case (Aa)"
              onClick={() => setMatchCase((v) => !v)}
              aria-pressed={matchCase}
            >
              Aa
            </button>
            <button
              type="button"
              className={`search-toggle ${wholeWord ? 'is-on' : ''}`}
              title="Match whole word"
              onClick={() => setWholeWord((v) => !v)}
              aria-pressed={wholeWord}
            >
              ab|
            </button>
            <button
              type="button"
              className={`search-toggle ${useRegex ? 'is-on' : ''}`}
              title="Use regular expression"
              onClick={() => setUseRegex((v) => !v)}
              aria-pressed={useRegex}
            >
              *
            </button>
          </div>
        </div>

        <button
          type="button"
          className="search-expand-toggle"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
        >
          <AppCaretMotion
            className="search-expand-chevron"
            isOpen={expanded}
            closedDirection="down"
            openDirection="up"
          />
          Replace & filters
        </button>

        {expanded && (
          <div className="search-expanded">
            <div className="search-replace-row">
              <input
                type="text"
                className="search-replace-input"
                placeholder="Replace"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
              />
              <button
                type="button"
                className="search-replace-btn"
                onClick={runReplace}
                disabled={loading || !query.trim()}
              >
                Replace all
              </button>
            </div>
            <div className="search-filter-row">
              <label className="search-filter-label">files to include</label>
              <input
                type="text"
                className="search-filter-input"
                placeholder="e.g. *.ts, src/**"
                value={includePattern}
                onChange={(e) => setIncludePattern(e.target.value)}
              />
            </div>
            <div className="search-filter-row">
              <label className="search-filter-label">files to exclude</label>
              <input
                type="text"
                className="search-filter-input"
                placeholder="e.g. node_modules, dist"
                value={excludePattern}
                onChange={(e) => setExcludePattern(e.target.value)}
              />
            </div>
          </div>
        )}

        {debouncedQuery && (loading || totalMatches > 0 || displayError) && (
          <div className="search-results-meta">
            {loading ? (
              <span className="search-meta-loading">Searching…</span>
            ) : displayError ? (
              <span className="search-meta-error">{displayError}</span>
            ) : (
              <span className="search-meta-count">
                {totalMatches} {totalMatches === 1 ? 'result' : 'results'} in {fileCount} {fileCount === 1 ? 'file' : 'files'}
              </span>
            )}
          </div>
        )}

        <div className="search-results" role="list">
          {!query.trim() ? (
            <div className="search-empty">
              <p>Enter a search term to find matches in your workspace.</p>
            </div>
          ) : !debouncedQuery ? (
            <div className="search-empty">
              <p>Type to search…</p>
            </div>
          ) : loading ? null : displayError ? null : results.length === 0 ? (
            <div className="search-empty">
              <p>No results for &ldquo;{debouncedQuery}&rdquo;</p>
            </div>
          ) : (
            Object.entries(grouped).map(([path, matches]: [string, SearchResult[]]) => {
              const fileName = path.split('/').pop() || path;
              const fi = getFileIcon(fileName, false);
              return (
                <div key={path} className="search-result-group" role="listitem">
                  <button
                    type="button"
                    className="search-result-file"
                    onClick={() => openFile(path)}
                  >
                    <span className="search-result-file-icon" style={{ color: fi.color }}>
                      {fi.icon}
                    </span>
                    <span className="search-result-file-path">{path}</span>
                    <span className="search-result-file-count">{matches.length}</span>
                  </button>
                  <div className="search-result-lines">
                    {matches.map((m: SearchResult, i: number) => {
                      const segments = highlightSegments(m.text, debouncedQuery, matchCase, useRegex, wholeWord);
                      return (
                        <button
                          key={`${path}-${m.line}-${i}`}
                          type="button"
                          className="search-result-line"
                          onClick={() => openFileAtLine(path, m.line)}
                        >
                          <span className="search-result-linenum" aria-hidden>{m.line}</span>
                          <span className="search-result-text">
                            {segments.map((seg, j) =>
                              seg.type === 'match' ? (
                                <mark key={j} className="search-highlight">{seg.value}</mark>
                              ) : (
                                <span key={j}>{seg.value}</span>
                              )
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
