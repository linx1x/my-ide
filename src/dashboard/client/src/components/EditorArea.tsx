import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FaPlay } from 'react-icons/fa';
import { motion } from 'motion/react';
import { useLayout } from '../context/LayoutContext';
import { useEditor } from '../context/EditorContext';
import { useResizeHandle } from '../hooks/useResizeHandle';
import { usePreview } from '../hooks/usePreview';
import { TabBar } from './TabBar';
import { CodeEditor } from './CodeEditor';
import { Terminal } from './Terminal';
import { api } from '../api';

function getMaxTerminalHeight() {
  return Math.floor(window.innerHeight * 0.7);
}

export function EditorArea() {
  const { terminalOpen, terminalHeight, setTerminalHeight, setActivePanel, editorWordWrap, setEditorWordWrap, editorTheme, terminalInjectRef, editorView, setEditorView, isMobile } = useLayout();
  const { previewUrl, loading: previewLoading, error: previewError, statusMsg: previewStatusMsg, hasProject, start: startPreview, stop: stopPreview } = usePreview();
  const {
    tabs,
    activeTabId,
    activeTab,
    viewMode,
    editorPath,
    isDirty,
    closeTab,
    activateTab,
    saveCurrentFile,
    diffContent,
    openWebTab,
  } = useEditor();
  const resizeHandleRef = useRef(null);
  const [maxTerminalHeight, setMaxTerminalHeight] = useState(getMaxTerminalHeight);

  const n8nStatusQuery = useQuery({
    queryKey: ['n8n', 'status'],
    queryFn: async () => {
      const r = await api('/n8n/status');
      const data = await r.json().catch(() => ({}));
      return data;
    },
    enabled: viewMode === 'web' && activeTab?.webId === 'n8n',
    retry: false,
  });
  const n8nStatus = n8nStatusQuery.data ?? (n8nStatusQuery.isError ? { reachable: false, error: 'n8n status unavailable' } : null);

  useEffect(() => {
    const onResize = () => setMaxTerminalHeight(getMaxTerminalHeight());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (activeTab?.type === 'git-diff') {
      setEditorView('code');
    }
  }, [activeTab?.id, activeTab?.type, setEditorView]);

  useResizeHandle(
    resizeHandleRef,
    'vertical',
    100,
    maxTerminalHeight,
    setTerminalHeight,
    () => terminalHeight,
  );

  return (
    <div className="editor-area">
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onActivate={activateTab}
        onClose={closeTab}
      />
      <div className="editor-header">
        <div className="editor-path">
          {editorPath ? (
            editorPath.split('/').map((p, i, parts) => (
              <span key={i}>
                <span
                  className="path-segment"
                  title={parts.slice(0, i + 1).join('/')}
                  onClick={() =>
                    i < parts.length - 1 && setActivePanel('explorer')
                  }
                  role={i < parts.length - 1 ? 'button' : undefined}
                  tabIndex={i < parts.length - 1 ? 0 : undefined}
                  onKeyDown={(e) =>
                    i < parts.length - 1 &&
                    (e.key === 'Enter' || e.key === ' ') &&
                    setActivePanel('explorer')
                  }
                  style={
                    i < parts.length - 1 ? { cursor: 'pointer' } : undefined
                  }
                >
                  {p}
                </span>
                {i < parts.length - 1 && <span className="path-sep">/</span>}
              </span>
            ))
          ) : (
            <span className="path-breadcrumb">
              Open a file to start editing!?
            </span>
          )}
        </div>
        {viewMode === 'editor' && (
          <div className="editor-actions">
            <button
              type="button"
              className="editor-toolbar-btn"
              onClick={() => { startPreview(); setEditorView('preview'); }}
              disabled={!hasProject || previewLoading}
              title={hasProject ? 'Run preview' : 'Select a project to preview'}
              aria-label="Run preview"
            >
              <FaPlay />
            </button>
            <button
              type="button"
              className={`editor-toolbar-btn ${editorWordWrap ? 'active' : ''}`}
              onClick={() => setEditorWordWrap(!editorWordWrap)}
              title="Toggle word wrap"
              aria-pressed={editorWordWrap}
            >
              Wrap
            </button>
            {isDirty && <span className="unsaved-badge">Modified</span>}
            <button
              className="save-btn"
              disabled={!isDirty}
              onClick={saveCurrentFile}
            >
              Save
            </button>
          </div>
        )}
      </div>

      {viewMode === 'welcome' && (
        <div className="welcome-screen">
          <motion.div
            className="welcome-content"
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
              hidden: {},
            }}
          >
            <motion.h2
              variants={{ visible: { opacity: 1, y: 0 }, hidden: { opacity: 0, y: 8 } }}
              transition={{ duration: 0.2 }}
            >
              My IDE
            </motion.h2>
            <motion.p
              variants={{ visible: { opacity: 1, y: 0 }, hidden: { opacity: 0, y: 8 } }}
              transition={{ duration: 0.2 }}
            >
              A project dashboard: open a workspace, inspect files, manage source control, run previews, and launch tools.
            </motion.p>
            <motion.div
              className="welcome-journey"
              variants={{ visible: { opacity: 1, y: 0 }, hidden: { opacity: 0, y: 8 } }}
              transition={{ duration: 0.2 }}
            >
              <button type="button" onClick={() => setActivePanel('explorer')}>
                <strong>Inspect</strong>
                <span>Browse files, open tabs, and review edits.</span>
              </button>
              <button type="button" onClick={() => void startPreview()}>
                <strong>Preview</strong>
                <span>Run the active project when it has a dev server.</span>
              </button>
              <button type="button" onClick={() => setActivePanel('more')}>
                <strong>Automate</strong>
                <span>Use n8n, files, source control, and ops panels.</span>
              </button>
            </motion.div>
            <motion.div
              className="shortcut-list"
              variants={{ visible: { opacity: 1, y: 0 }, hidden: { opacity: 0, y: 8 } }}
              transition={{ duration: 0.2 }}
            >
              <div><kbd>Ctrl</kbd>+<kbd>P</kbd> Quick Open</div>
              <div><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> Commands</div>
              <div><kbd>Ctrl</kbd>+<kbd>`</kbd> Terminal</div>
            </motion.div>
            <motion.button
              type="button"
              className="welcome-n8n-link"
              onClick={() => openWebTab({ id: 'n8n', title: 'n8n', url: '/n8n/', icon: 'n8n' })}
              variants={{ visible: { opacity: 1, y: 0 }, hidden: { opacity: 0, y: 8 } }}
              transition={{ duration: 0.2 }}
            >
              Open n8n workspace
            </motion.button>
          </motion.div>
        </div>
      )}

      {viewMode === 'editor' && (
        <>
          <div className="editor-view-tabs">
            <button
              type="button"
              className={`editor-view-tab ${editorView === 'code' ? 'active' : ''}`}
              onClick={() => setEditorView('code')}
            >
              Code
            </button>
            <button
              type="button"
              className={`editor-view-tab ${editorView === 'preview' ? 'active' : ''}`}
              onClick={() => setEditorView('preview')}
            >
              Preview
            </button>
          </div>
          <div
            className="editor-container"
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {editorView === 'code' && <CodeEditor />}
            {editorView === 'preview' && (
              <div className="preview-panel-body" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
                {!hasProject && (
                  <div className="preview-panel-empty">
                    <p>No active project. Select or add a project to run its dev server.</p>
                  </div>
                )}
                {hasProject && previewLoading && !previewUrl && (
                  <div className="preview-panel-empty">
                    <p>{previewStatusMsg || 'Preparing project and starting preview…'}</p>
                  </div>
                )}
                {hasProject && !previewUrl && !previewLoading && (
                  <div className="preview-panel-empty">
                    <p>Run the dev server in the dashboard Terminal to preview the app here.</p>
                    <p className="preview-panel-hint">Click the play button in the top bar to run <code>npm run dev</code> (or pnpm/yarn) in the project directory.</p>
                  </div>
                )}
                {previewError && (
                  <div className="preview-panel-error">
                    <p>{previewError}</p>
                  </div>
                )}
                {previewUrl && (
                  <>
                    <div className="preview-panel-header" style={{ flexShrink: 0, display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px' }}>
                      <button
                        type="button"
                        className="preview-panel-btn"
                        onClick={() => window.open(`${typeof window !== 'undefined' ? window.location.origin : ''}${previewUrl}`, '_blank', 'noopener,noreferrer')}
                      >
                        Open in browser
                      </button>
                      <button type="button" className="preview-panel-btn" onClick={stopPreview} disabled={previewLoading}>
                        Stop
                      </button>
                    </div>
                    <p className="preview-panel-hint preview-panel-wait" style={{ flexShrink: 0, margin: '0 12px 8px' }}>Waiting for dev server… (see Terminal below)</p>
                    <iframe
                      title="App preview"
                      src={previewUrl}
                      className="preview-panel-iframe"
                      sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads"
                      style={{ flex: 1, minHeight: 200 }}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {viewMode === 'image' && editorPath && (
        <div
          className="screenshot-preview"
          style={{
            padding: 12,
            background: 'var(--surface)',
            flex: 1,
            overflow: 'auto',
          }}
        >
          <img
            src={`/api/files/raw?path=${encodeURIComponent(editorPath)}`}
            alt={editorPath}
            style={{ maxWidth: '100%', borderRadius: 4 }}
          />
        </div>
      )}

      {viewMode === 'diff' && (
        <div
          className="file-viewer-diff"
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 12,
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            whiteSpace: 'pre-wrap',
            color: 'var(--text)',
            background: 'var(--surface)',
          }}
        >
          {diffContent}
        </div>
      )}

      {viewMode === 'web' && activeTab?.type === 'web' && (
        <div className="web-tab-view">
          {activeTab.webId === 'n8n' && (
            <div className="web-tab-toolbar">
              <span className={`web-status ${n8nStatus?.reachable ? 'ok' : 'bad'}`}>
                {n8nStatus?.reachable ? 'n8n online' : 'n8n offline'}
              </span>
              <button
                className="command-btn"
                onClick={() => window.open(activeTab.url, '_blank', 'noopener,noreferrer')}
                title="Open n8n in new browser tab"
              >
                Open n8n
              </button>
              <button
                className="command-btn"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(window.location.origin + activeTab.url);
                  } catch {}
                }}
                title="Copy n8n URL"
              >
                Copy URL
              </button>
              <button
                className="command-btn"
                onClick={() => {
                  const frame = document.getElementById(`web-frame-${activeTab.id}`) as HTMLIFrameElement | null;
                  if (frame) {frame.src = activeTab.url ?? '';}
                }}
                title="Reload embedded n8n"
              >
                Reload
              </button>
              {n8nStatus?.error ? <span className="web-error">{n8nStatus.error}</span> : null}
            </div>
          )}
          <iframe
            id={`web-frame-${activeTab.id}`}
            className="web-tab-frame"
            src={activeTab.url}
            title={activeTab.name || 'Embedded web app'}
          />
        </div>
      )}

      {terminalOpen && (
        <div className="terminal-block">
          <div
            ref={resizeHandleRef}
            className="resize-handle terminal-resize"
            style={{ height: 8, cursor: 'row-resize' }}
            aria-label="Resize terminal"
          />
          <div className="terminal-panel" style={{ height: terminalHeight }}>
            <Terminal
              ref={terminalInjectRef}
              wsPath="/ws/terminal"
              fontSize={isMobile ? 15 : 14}
              visible={terminalOpen}
              themeKey={editorTheme || ''}
            />
          </div>
        </div>
      )}
    </div>
  );
}
