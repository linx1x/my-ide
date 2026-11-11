import {
  File,
  FileCode,
  FileJson,
  FileText,
  FileImage,
  Folder,
  FolderOpen,
  type LucideIcon,
} from 'lucide-react';
import { getFileIcon } from './fileIcons';

const LUCIDE_FILE_BY_EXT: Record<string, LucideIcon> = {
  js: FileCode,
  mjs: FileCode,
  cjs: FileCode,
  jsx: FileCode,
  ts: FileCode,
  tsx: FileCode,
  json: FileJson,
  json5: FileJson,
  html: FileCode,
  htm: FileCode,
  css: FileCode,
  scss: FileCode,
  less: FileCode,
  md: FileText,
  mdx: FileText,
  py: FileCode,
  rb: FileCode,
  php: FileCode,
  java: FileCode,
  go: FileCode,
  rs: FileCode,
  c: FileCode,
  cpp: FileCode,
  h: FileCode,
  sh: FileCode,
  bash: FileCode,
  zsh: FileCode,
  yaml: FileCode,
  yml: FileCode,
  toml: FileCode,
  ini: FileCode,
  xml: FileCode,
  svg: FileCode,
  sql: FileCode,
  graphql: FileCode,
  txt: FileText,
  log: FileText,
  env: FileCode,
  lock: File,
  png: FileImage,
  jpg: FileImage,
  jpeg: FileImage,
  gif: FileImage,
  webp: FileImage,
  ico: FileImage,
  woff: File,
  woff2: File,
  ttf: File,
  otf: File,
  map: FileJson,
};

/** Returns { Icon, color } for use in the file tree. Reuses colors from fileIcons. */
export function getFileLucideIcon(name: string, isDir: boolean): { Icon: LucideIcon; color: string } {
  const { color } = getFileIcon(name, isDir);
  if (isDir) {
    return { Icon: Folder, color };
  }
  const lower = name.toLowerCase();
  const ext = (lower.match(/\.([^.]+)$/) || [])[1];
  const Icon = (ext && LUCIDE_FILE_BY_EXT[ext]) || File;
  return { Icon, color };
}

/** For folder rows: use FolderOpen when expanded, else Folder. Color from fileIcons. */
export function getFolderLucideIcon(name: string, expanded: boolean): { Icon: LucideIcon; color: string } {
  const { color } = getFileIcon(name, true);
  return { Icon: expanded ? FolderOpen : Folder, color };
}
