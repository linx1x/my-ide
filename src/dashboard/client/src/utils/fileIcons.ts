type IconInfo = { icon: string; color: string };

const FILE_ICONS: Record<string, IconInfo> = {
  js: { icon: 'JS', color: '#f7df1e' }, mjs: { icon: 'JS', color: '#f7df1e' }, cjs: { icon: 'JS', color: '#f7df1e' },
  jsx: { icon: '⚛', color: '#61dafb' }, ts: { icon: 'TS', color: '#3178c6' }, tsx: { icon: '⚛', color: '#3178c6' },
  json: { icon: '{ }', color: '#cbcb41' }, json5: { icon: '{ }', color: '#cbcb41' },
  html: { icon: '◇', color: '#e44d26' }, htm: { icon: '◇', color: '#e44d26' },
  css: { icon: '#', color: '#563d7c' }, scss: { icon: '#', color: '#cd6799' }, less: { icon: '#', color: '#1d365d' },
  md: { icon: 'M↓', color: '#519aba' }, mdx: { icon: 'M↓', color: '#519aba' },
  py: { icon: 'Py', color: '#3572a5' }, rb: { icon: '◆', color: '#cc342d' }, php: { icon: '◇', color: '#777bb4' },
  java: { icon: 'J', color: '#b07219' }, go: { icon: 'Go', color: '#00add8' }, rs: { icon: 'Rs', color: '#dea584' },
  c: { icon: 'C', color: '#555555' }, cpp: { icon: 'C+', color: '#f34b7d' }, h: { icon: 'H', color: '#555555' },
  sh: { icon: '$_', color: '#89e051' }, bash: { icon: '$_', color: '#89e051' }, zsh: { icon: '$_', color: '#89e051' },
  yaml: { icon: '⋮', color: '#cb171e' }, yml: { icon: '⋮', color: '#cb171e' }, toml: { icon: '⋮', color: '#9c4221' },
  ini: { icon: '⋮', color: '#9c4221' }, xml: { icon: '◇', color: '#e44d26' }, svg: { icon: '◎', color: '#ffb13b' },
  sql: { icon: '⊞', color: '#e38c00' }, graphql: { icon: '⬡', color: '#e535ab' }, txt: { icon: '≡', color: '#858585' },
  log: { icon: '≡', color: '#858585' }, env: { icon: '⚙', color: '#ecd53f' }, lock: { icon: '🔒', color: '#858585' },
  png: { icon: '▣', color: '#a074c4' }, jpg: { icon: '▣', color: '#a074c4' }, jpeg: { icon: '▣', color: '#a074c4' },
  gif: { icon: '▣', color: '#a074c4' }, webp: { icon: '▣', color: '#a074c4' }, ico: { icon: '▣', color: '#a074c4' },
  woff: { icon: 'A', color: '#858585' }, woff2: { icon: 'A', color: '#858585' }, ttf: { icon: 'A', color: '#858585' },
  otf: { icon: 'A', color: '#858585' }, map: { icon: '{ }', color: '#858585' },
};

