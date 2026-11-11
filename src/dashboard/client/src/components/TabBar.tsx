import * as Tabs from '@radix-ui/react-tabs';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { getFileIcon } from '../utils/fileIcons';

type EditorTab = {
  id?: string;
  name?: string;
  type?: string;
  content?: string;
  originalContent?: string;
  gitPath?: string;
  path?: string;
};

export function TabBar({ tabs, activeTabId, onActivate, onClose }: { tabs: EditorTab[]; activeTabId?: string | null; onActivate: (id: string) => void; onClose: (id: string) => void }) {
  if (tabs.length === 0) {return null;}

  const value = activeTabId ?? tabs[0]?.id ?? '';

  return (
    <Tabs.Root
      className="tab-bar"
      value={value}
      onValueChange={(id) => id && onActivate(id)}
    >
      <Tabs.List className="tab-list">
        {tabs.map((tab: EditorTab, i: number) => {
          const isWeb = tab.type === 'web';
          const isGitDiff = tab.type === 'git-diff';
          const isCreateProject = tab.type === 'create-project';
          const isDirty = !isWeb && !isGitDiff && !isCreateProject && tab.content !== tab.originalContent;
          const iconSource =
            isGitDiff && tab.gitPath
              ? tab.gitPath.replace(/\\/g, '/').split('/').pop()
              : tab.name;
          const fileInfo = isWeb
            ? { icon: '🌐', color: 'var(--accent)' }
            : isCreateProject
              ? { icon: '📁', color: 'var(--accent)' }
              : getFileIcon(iconSource ?? '', false);
          return (
            <Tabs.Trigger
              key={tab.id ?? tab.path ?? `tab-${i}`}
              value={tab.id ?? tab.path ?? ''}
              onMouseDown={(e: ReactMouseEvent) => {
                if (e.button === 1) {
                  e.preventDefault();
                  if (tab.id) {onClose(tab.id);}
                }
              }}
              asChild
            >
              <div
                className={`tab-item ${tab.id === activeTabId ? 'active' : ''} ${isDirty ? 'modified' : ''} ${isGitDiff ? 'git-diff-tab' : ''}`}
              >
                <span className="tab-icon" style={{ color: fileInfo.color }}>
                  {fileInfo.icon}
                </span>
                <span className="tab-name" title={isGitDiff ? tab.gitPath : tab.path}>
                  {tab.name ?? tab.path ?? 'Untitled'}
                </span>
                <button
                  type="button"
                  className="tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (tab.id) {onClose(tab.id);}
                  }}
                  title="Close"
                  aria-label="Close tab"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                    <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </Tabs.Trigger>
          );
        })}
      </Tabs.List>
    </Tabs.Root>
  );
}
