/**
 * Files, diff, screenshot, search, editor/complete API routes.
 */
import type express from 'express';
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync, renameSync, unlinkSync, rmSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { isGitRepo, getChangedFiles, getFullDiff } from '../../core/git-utils.js';
import { captureHtmlScreenshot } from '../../adapters/screenshot.js';
import config from '../../config.js';
import type { DashboardContext } from '../context.js';

const SKIP_DIRS = new Set(['node_modules', '.git', '.next', '.nuxt', 'dist', 'build']);
const MAX_TREE_DEPTH = 30;
const CODE_COMPLETION_SYSTEM_PROMPT =
  `You are a code completion assistant. Complete the code naturally from the cursor position.
Output ONLY the completion text that should appear after the cursor. No explanations, no markdown, no quotes, no preamble.
Do not repeat any of the input. Trim trailing newlines.`;

export function registerFilesRoutes(app: express.Application, ctx: DashboardContext): void {
  const { authMiddleware, getCodebaseRoot, safePath, isSensitivePath } = ctx;

  function buildTree(fullPath: string, relPath: string, depth: number, showHidden = false): { name: string; path: string; isDir: boolean; children?: unknown[] }[] | null {
    if (depth >= MAX_TREE_DEPTH) {return null;}
    const entries = readdirSync(fullPath, { withFileTypes: true });
    return entries
      .filter((e) => {
        if (!showHidden && e.name.startsWith('.')) {return false;}
        if (e.isDirectory() && SKIP_DIRS.has(e.name)) {return false;}
        const childRel = relPath ? relPath + '/' + e.name : e.name;
        if (isSensitivePath(childRel)) {return false;}
        return true;
      })
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) {return a.isDirectory() ? -1 : 1;}
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      })
      .map((e) => {
        const name = e.name;
        const childRel = relPath ? relPath + '/' + name : name;
        const childFull = join(fullPath, name);
        if (e.isDirectory()) {
          const children = buildTree(childFull, childRel, depth + 1, showHidden);
          return { name, path: childRel, isDir: true, children: children || [] };
        }
        return { name, path: childRel, isDir: false };
      });
  }

  app.use('/api/editor/complete', ctx.limiters.completion);
  app.use('/api/search', ctx.limiters.search);

  app.get('/api/files/changed', authMiddleware, (req, res) => {
    const root = getCodebaseRoot();
    if (!isGitRepo(root)) {return res.json({ files: [] });}
    const files = getChangedFiles(root);
    res.json({ files });
  });

  app.get('/api/diff', authMiddleware, (req, res) => {
    const root = getCodebaseRoot();
    if (!isGitRepo(root)) {return res.json({ diff: null });}
    const diff = getFullDiff(root);
    res.json({ diff });
  });

  app.get('/api/screenshot', authMiddleware, async (req, res) => {
    const rel = req.query.path as string;
    if (!rel) {return res.status(400).json({ error: 'path required' });}
    if (!/\.(html?|htm)$/i.test(rel)) {return res.status(400).json({ error: 'Only HTML files can be captured' });}
    const full = safePath(rel);
    if (!full) {return res.status(403).json({ error: 'Invalid path' });}
    try {
      const buffer = await captureHtmlScreenshot(rel, getCodebaseRoot());
      if (!buffer) {return res.status(500).json({ error: 'Screenshot capture failed' });}
      res.json({ b64: buffer.toString('base64') });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/files/content', authMiddleware, (req, res) => {
    const rel = req.body?.path ?? req.query.path;
    if (!rel) {return res.status(400).json({ error: 'path required' });}
    if (isSensitivePath(rel)) {return res.status(403).json({ error: 'Access denied: sensitive file' });}
    const full = safePath(rel);
    if (!full) {return res.status(403).json({ error: 'Invalid path' });}
    if (!existsSync(full)) {return res.status(404).json({ error: 'File not found' });}
    const content = req.body?.content;
    if (typeof content !== 'string') {return res.status(400).json({ error: 'content required' });}
    try {
      writeFileSync(full, content, 'utf8');
      res.json({ ok: true, path: rel });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/files/content', authMiddleware, (req, res) => {
    const rel = req.query.path as string;
    if (!rel) {return res.status(400).json({ error: 'path required' });}
    if (isSensitivePath(rel)) {return res.status(403).json({ error: 'Access denied: sensitive file' });}
    const full = safePath(rel);
    if (!full) {return res.status(403).json({ error: 'Invalid path' });}
    if (!existsSync(full)) {return res.status(404).json({ error: 'File not found' });}
    try {
      const content = readFileSync(full, 'utf8');
      res.json({ path: rel, content });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/editor/complete', authMiddleware, async (req, res) => {
    const { prompt, language: _language } = req.body || {};
    if (typeof prompt !== 'string') {return res.status(400).json({ error: 'prompt required', available: false });}

    const baseUrl = (config.ollamaBaseUrl || 'http://localhost:11434').replace(/\/$/, '');
    const model = config.ollamaCompletionModel || 'qwen2.5-coder:7b';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const r = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: CODE_COMPLETION_SYSTEM_PROMPT + '\n\n' + prompt,
          stream: false,
          options: { temperature: 0.2, num_predict: 80 },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!r.ok) {
        const errText = await r.text();
        console.warn('[Dashboard] Ollama completion failed:', r.status, errText.slice(0, 200));
        return res.json({ completion: null, available: false });
      }

      const data = await r.json() as { response?: string };
      const text = (data.response || '').trim();
      return res.json({ completion: text || null, available: true });
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') {
        return res.json({ completion: null, available: false });
      }
      console.warn('[Dashboard] Ollama completion error:', (err as Error).message);
      return res.json({ completion: null, available: false });
    }
  });

  app.get('/api/files/raw', authMiddleware, (req, res) => {
    const rel = req.query.path as string;
    if (!rel) {return res.status(400).json({ error: 'path required' });}
    if (isSensitivePath(rel)) {return res.status(403).json({ error: 'Access denied: sensitive file' });}
    const full = safePath(rel);
    if (!full) {return res.status(403).json({ error: 'Invalid path' });}
    if (!existsSync(full)) {return res.status(404).json({ error: 'File not found' });}
    res.sendFile(full);
  });

  app.get('/api/files/tree', authMiddleware, (req, res) => {
    const root = getCodebaseRoot();
    const showHidden = req.query.showHidden === '1';
    if (!existsSync(root)) {return res.json({ tree: [] });}
    try {
      const tree = buildTree(root, '', 0, showHidden);
      res.json({ tree: tree || [] });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/files/list', authMiddleware, (req, res) => {
    const rel = (req.query.path as string) || '';
    const full = safePath(rel);
    if (!full) {return res.status(403).json({ error: 'Invalid path' });}
    if (!existsSync(full)) {return res.status(404).json({ error: 'Not found' });}
    try {
      const entries = readdirSync(full, { withFileTypes: true });
      const items = entries
        .filter((e) => {
          if (e.name.startsWith('.') || e.name === 'node_modules') {return false;}
          const childRel = rel ? rel + '/' + e.name : e.name;
          if (isSensitivePath(childRel)) {return false;}
          return true;
        })
        .map((e) => ({ name: e.name, isDir: e.isDirectory() }));
      res.json({ path: rel || '.', items });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/terminal/complete', authMiddleware, (req, res) => {
    try {
      const { dir = '', prefix = '' } = req.query;
      const resolved = resolve((dir as string) || getCodebaseRoot());
      if (!existsSync(resolved)) {return res.json({ completions: [] });}
      const entries = readdirSync(resolved, { withFileTypes: true });
      const lower = (prefix as string).toLowerCase();
      const completions = entries
        .filter((e) => e.name.toLowerCase().startsWith(lower))
        .map((e) => (e.isDirectory() ? e.name + '/' : e.name))
        .sort((a, b) => {
          const aD = a.endsWith('/'), bD = b.endsWith('/');
          if (aD !== bD) {return aD ? -1 : 1;}
          return a.localeCompare(b);
        });
      res.json({ completions });
    } catch {
      res.json({ completions: [] });
    }
  });

  app.post('/api/files/create', authMiddleware, (req, res) => {
    const { path: relPath, isDir } = req.body || {};
    if (!relPath) {return res.status(400).json({ error: 'path required' });}
    if (isSensitivePath(relPath)) {return res.status(403).json({ error: 'Access denied: sensitive path' });}
    const full = safePath(relPath);
    if (!full) {return res.status(403).json({ error: 'Invalid path' });}
    if (existsSync(full)) {return res.status(409).json({ error: 'Already exists' });}
    try {
      if (isDir) {
        mkdirSync(full, { recursive: true });
      } else {
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, '', 'utf8');
      }
      res.json({ ok: true, path: relPath });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/files/rename', authMiddleware, (req, res) => {
    const { oldPath, newPath } = req.body || {};
    if (!oldPath || !newPath) {return res.status(400).json({ error: 'oldPath and newPath required' });}
    if (isSensitivePath(oldPath) || isSensitivePath(newPath)) {return res.status(403).json({ error: 'Access denied: sensitive path' });}
    const fullOld = safePath(oldPath);
    const fullNew = safePath(newPath);
    if (!fullOld || !fullNew) {return res.status(403).json({ error: 'Invalid path' });}
    if (!existsSync(fullOld)) {return res.status(404).json({ error: 'Source not found' });}
    if (existsSync(fullNew)) {return res.status(409).json({ error: 'Destination already exists' });}
    try {
      mkdirSync(dirname(fullNew), { recursive: true });
      renameSync(fullOld, fullNew);
      res.json({ ok: true, oldPath, newPath });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/files/delete', authMiddleware, (req, res) => {
    const rel = req.query.path as string;
    if (!rel) {return res.status(400).json({ error: 'path required' });}
    if (isSensitivePath(rel)) {return res.status(403).json({ error: 'Access denied: sensitive path' });}
    const full = safePath(rel);
    if (!full) {return res.status(403).json({ error: 'Invalid path' });}
    if (!existsSync(full)) {return res.status(404).json({ error: 'Not found' });}
    try {
      const st = statSync(full);
      if (st.isDirectory()) {
        rmSync(full, { recursive: true, force: true });
      } else {
        unlinkSync(full);
      }
      res.json({ ok: true, path: rel });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  const SEARCH_SKIP_DIRS = new Set([
    'node_modules', '.git', '__pycache__', '.venv', 'venv',
    'dist', 'build', '.next', '.nuxt', 'coverage', '.mypy_cache',
    '.pytest_cache', '.tox', 'vendor', '.bundle', 'target',
  ]);
  const BINARY_EXT = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.svg',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt',
    '.mp3', '.mp4', '.avi', '.mov', '.wav', '.flac',
    '.exe', '.dll', '.so', '.dylib', '.o', '.a',
    '.pyc', '.pyo', '.class', '.jar', '.war',
    '.db', '.sqlite', '.sqlite3', '.lock',
  ]);

  /** Convert glob pattern to regex; * = any chars except / */
  function globToRegex(glob: string): RegExp {
    const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
    return new RegExp('^' + escaped + '$');
  }

  function parseGlobList(param: string | undefined): RegExp[] {
    if (!param || typeof param !== 'string') {return [];}
    return param
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map(globToRegex);
  }

  app.get('/api/search', authMiddleware, (req, res) => {
    const query = req.query.q as string;
    if (!query) {return res.status(400).json({ error: 'q (query) required' });}
    if (query.length > 200) {return res.status(400).json({ error: 'Query too long (max 200 chars)' });}
    const useRegex = req.query.regex === '1' || req.query.regex === 'true';
    const caseSensitive = req.query.caseSensitive === '1' || req.query.caseSensitive === 'true';
    const wholeWord = req.query.wholeWord === '1' || req.query.wholeWord === 'true';
    const includePatterns = parseGlobList(req.query.include as string);
    const excludePatterns = parseGlobList(req.query.exclude as string);

    let regex: RegExp | null = null;
    if (useRegex) {
      try {
        regex = new RegExp(query, caseSensitive ? 'g' : 'gi');
      } catch {
        return res.status(400).json({ error: 'Invalid regex pattern' });
      }
    } else if (wholeWord) {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      regex = new RegExp('(?:^|[^\\w])(' + escaped + ')(?=[^\\w]|$)', caseSensitive ? 'g' : 'gi');
    }
    const root = getCodebaseRoot();
    const maxResults = Math.min(parseInt(String(req.query.limit || '100'), 10), 500);
    const maxMatchesPerFile = 5;
    const maxFileSize = 1 * 1024 * 1024;

    const caseInsensitive = !regex && !caseSensitive && query === query.toLowerCase();
    const needle = caseInsensitive ? query.toLowerCase() : query;
    const results: { path: string; line: number; text: string }[] = [];

    function matchesInclude(entRel: string): boolean {
      if (includePatterns.length === 0) {return true;}
      return includePatterns.some((p) => p.test(entRel));
    }
    function matchesExclude(entRel: string): boolean {
      if (excludePatterns.length === 0) {return false;}
      return excludePatterns.some((p) => p.test(entRel));
    }

    function walk(dir: string, rel: string) {
      if (results.length >= maxResults) {return;}
      let entries;
      try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const ent of entries) {
        if (results.length >= maxResults) {return;}
        if (ent.name.startsWith('.') || SEARCH_SKIP_DIRS.has(ent.name)) {continue;}
        const full = join(dir, ent.name);
        const entRel = rel ? rel + '/' + ent.name : ent.name;
        if (ent.isDirectory()) {
          walk(full, entRel);
        } else if (ent.isFile()) {
          if (isSensitivePath(entRel)) {continue;}
          if (!matchesInclude(entRel) || matchesExclude(entRel)) {continue;}
          const ext = ent.name.includes('.') ? '.' + (ent.name.split('.').pop() ?? '').toLowerCase() : '';
          if (BINARY_EXT.has(ext)) {continue;}
          let st;
          try { st = statSync(full); } catch { continue; }
          if (st.size > maxFileSize || st.size === 0) {continue;}
          let content;
          try { content = readFileSync(full, 'utf8'); } catch { continue; }
          const lines = content.split('\n');
          let fileMatches = 0;
          if (regex) {
            for (let i = 0; i < lines.length && fileMatches < maxMatchesPerFile; i++) {
              const lineText = lines[i] ?? '';
              (regex ?? /./).lastIndex = 0;
              if ((regex ?? /./).test(lineText)) {
                results.push({ path: entRel, line: i + 1, text: lineText.trimEnd().slice(0, 500) });
                fileMatches++;
                if (results.length >= maxResults) {return;}
              }
            }
            if (fileMatches === 0) {continue;}
          } else {
            const haystack = caseInsensitive ? content.toLowerCase() : content;
            if (!haystack.includes(needle)) {continue;}
            for (let i = 0; i < lines.length && fileMatches < maxMatchesPerFile; i++) {
              const lineText = lines[i] ?? '';
              const line = caseInsensitive ? lineText.toLowerCase() : lineText;
              if (line.includes(needle)) {
                results.push({ path: entRel, line: i + 1, text: lineText.trimEnd().slice(0, 500) });
                fileMatches++;
                if (results.length >= maxResults) {return;}
              }
            }
          }
        }
      }
    }

    try {
      walk(root, '');
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message || 'Search failed' });
    }
    res.json({ results });
  });

  app.post('/api/search/replace', authMiddleware, (req, res) => {
    const { query, replacement = '', preview = false } = req.body || {};
    if (!query || typeof query !== 'string') {return res.status(400).json({ error: 'query required' });}
    if (query.length > 200) {return res.status(400).json({ error: 'Query too long (max 200 chars)' });}
    const root = getCodebaseRoot();
    const maxFileSize = 1 * 1024 * 1024;
    const replacedIn: { path: string; count: number }[] = [];
    let total = 0;
    function walk(dir: string, rel: string) {
      let entries;
      try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const ent of entries) {
        if (ent.name.startsWith('.') || SEARCH_SKIP_DIRS.has(ent.name)) {continue;}
        const full = join(dir, ent.name);
        const entRel = rel ? rel + '/' + ent.name : ent.name;
        if (ent.isDirectory()) {
          walk(full, entRel);
        } else if (ent.isFile()) {
          if (isSensitivePath(entRel)) {continue;}
          const ext = ent.name.includes('.') ? '.' + (ent.name.split('.').pop() ?? '').toLowerCase() : '';
          if (BINARY_EXT.has(ext)) {continue;}
          let st;
          try { st = statSync(full); } catch { continue; }
          if (st.size > maxFileSize || st.size === 0) {continue;}
          let content;
          try { content = readFileSync(full, 'utf8'); } catch { continue; }
          if (!content.includes(query)) {continue;}
          const count = content.split(query).length - 1;
          if (count <= 0) {continue;}
          replacedIn.push({ path: entRel, count });
          total += count;
          if (!preview) {
            const next = content.split(query).join(String(replacement));
            writeFileSync(full, next, 'utf8');
          }
        }
      }
    }
    try {
      walk(root, '');
      res.json({ ok: true, replacedIn, total, preview: !!preview });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message || 'Replace failed' });
    }
  });

  app.get('/api/files/info', authMiddleware, (req, res) => {
    const rel = req.query.path as string;
    if (!rel) {return res.status(400).json({ error: 'path required' });}
    if (isSensitivePath(rel)) {return res.status(403).json({ error: 'Access denied: sensitive file' });}
    const full = safePath(rel);
    if (!full) {return res.status(403).json({ error: 'Invalid path' });}
    if (!existsSync(full)) {return res.status(404).json({ error: 'Not found' });}
    try {
      const st = statSync(full);
      res.json({ path: rel, size: st.size, modified: st.mtime, isDir: st.isDirectory() });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });
}
