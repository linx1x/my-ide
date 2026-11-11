import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { FolderTree, Search, GitBranch, Workflow, Terminal, MessageSquare } from 'lucide-react';
import { useLayout } from '../context/LayoutContext';

const S = 20;
const STROKE = 1.75;

type ToolbarItem =
  | { kind: 'panel'; id: string; Icon: LucideIcon; title: string }
  | { kind: 'terminal'; id: string; Icon: LucideIcon; title: string };

const TOOLBAR_ITEMS: ToolbarItem[] = [
  { kind: 'panel', id: 'explorer', Icon: FolderTree, title: 'Explorer (Ctrl+Shift+E)' },
  { kind: 'panel', id: 'search', Icon: Search, title: 'Search (Ctrl+Shift+F)' },
  { kind: 'panel', id: 'git', Icon: GitBranch, title: 'Source Control (Ctrl+Shift+G)' },
  { kind: 'panel', id: 'agent', Icon: MessageSquare, title: 'Agent chat' },
  { kind: 'panel', id: 'more', Icon: Workflow, title: 'Automations and Integrations' },
  { kind: 'terminal', id: 'terminal', Icon: Terminal, title: 'Toggle Terminal (Ctrl+`)' },
];

function ToolbarIcon({ Icon }: { Icon: LucideIcon }) {
  return (
    <motion.span
      className="activity-lucide-wrap"
      whileHover={{
        scale: 1.12,
        y: -1,
        transition: { type: 'spring', stiffness: 420, damping: 18 },
      }}
      whileTap={{ scale: 0.88 }}
    >
      <Icon size={S} strokeWidth={STROKE} aria-hidden />
    </motion.span>
  );
}

export function ActivityBar() {
  const { activePanel, sidebarVisible, setActivePanel, toggleTerminal, terminalOpen } = useLayout();

  const isPanelActive = (id: string) => activePanel === id && sidebarVisible;

  return (
    <aside className="activity-bar activity-bar--top activity-bar--icons-only">
      <div className="activity-top-nav__float">
        <nav className="activity-top-nav__row" role="toolbar" aria-label="Sidebar and terminal">
          {TOOLBAR_ITEMS.map((item) => {
            const active =
              item.kind === 'panel'
                ? isPanelActive(item.id)
                : terminalOpen;
            return (
              <button
                key={item.id}
                type="button"
                className={`activity-btn activity-btn-top ${active ? 'active' : ''}`}
                title={item.title}
                aria-label={item.title}
                aria-pressed={active}
                onClick={() => {
                  if (item.kind === 'panel') {
                    setActivePanel(item.id);
                  } else {
                    toggleTerminal();
                  }
                }}
              >
                <ToolbarIcon Icon={item.Icon} />
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
