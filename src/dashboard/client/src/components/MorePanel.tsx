import { useLayout } from '../context/LayoutContext';
import { useEditor } from '../context/EditorContext';
import type { ReactNode } from 'react';

type MoreItem = { id: MoreItemId; label: string; icon: IconKey; hint?: string };
type MoreSection = { title: string; intro: string; items: MoreItem[] };

const SECTIONS: MoreSection[] = [
  {
    title: 'Start Here',
    intro: 'Setup, preferences, and the operating guide.',
    items: [
      { id: 'settings', label: 'Settings', icon: 'settings', hint: 'Theme, editor, and runtime preferences' },
      { id: 'agent', label: 'Agent Chat', icon: 'agent', hint: 'Mastra-powered assistant (when AGENT_CHAT_ENABLED=1)' },
      { id: 'docs', label: 'How It Works', icon: 'docs', hint: 'Commands, setup, and safety notes' },
    ],
  },
  {
    title: 'Automations',
    intro: 'Manage workflow and repository integrations.',
    items: [
      { id: 'n8n', label: 'n8n Workspace', icon: 'n8n', hint: 'Open the embedded automation canvas' },
      { id: 'n8n-workflows', label: 'Workflow Library', icon: 'n8n', hint: 'Import, export, and inspect n8n workflows' },
      { id: 'workflow', label: 'GitHub Workflow', icon: 'workflow', hint: 'PRs, CI, and branch automation' },
    ],
  },
  {
    title: 'Operations',
    intro: 'Inspect runtime data and production signals.',
    items: [
      { id: 'database', label: 'Database', icon: 'database', hint: 'Browse configured database connections' },
    ],
  },
];
type MoreItemId = 'settings' | 'workflow' | 'n8n' | 'n8n-workflows' | 'database' | 'docs' | 'agent';
type IconKey = 'settings' | 'workflow' | 'n8n' | 'database' | 'docs' | 'agent';

const icons: Record<IconKey, ReactNode> = {
  settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .32 1.76l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.6 1.6 0 0 0-1.76-.32 1.6 1.6 0 0 0-.97 1.47V21a2 2 0 0 1-4 0v-.09a1.6 1.6 0 0 0-.97-1.47 1.6 1.6 0 0 0-1.76.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.6 1.6 0 0 0 .32-1.76 1.6 1.6 0 0 0-1.47-.97H3a2 2 0 0 1 0-4h.09a1.6 1.6 0 0 0 1.47-.97 1.6 1.6 0 0 0-.32-1.76l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.6 1.6 0 0 0 1.76.32h.01a1.6 1.6 0 0 0 .96-1.47V3a2 2 0 0 1 4 0v.09a1.6 1.6 0 0 0 .97 1.47 1.6 1.6 0 0 0 1.76-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.6 1.6 0 0 0-.32 1.76v.01a1.6 1.6 0 0 0 1.47.96H21a2 2 0 0 1 0 4h-.09a1.6 1.6 0 0 0-1.47.97z" />
    </svg>
  ),
  workflow: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 6h16M4 12h10M4 18h6" strokeLinecap="round" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="18" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  ),
  n8n: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M8 9h8M8 13h5" strokeLinecap="round" />
    </svg>
  ),
  database: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    </svg>
  ),
  docs: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  agent: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 15a4 4 0 0 1-4 4H7l-4 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8z" strokeLinecap="round" />
      <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
};

export function MorePanel() {
  const { setActivePanel } = useLayout();
  const { openWebTab } = useEditor();

  const handleClick = (id: MoreItemId) => {
    if (id === 'n8n') {
      openWebTab({ id: 'n8n', title: 'n8n', url: '/n8n/', icon: 'n8n' });
      return;
    }
    setActivePanel(id);
  };

  return (
    <>
      <div className="sidebar-header">
        <span className="sidebar-title">AUTOMATIONS</span>
      </div>
      <div className="sidebar-body">
        <p className="more-panel-intro">
          The advanced surfaces are grouped by job so workflow and ops tools do not compete with the main IDE flow.
        </p>
        {SECTIONS.map((section) => (
          <section key={section.title} className="more-panel-section">
            <div className="more-panel-section-header">
              <span className="more-panel-section-title">{section.title}</span>
              <span className="more-panel-section-intro">{section.intro}</span>
            </div>
            <ul className="more-panel-list">
              {section.items.map(({ id, label, icon: iconKey, hint }) => (
                <li key={id}>
                  <button
                    type="button"
                    className="more-panel-item"
                    onClick={() => handleClick(id)}
                  >
                    <span className="more-panel-icon">{icons[iconKey]}</span>
                    <span className="more-panel-item-text">
                      <span className="more-panel-item-label">{label}</span>
                      {hint && <span className="more-panel-item-hint">{hint}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
