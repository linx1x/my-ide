import * as React from 'react';
import { Skeleton, SkeletonGroup } from './Skeleton';

const ACTIVITY_TOP_ICONS = 5;
const SIDEBAR_ROWS = 8;
const WELCOME_ROWS = 5;

const activityBtnStyle: React.CSSProperties = {
  width: 'var(--activity-top-btn-size)',
  height: 'var(--activity-top-btn-size)',
  borderRadius: 6,
  flexShrink: 0,
};

/**
 * Full-viewport shell that mirrors IDELayout (sidebar-shell: top activity row + panel,
 * editor welcome state, status bar; mobile: full main + bottom nav).
 */
export function AppLoadingSkeleton() {
  return (
    <div className="ide-layout tactical-app app-loading-shell" aria-busy="true" aria-label="Loading workspace">
      <div className="workspace-shell">
        <div className="workspace-content-row app-loading-row">
          <div className="app-loading-sidebar-shell">
            <div className="app-loading-activity-top" aria-hidden="true">
              <div className="app-loading-activity-top__float">
                {Array.from({ length: ACTIVITY_TOP_ICONS }, (_, i) => (
                  <Skeleton key={`a-${i}`} variant="rect" style={activityBtnStyle} />
                ))}
              </div>
            </div>
            <aside className="app-loading-sidebar" aria-hidden="true">
              <div className="app-loading-sidebar-header">
                <Skeleton variant="text" style={{ width: '45%', height: 11, maxWidth: 120 }} />
                <Skeleton variant="rect" width={18} height={18} style={{ borderRadius: 4, flexShrink: 0 }} />
              </div>
              <SkeletonGroup className="app-loading-tree">
                {Array.from({ length: SIDEBAR_ROWS }, (_, i) => (
                  <div key={i} className="app-loading-tree-row">
                    <Skeleton variant="rect" width={14} height={14} style={{ flexShrink: 0 }} />
                    <Skeleton
                      variant="text"
                      style={{
                        flex: 1,
                        maxWidth: i % 3 === 0 ? '88%' : i % 3 === 1 ? '72%' : '64%',
                        height: 11,
                      }}
                    />
                  </div>
                ))}
              </SkeletonGroup>
            </aside>
          </div>
          <div className="app-loading-resize-gutter" aria-hidden="true" />
          <div className="app-loading-main">
            <div className="app-loading-editor-header" aria-hidden="true">
              <Skeleton variant="text" style={{ flex: 1, maxWidth: '55%', height: 12 }} />
              <div className="app-loading-editor-header-actions">
                <Skeleton variant="rect" width={28} height={28} style={{ borderRadius: 6, flexShrink: 0 }} />
                <Skeleton variant="rect" width={44} height={28} style={{ borderRadius: 6, flexShrink: 0 }} />
                <Skeleton variant="rect" width={52} height={28} style={{ borderRadius: 6, flexShrink: 0 }} />
              </div>
            </div>
            <div className="app-loading-welcome" aria-hidden="true">
              <div className="app-loading-welcome-inner">
                <Skeleton variant="text" style={{ width: 120, height: 18, marginBottom: 12 }} />
                <Skeleton variant="text" style={{ width: 'min(320px, 85%)', height: 12, marginBottom: 20 }} />
                <SkeletonGroup className="app-loading-welcome-lines">
                  {Array.from({ length: WELCOME_ROWS }, (_, i) => (
                    <Skeleton
                      key={i}
                      variant="text"
                      style={{
                        width: i === 0 ? '72%' : i === 1 ? '88%' : i === 2 ? '64%' : i === 3 ? '76%' : '52%',
                        height: 11,
                      }}
                    />
                  ))}
                </SkeletonGroup>
              </div>
            </div>
            <div className="app-loading-statusbar" aria-hidden="true">
              <div className="app-loading-statusbar-left">
                <Skeleton variant="text" style={{ width: 72, height: 11, flexShrink: 0 }} />
                <Skeleton variant="text" style={{ width: 88, height: 11, flexShrink: 0 }} />
                <Skeleton variant="text" style={{ width: 96, height: 11, flexShrink: 0, maxWidth: '28vw' }} />
              </div>
              <div className="app-loading-statusbar-right">
                <Skeleton variant="text" style={{ width: 56, height: 11 }} />
                <Skeleton variant="text" style={{ width: 48, height: 11 }} />
                <Skeleton variant="text" style={{ width: 40, height: 11 }} />
              </div>
            </div>
          </div>
        </div>
      </div>
      <nav className="app-loading-bottom-nav" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="app-loading-bottom-nav-slot">
            <Skeleton variant="rect" width={22} height={22} style={{ borderRadius: 6, margin: '0 auto' }} />
          </div>
        ))}
      </nav>
    </div>
  );
}
