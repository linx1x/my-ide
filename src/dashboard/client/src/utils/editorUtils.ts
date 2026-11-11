/** Maps dashboard editorTheme (from settings) to Monaco theme id */
export const MONACO_THEME_MAP: Record<string, string> = {
  'tactical-dark': 'tactical-dark',
  'cursor-dark': 'tactical-dark',
  matrix: 'matrix',
  cyberpunk: 'cyberpunk',
  'vs-dark': 'vs-dark',
  vs: 'vs',
  'hc-black': 'hc-black',
  glass: 'vs-dark',
  'living-canvas': 'vs-dark',
};

export function getMonacoThemeId(editorTheme: string): string {
  return MONACO_THEME_MAP[editorTheme] ?? 'tactical-dark';
}

/** Register custom Monaco themes (call with monaco instance from editor onMount). */
type MonacoThemeDefiner = {
  editor: {
    defineTheme: (themeName: string, data: unknown) => void;
  };
};

export function defineCustomMonacoThemes(monaco: unknown): void {
  if (!monaco || typeof monaco !== 'object' || !('editor' in monaco)) {
    return;
  }
  const monacoApi = monaco as MonacoThemeDefiner;
  monacoApi.editor.defineTheme('tactical-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '4f5b70', fontStyle: 'italic' },
      { token: 'keyword', foreground: '81a7e7' },
      { token: 'string', foreground: '9fd4b5' },
      { token: 'number', foreground: '7db1f8' },
      { token: 'type', foreground: '99b6e8' },
      { token: 'class', foreground: '99b6e8' },
      { token: 'function', foreground: '83b1ff' },
      { token: 'variable', foreground: 'c8d4ea' },
      { token: 'operator', foreground: '7ea4df' },
      { token: 'delimiter', foreground: 'b7c4da' },
    ],
    colors: {
      'editor.background': '#111827',
      'editor.foreground': '#cbd5e1',
      'editorLineNumber.foreground': '#5b6476',
      'editorLineNumber.activeForeground': '#93a4c0',
      'editor.selectionBackground': '#2b4f7f66',
      'editor.lineHighlightBackground': '#1a1f2b',
      'editorCursor.foreground': '#3B82F6',
      'editorIndentGuide.background1': '#232938',
      'editorIndentGuide.activeBackground1': '#2d3850',
    },
  });
  monacoApi.editor.defineTheme('matrix', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '1f521f', fontStyle: 'italic' },
      { token: 'keyword', foreground: '33ff00' },
      { token: 'string', foreground: '33ff00' },
      { token: 'number', foreground: 'ffb000' },
      { token: 'type', foreground: '33ff00' },
      { token: 'class', foreground: '33ff00' },
      { token: 'function', foreground: '33ff00' },
      { token: 'variable', foreground: '33ff00' },
      { token: 'operator', foreground: '33ff00' },
      { token: 'delimiter', foreground: '1f521f' },
    ],
    colors: {
      'editor.background': '#0a0a0a',
      'editor.foreground': '#33ff00',
      'editorLineNumber.foreground': '#1f521f',
      'editorLineNumber.activeForeground': '#33ff00',
      'editor.selectionBackground': 'rgba(51, 255, 0, 0.25)',
      'editor.lineHighlightBackground': '#0d150d',
      'editorCursor.foreground': '#33ff00',
      'editorIndentGuide.background1': '#1f521f',
      'editorIndentGuide.activeBackground1': '#33ff00',
    },
  });
  monacoApi.editor.defineTheme('cyberpunk', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
      { token: 'keyword', foreground: '00ff88' },
      { token: 'string', foreground: '00d4ff' },
      { token: 'number', foreground: 'ff00ff' },
      { token: 'type', foreground: '00ff88' },
      { token: 'class', foreground: '00ff88' },
      { token: 'function', foreground: '00ff88' },
      { token: 'variable', foreground: 'e0e0e0' },
      { token: 'operator', foreground: '00d4ff' },
      { token: 'delimiter', foreground: '2a2a3a' },
    ],
    colors: {
      'editor.background': '#0a0a0f',
      'editor.foreground': '#e0e0e0',
      'editorLineNumber.foreground': '#2a2a3a',
      'editorLineNumber.activeForeground': '#00ff88',
      'editor.selectionBackground': 'rgba(0, 255, 136, 0.25)',
      'editor.lineHighlightBackground': '#12121a',
      'editorCursor.foreground': '#00ff88',
      'editorIndentGuide.background1': '#2a2a3a',
      'editorIndentGuide.activeBackground1': '#00ff88',
    },
  });
}

/** Monaco Editor language IDs - full JSX/TSX support */
const MONACO_LANGUAGES: Record<string, string> = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescriptreact',
  json: 'json', json5: 'json',
  html: 'html', htm: 'html',
  css: 'css', scss: 'scss', less: 'less',
  md: 'markdown', mdx: 'markdown',
  py: 'python', sh: 'shell', bash: 'shell',
  yaml: 'yaml', yml: 'yaml',
  xml: 'xml', svg: 'xml',
  sql: 'sql', rs: 'rust', go: 'go', java: 'java',
  c: 'c', cpp: 'cpp', h: 'c',
  rb: 'ruby', php: 'php',
  toml: 'toml', ini: 'ini',
  dockerfile: 'dockerfile',
  env: 'properties',
};

export function getMonacoLanguage(path: string): string {
  const normalized = String(path || '').replace(/\\/g, '/');
  const name = normalized.split('/').pop()?.toLowerCase() ?? '';
  if (name === 'dockerfile') {return 'dockerfile';}
  if (name === '.env' || name.startsWith('.env.')) {return 'properties';}
  const ext = (name.match(/\.([^.]+)$/) || [])[1] ?? '';
  return MONACO_LANGUAGES[ext] || 'plaintext';
}

export function getLanguageLabel(path: string): string {
  const lang = getMonacoLanguage(path);
  const labels: Record<string, string> = {
    javascript: 'JavaScript', typescript: 'TypeScript', typescriptreact: 'TSX',
    json: 'JSON', html: 'HTML', css: 'CSS', python: 'Python', markdown: 'Markdown',
    yaml: 'YAML', plaintext: 'Plain Text', shell: 'Shell',
  };
  return labels[lang] || lang;
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp']);

export function isImageFile(path: string): boolean {
  const ext = (path.match(/\.([^.]+)$/) || [])[1]?.toLowerCase();
  return !!ext && IMAGE_EXTENSIONS.has(ext);
}
