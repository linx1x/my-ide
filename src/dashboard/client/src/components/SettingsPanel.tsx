import { useState } from 'react';
import { useLayout } from '../context/LayoutContext';

const THEMES = [
  { id: 'tactical-dark', name: 'Tactical Dark', bg: '#0B0F14', accent: '#3B82F6', text: '#cbd5e1' },
  { id: 'vs-dark', name: 'VS Code Dark', bg: '#1e1e1e', accent: '#0e639c', text: '#d4d4d4' },
  { id: 'vs', name: 'VS Code Light', bg: '#ffffff', accent: '#006ab1', text: '#333333' },
  { id: 'matrix', name: 'Matrix', bg: '#0a0a0a', accent: '#33ff00', text: '#33ff00' },
  { id: 'cyberpunk', name: 'Cyberpunk', bg: '#0a0a0f', accent: '#00ff88', text: '#e0e0e0' },
  { id: 'hc-black', name: 'High Contrast', bg: '#000000', accent: '#4fc1ff', text: '#ffffff' },
  { id: 'glass', name: 'Glassmorphism', bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #4facfe 75%, #00f2fe 100%)', accent: '#6366F1', text: '#1A1A2E' },
  { id: 'living-canvas', name: 'Living Canvas', bg: '#050508', accent: '#648CFF', text: '#EDEDEF' },
];

export function SettingsPanel() {
  const { editorTheme, setEditorTheme, editorWordWrap, setEditorWordWrap } = useLayout();
  const [notifyWhenFinished, setNotifyWhenFinished] = useState(() => {
    try {
      return localStorage.getItem('chat_notify_finish') === '1';
    } catch {
      return false;
    }
  });

  const handleNotifyWhenFinishedChange = (checked: boolean) => {
    setNotifyWhenFinished(checked);
    try {
      localStorage.setItem('chat_notify_finish', checked ? '1' : '0');
    } catch {}
    if (checked && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  };

  return (
    <>
      <div className="sidebar-header">
        <span className="sidebar-title">SETTINGS</span>
      </div>
      <div className="sidebar-body settings-panel">
        <section className="settings-section">
          <h3 className="settings-section-title">Theme</h3>
          <div className="theme-grid">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                className={`theme-card ${editorTheme === theme.id ? 'active' : ''}`}
                onClick={() => setEditorTheme(theme.id)}
                title={theme.name}
              >
                <div
                  className="theme-swatch"
                  style={{
                    background: theme.bg,
                    borderColor: theme.accent,
                  }}
                >
                  <span className="theme-swatch-accent" style={{ background: theme.accent }} />
                  <span className="theme-swatch-text" style={{ color: theme.text }}>Aa</span>
                </div>
                <span className="theme-name">{theme.name}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="settings-section">
          <h3 className="settings-section-title">Editor</h3>
          <label className="settings-row">
            <span className="settings-label">Word wrap</span>
            <input
              type="checkbox"
              checked={!!editorWordWrap}
              onChange={(e) => setEditorWordWrap(e.target.checked)}
              className="settings-checkbox"
            />
          </label>
        </section>
        <section className="settings-section">
          <h3 className="settings-section-title">Chat</h3>
          <label className="settings-row">
            <span className="settings-label">Browser notification for dashboard events</span>
            <input
              type="checkbox"
              checked={!!notifyWhenFinished}
              onChange={(e) => handleNotifyWhenFinishedChange(e.target.checked)}
              className="settings-checkbox"
            />
          </label>
        </section>
      </div>
    </>
  );
}