const FILENAME_ICONS: Record<string, IconInfo> = {
  dockerfile: { icon: '🐳', color: '#2496ed' }, 'docker-compose.yml': { icon: '🐳', color: '#2496ed' },
  'docker-compose.yaml': { icon: '🐳', color: '#2496ed' }, '.dockerignore': { icon: '🐳', color: '#2496ed' },
  '.gitignore': { icon: '', color: '#f05032' }, '.gitattributes': { icon: '', color: '#f05032' },
  '.gitmodules': { icon: '', color: '#f05032' }, license: { icon: '⚖', color: '#d4aa00' },
  'license.md': { icon: '⚖', color: '#d4aa00' }, 'readme.md': { icon: '📖', color: '#519aba' },
  'changelog.md': { icon: '📋', color: '#519aba' }, 'package.json': { icon: '📦', color: '#cb3837' },
  'package-lock.json': { icon: '🔒', color: '#cb3837' }, 'tsconfig.json': { icon: 'TS', color: '#3178c6' },
  'jsconfig.json': { icon: 'JS', color: '#f7df1e' }, '.eslintrc.json': { icon: '⬡', color: '#4b32c3' },
  '.eslintrc.js': { icon: '⬡', color: '#4b32c3' }, '.prettierrc': { icon: '✦', color: '#56b3b4' },
  '.prettierrc.json': { icon: '✦', color: '#56b3b4' }, 'webpack.config.js': { icon: '⬡', color: '#8dd6f9' },
  'vite.config.js': { icon: '⚡', color: '#646cff' }, 'vite.config.ts': { icon: '⚡', color: '#646cff' },
  'tailwind.config.js': { icon: '🌊', color: '#38bdf8' }, 'tailwind.config.ts': { icon: '🌊', color: '#38bdf8' },
  '.env': { icon: '⚙', color: '#ecd53f' }, '.env.example': { icon: '⚙', color: '#ecd53f' },
  '.env.local': { icon: '⚙', color: '#ecd53f' }, makefile: { icon: '⚙', color: '#6d8086' },
  'requirements.txt': { icon: '📋', color: '#3572a5' }, 'cargo.toml': { icon: '📦', color: '#dea584' },
  'go.mod': { icon: 'Go', color: '#00add8' }, 'go.sum': { icon: '🔒', color: '#00add8' },
  gemfile: { icon: '◆', color: '#cc342d' },
};

const FOLDER_ICONS: Record<string, IconInfo> = {
  src: { icon: '◈', color: '#42a5f5' }, lib: { icon: '◈', color: '#42a5f5' }, dist: { icon: '📦', color: '#858585' },
  build: { icon: '📦', color: '#858585' }, node_modules: { icon: '📦', color: '#cb3837' },
  public: { icon: '◎', color: '#42a5f5' }, assets: { icon: '▣', color: '#a074c4' }, images: { icon: '▣', color: '#a074c4' },
  img: { icon: '▣', color: '#a074c4' }, components: { icon: '⧉', color: '#61dafb' }, pages: { icon: '◧', color: '#42a5f5' },
  styles: { icon: '#', color: '#563d7c' }, css: { icon: '#', color: '#563d7c' }, tests: { icon: '⬡', color: '#99425b' },
  test: { icon: '⬡', color: '#99425b' }, __tests__: { icon: '⬡', color: '#99425b' }, scripts: { icon: '$_', color: '#89e051' },
  config: { icon: '⚙', color: '#6d8086' }, hooks: { icon: '⟳', color: '#42a5f5' }, utils: { icon: '⚡', color: '#f7df1e' },
  helpers: { icon: '⚡', color: '#f7df1e' }, api: { icon: '⬡', color: '#42a5f5' }, routes: { icon: '⬡', color: '#42a5f5' },
  middleware: { icon: '⬡', color: '#42a5f5' }, models: { icon: '⊞', color: '#e38c00' }, docs: { icon: '📖', color: '#519aba' },
  '.git': { icon: '', color: '#f05032' }, '.github': { icon: '', color: '#f05032' }, '.vscode': { icon: '⚙', color: '#007acc' },
  '.cursor': { icon: '⚙', color: '#007acc' }, docker: { icon: '🐳', color: '#2496ed' }, dashboard: { icon: '◧', color: '#42a5f5' },
};

export function getFileIcon(name: string, isDir: boolean): IconInfo {
  const lower = name.toLowerCase();
  if (isDir) {
    const info = FOLDER_ICONS[lower];
    return info || { icon: '📁', color: '#c09553' };
  }
  const byName = FILENAME_ICONS[lower];
  if (byName) {return byName;}
  if (lower.startsWith('.env')) {return { icon: '⚙', color: '#ecd53f' };}
  const ext = (lower.match(/\.([^.]+)$/) || [])[1];
  if (ext && FILE_ICONS[ext]) {return FILE_ICONS[ext];}
  return { icon: '📄', color: '#858585' };
}
