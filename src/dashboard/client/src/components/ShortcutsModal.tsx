import { useEffect } from 'react';

const SHORTCUTS = [
  { keys: 'Ctrl+Shift+P', desc: 'Command palette' },
  { keys: 'Ctrl+P', desc: 'Quick Open (files)' },
  { keys: 'Ctrl+S', desc: 'Save file' },
  { keys: 'Ctrl+W', desc: 'Close tab' },
  { keys: 'Ctrl+Shift+F', desc: 'Search in files' },
  { keys: 'Ctrl+Shift+E', desc: 'Explorer' },
  { keys: 'Ctrl+Shift+G', desc: 'Source Control' },
  { keys: 'Ctrl+`', desc: 'Toggle terminal' },
  { keys: '?', desc: 'Keyboard shortcuts' },
];

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  useEffect(() => {
    if (!open) {return;}
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {onClose();}
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) {return null;}

  return (
    <div
      className="project-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="project-modal shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Keyboard shortcuts</h3>
        <table className="shortcuts-table">
          <tbody>
            {SHORTCUTS.map(({ keys, desc }, i) => (
              <tr key={i}>
                <td className="shortcuts-keys">
                  <kbd>{keys}</kbd>
                </td>
                <td className="shortcuts-desc">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="project-modal-actions">
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
