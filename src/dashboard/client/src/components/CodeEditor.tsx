import { useEffect, useRef } from 'react';
import { CodeiumEditor } from '@codeium/react-code-editor';
import { useEditor } from '../context/EditorContext';
import { useLayout } from '../context/LayoutContext';
import { getMonacoLanguage, getMonacoThemeId, defineCustomMonacoThemes } from '../utils/editorUtils';
import { api } from '../api';
import { GitDiffViewer } from './GitDiffViewer';

type AnyEditor = {
  getModel: () => any;
  getPosition: () => any;
  addCommand: (...args: any[]) => void;
  executeEdits: (...args: any[]) => void;
  onDidChangeCursorPosition: (cb: (e: any) => void) => void;
  revealLineInCenter: (line: number) => void;
  setPosition: (p: { lineNumber: number; column: number }) => void;
  focus: () => void;
};
type AnyMonaco = any;

export function CodeEditor() {
  const {
    monacoEditorRef,
    activeTab,
    activeTabId,
    saveCurrentFile,
    updateTabContent,
    pendingGotoLineRef,
    setCursorPosition,
  } = useEditor();
  const { editorTheme, editorWordWrap, isMobile } = useLayout();
  const monacoRef = useRef<AnyMonaco>(null);
  const saveRef = useRef(saveCurrentFile);
  saveRef.current = saveCurrentFile;

  const monacoThemeId = getMonacoThemeId(editorTheme);

  useEffect(() => () => { monacoEditorRef.current = null; monacoRef.current = null; }, [monacoEditorRef]);

  // Apply dashboard theme to Monaco whenever the setting changes (or editor ref is ready)
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) {return;}
    defineCustomMonacoThemes(monaco);
    monaco.editor.setTheme(monacoThemeId);
  }, [monacoThemeId, editorTheme]);

  useEffect(() => {
    const editor = monacoEditorRef.current as AnyEditor | null;
    if (!editor || !activeTab) {return;}

    const line = pendingGotoLineRef.current;
    if (typeof line === 'number' && line > 0) {
      pendingGotoLineRef.current = null;
      editor.revealLineInCenter(line);
      editor.setPosition({ lineNumber: line, column: 1 });
      editor.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync editor on mount only when id changes
  }, [activeTab?.id, monacoEditorRef, pendingGotoLineRef]);

  const handleEditorMount = (editor: AnyEditor, monaco: AnyMonaco) => {
    monacoEditorRef.current = editor;
    monacoRef.current = monaco;
    defineCustomMonacoThemes(monaco);
    monaco.editor.setTheme(monacoThemeId);

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveRef.current?.();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Space, async () => {
      const model = editor.getModel();
      if (!model) {return;}
      const position = editor.getPosition();
      if (!position) {return;}
      const startLine = Math.max(1, position.lineNumber - 25);
      const lines = model.getLinesContent();
      const prompt = lines.slice(startLine - 1, position.lineNumber).join('\n')
        + model.getLineContent(position.lineNumber).slice(0, position.column - 1);
      const language = model.getLanguageId();
      try {
        const r = await api('/editor/complete', { method: 'POST', body: { prompt, language } });
        const data = await r.json();
        if (data.completion && typeof data.completion === 'string') {
          editor.executeEdits('ai-complete', [
            {
              range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
              text: data.completion,
            },
          ]);
        }
      } catch {}
    });

    editor.onDidChangeCursorPosition((e) => {
      setCursorPosition?.({ row: e.position.lineNumber, column: e.position.column });
    });
    setCursorPosition?.({ row: 1, column: 1 });

    // Run pending gotoLine (e.g. from search result click) now that editor is ready
    const line = pendingGotoLineRef.current;
    if (typeof line === 'number' && line > 0) {
      pendingGotoLineRef.current = null;
      editor.revealLineInCenter(line);
      editor.setPosition({ lineNumber: line, column: 1 });
      editor.focus();
    }
  };

  const handleChange = (value: string | undefined) => {
    if (activeTabId && value !== undefined) {
      updateTabContent(activeTabId, value);
    }
  };

  if (!activeTab) {
    return (
      <div className="editor-container editor-empty" style={{ flex: 1, minHeight: 100 }}>
        <div className="editor-empty-inner">
          <div className="editor-empty-icon" aria-hidden>⌨</div>
          <p className="editor-empty-text">Open a file from the explorer or use <kbd>Ctrl</kbd>+<kbd>P</kbd> to quick open.</p>
        </div>
      </div>
    );
  }

  if (activeTab.type === 'git-diff') {
    return (
      <div
        className="editor-container editor-git-diff-wrap"
        style={{
          flex: 1,
          minHeight: 100,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
        }}
      >
        <div className="editor-git-diff-body">
          <GitDiffViewer diff={activeTab.content ?? ''} />
        </div>
      </div>
    );
  }

  const activePath = activeTab.path ?? activeTab.name ?? 'untitled.txt';
  const language = getMonacoLanguage(activePath);

  return (
    <div className="editor-container" style={{ flex: 1, minHeight: 100 }}>
      <CodeiumEditor
        height="100%"
        path={activePath.replace(/\\/g, '/')}
        language={language}
        value={activeTab.content ?? ''}
        onChange={handleChange}
        onMount={handleEditorMount}
        theme={monacoThemeId}
        options={{
          fontSize: isMobile ? 16 : 14,
          fontFamily: 'JetBrains Mono, Cascadia Code, Fira Code, Consolas, monospace',
          fontLigatures: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: isMobile ? 'on' : (editorWordWrap ? 'on' : 'off'),
          automaticLayout: true,
          tabSize: 2,
          insertSpaces: true,
          rulers: [],
          renderLineHighlight: 'line',
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          bracketPairColorization: { enabled: true },
          stickyScroll: { enabled: !isMobile },
          padding: { top: isMobile ? 8 : 12, bottom: isMobile ? 8 : 12 },
          scrollbar: {
            verticalScrollbarSize: isMobile ? 12 : 10,
            horizontalScrollbarSize: isMobile ? 12 : 10,
            useShadows: false,
          },
          // AI / suggestion completion (Codeium + Monaco)
          quickSuggestions: {
            other: true,
            comments: false,
            strings: true,
          },
          suggest: {
            showKeywords: true,
            showSnippets: true,
            showMethods: true,
            showFunctions: true,
            showFields: true,
            showVariables: true,
            showClasses: true,
            showModules: true,
            showProperties: true,
            showWords: true,
            snippetsPreventQuickSuggestions: false,
          },
          inlineSuggest: {
            enabled: true,
            mode: 'subwordSmart',
            showToolbar: isMobile ? 'never' : 'onHover',
          },
          acceptSuggestionOnCommitCharacter: true,
          acceptSuggestionOnEnter: 'on',
          tabCompletion: 'on',
        }}
      />
    </div>
  );
}
