import { useEffect } from 'react';
import { useLayout } from '../context/LayoutContext';
import { useEditor } from '../context/EditorContext';

export function useKeyboardShortcuts() {
  const { setActivePanel, toggleTerminal, setQuickOpenOpen, setShortcutsOpen, setCommandPaletteOpen } = useLayout();
  const { saveCurrentFile, closeTab, activeTabId } = useEditor();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (e.key === '?' && !ctrl && !e.altKey && !e.shiftKey) {
        const target = e.target;
        if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) {
          e.preventDefault();
          setShortcutsOpen?.(true);
        }
        return;
      }

      if (ctrl && e.key === 'p' && !e.shiftKey) {
        e.preventDefault();
        setQuickOpenOpen(true);
      }
      if (ctrl && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      if (ctrl && e.key === 's') {
        e.preventDefault();
        saveCurrentFile?.();
      }
      if (ctrl && e.key === 'w') {
        e.preventDefault();
        if (activeTabId) {closeTab?.(activeTabId);}
      }
      if (ctrl && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setActivePanel('search');
        setTimeout(() => document.getElementById('search-input')?.focus(), 50);
      }
      if (ctrl && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        setActivePanel('explorer');
      }
      if (ctrl && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        setActivePanel('git');
      }
      if (ctrl && e.key === '`') {
        e.preventDefault();
        toggleTerminal();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setActivePanel, toggleTerminal, setQuickOpenOpen, setShortcutsOpen, setCommandPaletteOpen, saveCurrentFile, closeTab, activeTabId]);
}
