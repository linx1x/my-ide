import { useRef, lazy, Suspense } from 'react';
import { useLayout } from '../context/LayoutContext';
import { useResizeHandle } from '../hooks/useResizeHandle';
import { ActivityBar } from './ActivityBar';
import { ExplorerPanel } from './ExplorerPanel';
import { SearchPanel } from './SearchPanel';
import { GitPanel } from './GitPanel';
import { DocsPanel } from './DocsPanel';
import { SettingsPanel } from './SettingsPanel';
import { WorkflowPanel } from './WorkflowPanel';
import { MorePanel } from './MorePanel';
import { AgentPanel } from './AgentPanel';
import { Skeleton, SkeletonGroup } from './Skeleton';

const LazyDatabasePanel = lazy(() => import('./DatabasePanel').then((m) => ({ default: m.DatabasePanel })));
const LazyN8nWorkflowsPanel = lazy(() => import('./N8nWorkflowsPanel').then((m) => ({ default: m.N8nWorkflowsPanel })));

function PanelFallback() {
  return (
    <div className="sidebar-panel-loading" style={{ padding: 12 }} aria-busy="true">
      <SkeletonGroup>
        <Skeleton variant="text" style={{ width: '80%' }} />
        <Skeleton variant="text" style={{ width: '60%' }} />
        <Skeleton variant="text" style={{ width: '70%' }} />
      </SkeletonGroup>
    </div>
  );
}

function SidebarPanels() {
  const { activePanel } = useLayout();
  return (
    <>
      <div className={`sidebar-panel ${activePanel === 'explorer' ? 'active' : ''}`}>
        <ExplorerPanel />
      </div>
      <div className={`sidebar-panel ${activePanel === 'search' ? 'active' : ''}`}>
        <SearchPanel />
      </div>
      <div className={`sidebar-panel ${activePanel === 'git' ? 'active' : ''}`}>
        <GitPanel />
      </div>
      <div className={`sidebar-panel ${activePanel === 'agent' ? 'active' : ''}`}>
        <AgentPanel />
      </div>
      <div className={`sidebar-panel ${activePanel === 'more' ? 'active' : ''}`}>
        <MorePanel />
      </div>
      <div className={`sidebar-panel ${activePanel === 'n8n-workflows' ? 'active' : ''}`}>
        <Suspense fallback={<PanelFallback />}>
          <LazyN8nWorkflowsPanel />
        </Suspense>
      </div>
      <div className={`sidebar-panel ${activePanel === 'workflow' ? 'active' : ''}`}>
        <WorkflowPanel />
      </div>
      <div className={`sidebar-panel ${activePanel === 'database' ? 'active' : ''}`}>
        <Suspense fallback={<PanelFallback />}>
          <LazyDatabasePanel />
        </Suspense>
      </div>
      <div className={`sidebar-panel ${activePanel === 'docs' ? 'active' : ''}`}>
        <DocsPanel />
      </div>
      <div className={`sidebar-panel ${activePanel === 'settings' ? 'active' : ''}`}>
        <SettingsPanel />
      </div>
    </>
  );
}

export function Sidebar({ onLogout: _onLogout }: { onLogout?: () => void }) {
  const { sidebarWidth, sidebarVisible, setSidebarWidth, isMobile, mobileSidebarOpen, setMobileSidebarOpen } = useLayout();
  const handleRef = useRef<HTMLDivElement | null>(null);

  useResizeHandle(
    handleRef,
    'horizontal',
    200,
    Math.floor(window.innerWidth * 0.55),
    setSidebarWidth,
    () => sidebarWidth
  );

  if (isMobile) {
    if (!sidebarVisible) {return null;}
    if (!mobileSidebarOpen) {return null;}
    return (
      <>
        <div className="mobile-sidebar-backdrop" onClick={() => setMobileSidebarOpen(false)} />
        <aside className="sidebar mobile-sidebar" style={{ width: '100vw' }}>
          <SidebarPanels />
        </aside>
      </>
    );
  }

  return (
    <>
      <div
        className={`sidebar-shell ${sidebarVisible ? 'sidebar-shell--open' : 'sidebar-shell--collapsed'}`}
        style={sidebarVisible ? { width: sidebarWidth } : undefined}
      >
        <ActivityBar />
        {sidebarVisible && (
          <aside className="sidebar sidebar--in-shell">
            <SidebarPanels />
          </aside>
        )}
      </div>
      {sidebarVisible && (
        <div
          ref={handleRef}
          className="resize-handle sidebar-resize"
          style={{ flexShrink: 0, width: 4, cursor: 'col-resize' }}
        />
      )}
    </>
  );
}
