import { useState, useEffect, useRef, useCallback } from 'react';
import { useLayout } from '../context/LayoutContext';
import { useDatabase } from '../hooks/useDatabase';
import { Skeleton, SkeletonGroup } from './Skeleton';

const DB_QUERIES_KEY_PREFIX = 'db_queries_';
const DB_QUERIES_MAX = 10;

interface SchemaColumn {
  name: string;
  type?: string;
  nullable?: boolean;
}

interface QueryResult {
  columns: string[];
  rows: unknown[];
}

function loadRecentQueries(connectionId: string | null): string[] {
  if (!connectionId) {return [];}
  try {
    const raw = sessionStorage.getItem(DB_QUERIES_KEY_PREFIX + connectionId);
    if (raw) {return JSON.parse(raw);}
  } catch {}
  return [];
}

function saveRecentQuery(connectionId: string | null, query: string) {
  if (!connectionId || !query?.trim()) {return;}
  const prev = loadRecentQueries(connectionId);
  const next = [query.trim(), ...prev.filter((q) => q !== query.trim())].slice(0, DB_QUERIES_MAX);
  try {
    sessionStorage.setItem(DB_QUERIES_KEY_PREFIX + connectionId, JSON.stringify(next));
  } catch {}
}

const DB_TYPES = [
  { value: 'sqlite', label: 'SQLite' },
  { value: 'postgres', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
];

export function DatabasePanel() {
  const { activePanel } = useLayout();
  const {
    connectionId,
    connectionType,
    tables,
    schema,
    selectedTable,
    queryResult,
    loading,
    error,
    connect,
    disconnect,
    refreshTables,
    loadSchema,
    runQuery,
  } = useDatabase(activePanel);

  const [dbType, setDbType] = useState('sqlite');
  const [path, setPath] = useState('');
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState('');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [database, setDatabase] = useState('');
  const [connectionString, setConnectionString] = useState('');
  const [querySql, setQuerySql] = useState('');
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const queryTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (activePanel === 'database' && connectionId) {refreshTables();}
  }, [activePanel, connectionId, refreshTables]);

  useEffect(() => {
    setRecentQueries(loadRecentQueries(connectionId));
  }, [connectionId]);

  async function handleConnect() {
    if (dbType === 'sqlite') {
      await connect({ type: 'sqlite', path: path.trim() || '.' });
    } else if (dbType === 'postgres') {
      if (connectionString.trim()) {
        await connect({ type: 'postgres', connectionString: connectionString.trim() });
      } else {
        await connect({
          type: 'postgres',
          host: host.trim() || 'localhost',
          port: port ? parseInt(port, 10) : 5432,
          user: user.trim(),
          password: password,
          database: database.trim() || 'postgres',
        });
      }
    } else if (dbType === 'mysql') {
      await connect({
        type: 'mysql',
        host: host.trim() || 'localhost',
        port: port ? parseInt(port, 10) : 3306,
        user: user.trim(),
        password: password,
        database: database.trim(),
      });
    }
  }

  function handleTableClick(tableName: string) {
    loadSchema(tableName);
    setQuerySql(`SELECT * FROM ${quoteIdent(tableName)} LIMIT 100`);
  }

  function quoteIdent(name: string) {
    if (connectionType === 'postgres') {return `"${String(name).replace(/"/g, '""')}"`;}
    if (connectionType === 'mysql') {return '`' + String(name).replace(/`/g, '``') + '`';}
    return `"${String(name).replace(/"/g, '""')}"`;
  }

  const runCurrentQuery = useCallback(() => {
    const textarea = queryTextareaRef.current;
    let sql = querySql.trim();
    if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
      sql = (querySql.slice(textarea.selectionStart, textarea.selectionEnd) || '').trim();
    }
    if (sql) {
      saveRecentQuery(connectionId, sql);
      setRecentQueries(loadRecentQueries(connectionId));
      runQuery(sql);
    }
  }, [connectionId, querySql, runQuery]);

  function exportResult(format: 'json' | 'csv') {
    if (!queryResult || !queryResult.rows?.length) {return;}
    const result = queryResult as QueryResult;
    const cols = result.columns;
    if (format === 'json') {
      const arr = result.rows.map((row) => {
        const rowCells = Array.isArray(row) ? row : [];
        const o: Record<string, unknown> = {};
        cols.forEach((c, i) => { o[c] = rowCells[i]; });
        return o;
      });
      const blob = new Blob([JSON.stringify(arr, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'query-result.json';
      a.click();
      URL.revokeObjectURL(a.href);
    } else {
      const header = cols.join(',');
      const escape = (v: unknown) => (v === null || v === undefined ? '' : String(v).replace(/"/g, '""'));
      const rows = result.rows.map((row) => {
        const rowCells = Array.isArray(row) ? row : [];
        return cols.map((_, i) => `"${escape(rowCells[i])}"`).join(',');
      });
      const csv = [header, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'query-result.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    }
  }

  return (
    <>
      <div className="sidebar-header">
        <span className="sidebar-title">DATABASE</span>
        <div className="sidebar-header-actions">
          {connectionId && (
            <>
              <button
                className="icon-btn"
                onClick={() => refreshTables()}
                disabled={loading}
                title="Refresh tables"
              >
                ↻
              </button>
              <button
                className="icon-btn"
                onClick={() => disconnect()}
                disabled={loading}
                title="Disconnect"
              >
                ✕
              </button>
            </>
          )}
        </div>
      </div>

      <div className="sidebar-body db-panel">
        {error && (
          <div className="db-error" style={{ background: 'var(--error-bg)', color: 'var(--error)', padding: '8px', borderRadius: 'var(--radius)', marginBottom: '8px' }}>
            {error}
          </div>
        )}

        {!connectionId ? (
          <div className="db-connect-form">
            <label style={{ display: 'block', marginBottom: '4px', color: 'var(--muted)', fontSize: '12px' }}>Type</label>
            <select
              value={dbType}
              onChange={(e) => setDbType(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                marginBottom: '10px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                borderRadius: 'var(--radius)',
              }}
            >
              {DB_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            {dbType === 'sqlite' && (
              <>
                <label style={{ display: 'block', marginBottom: '4px', color: 'var(--muted)', fontSize: '12px' }}>Path (relative to project)</label>
                <input
                  type="text"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="e.g. data/app.db"
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    marginBottom: '10px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    borderRadius: 'var(--radius)',
                  }}
                />
              </>
            )}

            {(dbType === 'postgres' || dbType === 'mysql') && (
              <>
                {dbType === 'postgres' && (
                  <>
                    <label style={{ display: 'block', marginBottom: '4px', color: 'var(--muted)', fontSize: '12px' }}>Connection string (optional)</label>
                    <input
                      type="text"
                      value={connectionString}
                      onChange={(e) => setConnectionString(e.target.value)}
                      placeholder="postgresql://user:pass@host:5432/db"
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        marginBottom: '10px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        borderRadius: 'var(--radius)',
                      }}
                    />
                  </>
                )}
                <label style={{ display: 'block', marginBottom: '4px', color: 'var(--muted)', fontSize: '12px' }}>Host</label>
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="localhost"
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    marginBottom: '8px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    borderRadius: 'var(--radius)',
                  }}
                />
                <label style={{ display: 'block', marginBottom: '4px', color: 'var(--muted)', fontSize: '12px' }}>Port</label>
                <input
                  type="text"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder={dbType === 'postgres' ? '5432' : '3306'}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    marginBottom: '8px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    borderRadius: 'var(--radius)',
                  }}
                />
                <label style={{ display: 'block', marginBottom: '4px', color: 'var(--muted)', fontSize: '12px' }}>User</label>
                <input
                  type="text"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    marginBottom: '8px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    borderRadius: 'var(--radius)',
                  }}
                />
                <label style={{ display: 'block', marginBottom: '4px', color: 'var(--muted)', fontSize: '12px' }}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    marginBottom: '8px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    borderRadius: 'var(--radius)',
                  }}
                />
                <label style={{ display: 'block', marginBottom: '4px', color: 'var(--muted)', fontSize: '12px' }}>Database</label>
                <input
                  type="text"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  placeholder={dbType === 'postgres' ? 'postgres' : ''}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    marginBottom: '10px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    borderRadius: 'var(--radius)',
                  }}
                />
              </>
            )}

            <button
              onClick={handleConnect}
              disabled={loading}
              style={{
                padding: '8px 14px',
                background: 'var(--accent)',
                color: 'var(--bg)',
                border: 'none',
                borderRadius: 'var(--radius)',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: '600',
              }}
            >
              {loading ? 'Connecting…' : 'Connect'}
            </button>
          </div>
        ) : (
          <div className="db-connected">
            <div className="db-tables-section">
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase' }}>Tables</div>
              {loading && tables.length === 0 && (
                <div aria-busy="true" style={{ padding: '4px 0' }}>
                  <Skeleton variant="text" style={{ width: '100%', marginBottom: 8, fontSize: '11px' }} />
                  <SkeletonGroup>
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} variant="text" style={{ width: i % 2 ? '80%' : '60%', marginBottom: 4 }} />
                    ))}
                  </SkeletonGroup>
                </div>
              )}
              <ul className="db-table-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {tables.map((t) => (
                  <li
                    key={t}
                    onClick={() => handleTableClick(t)}
                    style={{
                      padding: '4px 8px',
                      cursor: 'pointer',
                      borderRadius: 'var(--radius)',
                      background: selectedTable === t ? 'var(--accent-focus)' : 'transparent',
                      color: 'var(--text)',
                      fontSize: '13px',
                    }}
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="db-main-section" style={{ flex: 1, minWidth: 0 }}>
              {selectedTable && schema.length > 0 && (
                <div className="db-schema" style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Schema: {selectedTable}</div>
                  <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
                    {(schema as SchemaColumn[]).map((col) => (
                      <div key={col.name} style={{ padding: '2px 0' }}>
                        <span style={{ color: 'var(--accent)' }}>{col.name}</span>
                        <span style={{ color: 'var(--muted)', marginLeft: '8px' }}>{col.type}</span>
                        {col.nullable === false && <span style={{ color: 'var(--muted)', marginLeft: '4px' }}>NOT NULL</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="db-query-section" style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Query (SELECT only)</div>
                {recentQueries.length > 0 && (
                  <select
                    style={{ width: '100%', marginBottom: '6px', padding: '4px 8px', fontSize: '11px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 'var(--radius)' }}
                    value=""
                    onChange={(e) => { const v = e.target.value; if (v) {setQuerySql(v);} e.target.value = ''; }}
                  >
                    <option value="">Recent queries…</option>
                    {recentQueries.map((q, i) => (
                      <option key={i} value={q}>{q.slice(0, 60)}{q.length > 60 ? '…' : ''}</option>
                    ))}
                  </select>
                )}
                <textarea
                  ref={queryTextareaRef}
                  value={querySql}
                  onChange={(e) => setQuerySql(e.target.value)}
                  placeholder="SELECT * FROM table LIMIT 100"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    borderRadius: 'var(--radius)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    resize: 'vertical',
                  }}
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                  <button
                    onClick={runCurrentQuery}
                    disabled={loading || !querySql.trim()}
                    style={{
                      padding: '6px 12px',
                      background: 'var(--accent)',
                      color: 'var(--bg)',
                      border: 'none',
                      borderRadius: 'var(--radius)',
                      cursor: loading || !querySql.trim() ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    {loading ? 'Running…' : 'Run'}
                  </button>
                  <button
                    onClick={runCurrentQuery}
                    disabled={loading || !querySql.trim()}
                    title="Run selected text, or full query"
                    style={{
                      padding: '6px 12px',
                      background: 'var(--surface-light)',
                      color: 'var(--text)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      cursor: loading || !querySql.trim() ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    Run selection
                  </button>
                </div>
              </div>
              {queryResult && (
                <div className="db-results" style={{ marginTop: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase' }}>
                      Results ({queryResult.rows.length} rows)
                    </span>
                    <button
                      type="button"
                      onClick={() => exportResult('csv')}
                      style={{ padding: '2px 8px', fontSize: '11px', background: 'var(--surface-light)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer' }}
                    >
                      Export CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => exportResult('json')}
                      style={{ padding: '2px 8px', fontSize: '11px', background: 'var(--surface-light)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer' }}
                    >
                      Export JSON
                    </button>
                  </div>
                  <div
                    style={{
                      overflow: 'auto',
                      maxHeight: '280px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      background: 'var(--surface)',
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr>
                          {(queryResult as QueryResult).columns.map((c) => (
                            <th
                              key={c}
                              style={{
                                padding: '6px 8px',
                                textAlign: 'left',
                                borderBottom: '1px solid var(--border)',
                                background: 'var(--surface-light)',
                                color: 'var(--text-bright)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(queryResult as QueryResult).rows.map((row, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                            {(Array.isArray(row) ? row : []).map((cell: unknown, j: number) => (
                              <td
                                key={j}
                                style={{
                                  padding: '4px 8px',
                                  color: 'var(--text)',
                                  maxWidth: '200px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                                title={String(cell ?? '')}
                              >
                                {cell === null || cell === undefined ? 'NULL' : String(cell)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .db-panel { display: flex; flex-direction: column; height: 100%; }
        .db-connect-form { padding: 4px 0; }
        .db-connected { display: flex; gap: 12px; flex: 1; min-height: 0; overflow: hidden; }
        .db-tables-section { flex-shrink: 0; width: 140px; overflow-y: auto; border-right: 1px solid var(--border); padding-right: 8px; }
        .db-table-list li:hover { background: var(--surface-light) !important; }
        .db-main-section { overflow-y: auto; }
      `}</style>
    </>
  );
}
