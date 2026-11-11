import { useEditor } from '../context/EditorContext';
import { useLayout } from '../context/LayoutContext';
import { useStatus } from '../hooks/useStatus';

export function ContextStrip() {
  const {
    activeProjectName,
    branch,
    workdir,
  } = useStatus();
  const { activePanel, terminalOpen } = useLayout();
  const { viewMode, activeTab } = useEditor();

  const projectLabel =
    activeProjectName ||
    (workdir ? workdir.split(/[/\\]/).pop() || workdir : 'No project');
  const activeSurface =
    viewMode === 'web' && activeTab?.type === 'web'
      ? activeTab.name || (typeof activeTab.title === 'string' ? activeTab.title : '') || 'Web tab'
      : viewMode === 'editor' && activeTab
        ? activeTab.name || activeTab.path || 'Editor'
        : 'Welcome';

  return (
    <section className="context-strip" aria-label="Active workspace context">
      <div className="context-strip__journey" aria-label="Primary workflow">
        <span>Open project</span>
        <span>Inspect</span>
        <span>Preview</span>
      </div>
      <div className="context-strip__signals">
        <span className="context-chip" title={workdir || undefined}>
          {projectLabel}
        </span>
        <span className="context-chip" title={branch ? `Branch: ${branch}` : 'No branch'}>
          {branch || 'no branch'}
        </span>
        <span className="context-chip">
          {activePanel} / {activeSurface}
        </span>
        {terminalOpen && <span className="context-chip">Terminal open</span>}
      </div>
    </section>
  );
}
