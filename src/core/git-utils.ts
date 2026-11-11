/**
 * Git helpers for accept/reject flow.
 * Requires a git repo in workDir.
 */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import config from '../config.js';

/** Returns true if workDir is in a git repo. */
export function isGitRepo(workDir: string): boolean {
  try {
    const p = join(workDir, '.git');
    if (existsSync(p)) {return true;}
    execSync('git rev-parse --is-inside-work-tree', { cwd: workDir, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** Returns porcelain status string, or empty if clean. */
export function getStatusShort(workDir: string): string {
  try {
    return execSync('git status --porcelain', { cwd: workDir, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

/** Returns diff stat for staged + unstaged. Untracked files come from status. Pass statusShort to avoid duplicate git status. */
export function getDiffStatAll(workDir: string, statusShort?: string): string {
  try {
    const staged = execSync('git diff --cached --stat', { cwd: workDir, encoding: 'utf8' }).trim();
    const unstaged = execSync('git diff --stat', { cwd: workDir, encoding: 'utf8' }).trim();
    const status = statusShort !== undefined ? statusShort : getStatusShort(workDir);
    const untracked = status
      .split('\n')
      .filter((l: string) => l.startsWith('??'))
      .map((l: string) => l.slice(3).trim() + ' (new)');
    const parts = [staged, unstaged, untracked.length ? untracked.join('\n') : ''].filter(Boolean);
    return parts.join('\n');
  } catch {
    return '';
  }
}

/** Revert all uncommitted changes: modified, staged, and untracked. */
export function revertAll(workDir: string): boolean {
  try {
    execSync('git reset --hard HEAD', { cwd: workDir, stdio: 'ignore' });
    execSync('git clean -fd', { cwd: workDir, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** Format git diff for a readable summary (max N lines from diff --stat). Returns null if no changes. Pass statusShort to avoid duplicate git status. */
export function formatChangeSummary(workDir: string, maxLines = 15, statusShort?: string): string | null {
  const stat = getDiffStatAll(workDir, statusShort);
  if (!stat.trim()) {return null;}

  const lines = stat.split('\n').filter((l: string) => l.trim());
  const summary = lines.slice(0, maxLines).map((l: string) => `• ${l.trim()}`);
  if (lines.length > maxLines) {summary.push(`• ... and ${lines.length - maxLines} more`);}

  return summary.join('\n');
}

/** Returns full unified diff (staged + unstaged) for dashboard. Empty if no changes. */
export function getFullDiff(workDir: string): string | null {
  try {
    const staged = execSync('git diff --cached', { cwd: workDir, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }).trim();
    const unstaged = execSync('git diff', { cwd: workDir, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }).trim();
    const status = getStatusShort(workDir);
    const untrackedLines = status.split('\n').filter((l: string) => l.startsWith('??')).map((l: string) => l.slice(3).trim());
    let out = '';
    if (staged) {out += '=== Staged ===\n' + staged + '\n\n';}
    if (unstaged) {out += '=== Unstaged ===\n' + unstaged + '\n\n';}
    if (untrackedLines.length) {out += '=== New files (untracked) ===\n' + untrackedLines.join('\n');}
    return out.trim() || null;
  } catch {
    return null;
  }
}

/** Slugify a description into a concise git branch name by removing filler words. */
export function slugifyBranchName(text: string): string {
  const stopWords = new Set([
    'i', 'me', 'my', 'we', 'us', 'our', 'you', 'your', 'it', 'its',
    'a', 'an', 'the',
    'to', 'in', 'on', 'at', 'for', 'of', 'with', 'by', 'from', 'into', 'about',
    'and', 'or', 'but', 'so', 'that', 'this', 'these', 'those',
    'is', 'are', 'be', 'was', 'were',
    'want', 'need', 'would', 'could', 'should', 'can', 'please', 'just',
    'also', 'some', 'let', 'make', 'do', 'get',
  ]);
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w: string) => w.length > 1 && !stopWords.has(w));
  return words.join('-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'feature';
}

/** Returns the current branch name, or null on error. */
export function getCurrentBranch(workDir: string): string | null {
  try {
    return execSync('git branch --show-current', { cwd: workDir, encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
}

/** Creates and checks out a new branch. Throws on failure (e.g. branch already exists). */
export function createBranch(workDir: string, branchName: string): void {
  const result = spawnSync('git', ['checkout', '-b', branchName], { cwd: workDir, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `Failed to create branch ${branchName}`);
  }
}

/** Checks out an existing branch. Throws on failure. */
export function checkoutBranch(workDir: string, branchName: string): void {
  const result = spawnSync('git', ['checkout', branchName], { cwd: workDir, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `Failed to checkout ${branchName}`);
  }
}

/** Force-deletes a local branch. Throws if the branch is protected. */
export function deleteBranch(workDir: string, branchName: string): void {
  if (isBranchProtected(branchName)) {
    throw new Error(`Cannot delete protected branch '${branchName}'.`);
  }
  spawnSync('git', ['branch', '-D', branchName], { cwd: workDir });
}

/**
 * Stages all changes and commits them. If there is nothing to commit
 * (agent may have committed already) the function returns without error.
 * Throws on unexpected git errors.
 */
export function commitAll(workDir: string, message: string): void {
  const addResult = spawnSync('git', ['add', '-A'], { cwd: workDir, encoding: 'utf8' });
  if (addResult.status !== 0) {
    throw new Error(addResult.stderr?.trim() || 'git add -A failed');
  }
  const commitResult = spawnSync('git', ['commit', '-m', message], { cwd: workDir, encoding: 'utf8' });
  if (commitResult.status !== 0) {
    const out = (commitResult.stdout || commitResult.stderr || '').trim();
    // "nothing to commit" is not a real error
    if (!out.includes('nothing to commit') && !out.includes('nothing added')) {
      throw new Error(out || 'git commit failed');
    }
  }
}

/** Returns true if the branch is protected (push and delete are blocked). */
export function isBranchProtected(branchName: string): boolean {
  return config.protectedBranches.has(branchName);
}

/**
 * Returns true if the branch is allowed for push.
 * Fails if protected OR if allowedPushPrefixes is non-empty and branch doesn't match.
 */
export function isBranchPushAllowed(branchName: string): boolean {
  if (isBranchProtected(branchName)) {return false;}
  const prefixes = config.allowedPushPrefixes;
  if (!prefixes.length) {return true;}
  return prefixes.some((prefix) => branchName.startsWith(prefix));
}

/**
 * Pushes a branch to origin with upstream tracking.
 * Returns the combined stdout+stderr output string.
 * Throws on failure or if branch is protected/not allowed.
 */
export function pushBranch(workDir: string, branchName: string): string {
  if (isBranchProtected(branchName)) {
    throw new Error(
      `Push to '${branchName}' is blocked — protected branch. ` +
      'Use a feature/*, fix/*, or hotfix/* branch instead.'
    );
  }
  if (!isBranchPushAllowed(branchName)) {
    const allowed = config.allowedPushPrefixes.join(', ');
    throw new Error(
      `Push to '${branchName}' is not allowed. ` +
      `Branch must start with one of: ${allowed}`
    );
  }
  const result = spawnSync('git', ['push', '-u', 'origin', branchName], { cwd: workDir, encoding: 'utf8' });
  const out = ((result.stdout || '') + (result.stderr || '')).trim();
  if (result.status !== 0) {
    throw new Error(out || 'git push failed');
  }
  return out;
}

/** Returns list of changed/untracked file paths for dashboard. */
export function getChangedFiles(workDir: string): Array<{ path: string; status: string }> {
  try {
    const status = getStatusShort(workDir);
    const lines = status.split('\n').filter((l: string) => l.trim());
    return lines.map((l: string) => {
      const path = l.slice(3).trim();
      const status = l.slice(0, 2).trim();
      return { path, status };
    });
  } catch {
    return [];
  }
}

/**
 * Returns detailed file status for the interactive git panel.
 * Each file has { path, indexStatus, wtStatus } where each is a single char.
 * indexStatus = staged column, wtStatus = working-tree column.
 */
export function getChangedFilesDetailed(workDir: string): Array<{ path: string; indexStatus: string; wtStatus: string }> {
  try {
    const status = getStatusShort(workDir);
    const lines = status.split('\n').filter((l: string) => l.trim());
    return lines.map((l: string) => {
      const line = l.replace(/\r$/, '');
      const xy = line.slice(0, 2);
      const path = line.slice(3).trim();
      return { path, indexStatus: xy[0] ?? ' ', wtStatus: xy[1] ?? ' ' };
    });
  } catch {
    return [];
  }
}

/** Returns structured commit log for the interactive branch graph. */
export function getCommitLog(workDir: string, limit = 150): Array<{ hash: string; shortHash: string; parents: string[]; refs: string[]; author: string; date: string; message: string }> {
  try {
    const r = spawnSync(
      'git',
      ['log', '--all', '--format=%H%x00%P%x00%D%x00%an%x00%ar%x00%s', '--topo-order', '-n', String(limit)],
      { cwd: workDir, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }
    );
    if (r.status !== 0) {return [];}
    return (r.stdout || '')
      .split('\n')
      .filter(Boolean)
      .map((line: string) => {
        const p = line.split('\x00');
        if (p.length < 5) {return null;}
        const [hash, parentsStr, refsStr, author, date, ...msgParts] = p;
        const safeHash = hash ?? '';
        const safeParentsStr = parentsStr ?? '';
        const safeRefsStr = refsStr ?? '';
        const safeAuthor = author ?? '';
        const safeDate = date ?? '';
        const parents = safeParentsStr.trim() ? safeParentsStr.trim().split(' ').filter(Boolean) : [];
        const refs = safeRefsStr.trim()
          ? safeRefsStr
            .split(',')
            .map((r: string) => r.trim())
            .filter((r: string) => r && !r.startsWith('origin/HEAD'))
            .flatMap((r: string) => (r.includes('->') ? r.split('->').map((s: string) => s.trim()) : [r]))
          : [];
        return {
          hash: safeHash.trim(),
          shortHash: safeHash.trim().slice(0, 7),
          parents,
          refs,
          author: safeAuthor.trim(),
          date: safeDate.trim(),
          message: msgParts.join('\x00').trim(),
        };
      })
      .filter((entry): entry is { hash: string; shortHash: string; parents: string[]; refs: string[]; author: string; date: string; message: string } => Boolean(entry));
  } catch {
    return [];
  }
}

/** Returns commit summary (--stat --no-patch) for a given short/full hash. */
export function getCommitShow(workDir: string, hash: string): string | null {
  try {
    const r = spawnSync('git', ['show', '--stat', '--no-patch', hash], {
      cwd: workDir,
      encoding: 'utf8',
      maxBuffer: 512 * 1024,
    });
    return r.stdout?.trim() || null;
  } catch {
    return null;
  }
}

/** Returns all local and remote branches with current branch marked. */
export function getBranches(workDir: string): { local: Array<{ name: string; isCurrent: boolean }>; remote: Array<{ name: string }>; current: string | null } {
  try {
    const current = getCurrentBranch(workDir);
    const lr = spawnSync('git', ['branch', '--format=%(refname:short)'], { cwd: workDir, encoding: 'utf8' });
    const local = (lr.stdout || '')
      .split('\n')
      .filter(Boolean)
      .map((name: string) => ({ name, isCurrent: name === current }));
    const rr = spawnSync('git', ['branch', '-r', '--format=%(refname:short)'], { cwd: workDir, encoding: 'utf8' });
    const remote = (rr.stdout || '')
      .split('\n')
      .filter(Boolean)
      .filter((n: string) => !n.includes('->'))
      .map((name: string) => ({ name }));
    return { local, remote, current };
  } catch {
    return { local: [], remote: [], current: null };
  }
}

/** Stages a specific file path. */
export function stageFile(workDir: string, filePath: string): void {
  const r = spawnSync('git', ['add', '--', filePath], { cwd: workDir, encoding: 'utf8' });
  if (r.status !== 0) {throw new Error(r.stderr?.trim() || `Failed to stage ${filePath}`);}
}

/** Stages all changes. */
export function stageAll(workDir: string): void {
  const r = spawnSync('git', ['add', '-A'], { cwd: workDir, encoding: 'utf8' });
  if (r.status !== 0) {throw new Error(r.stderr?.trim() || 'git add -A failed');}
}

/** Unstages a specific file (moves it back from index to working tree). */
export function unstageFile(workDir: string, filePath: string): void {
  const r = spawnSync('git', ['restore', '--staged', '--', filePath], { cwd: workDir, encoding: 'utf8' });
  if (r.status !== 0) {throw new Error(r.stderr?.trim() || `Failed to unstage ${filePath}`);}
}

/** Unstages all staged changes. */
export function unstageAll(workDir: string): void {
  const r = spawnSync('git', ['restore', '--staged', '.'], { cwd: workDir, encoding: 'utf8' });
  if (r.status !== 0) {throw new Error(r.stderr?.trim() || 'Failed to unstage all');}
}

/** Discards working-tree changes to a file, or removes it if untracked. */
export function discardFile(workDir: string, filePath: string, untracked = false): void {
  if (untracked) {
    const r = spawnSync('git', ['clean', '-f', '--', filePath], { cwd: workDir, encoding: 'utf8' });
    if (r.status !== 0) {throw new Error(r.stderr?.trim() || `Failed to remove ${filePath}`);}
  } else {
    const r = spawnSync('git', ['restore', '--', filePath], { cwd: workDir, encoding: 'utf8' });
    if (r.status !== 0) {throw new Error(r.stderr?.trim() || `Failed to discard ${filePath}`);}
  }
}

/** Returns the unified diff for a single file. staged=true uses --cached. Returns null if clean. */
export function getFileDiff(workDir: string, filePath: string, staged = false): string | null {
  try {
    const args = staged ? ['diff', '--cached', '--', filePath] : ['diff', '--', filePath];
    const r = spawnSync('git', args, { cwd: workDir, encoding: 'utf8', maxBuffer: 512 * 1024 });
    return r.stdout?.trim() || null;
  } catch {
    return null;
  }
}

/** Commits currently staged files with the given message. Throws if nothing to commit. */
export function commitStaged(workDir: string, message: string): void {
  const r = spawnSync('git', ['commit', '-m', message], { cwd: workDir, encoding: 'utf8' });
  if (r.status !== 0) {
    const out = ((r.stdout || '') + (r.stderr || '')).trim();
    throw new Error(out || 'git commit failed');
  }
}

/** Merges branchName into the current branch (--no-ff). Throws on conflict. */
export function mergeBranch(workDir: string, branchName: string): void {
  const r = spawnSync('git', ['merge', '--no-ff', branchName], { cwd: workDir, encoding: 'utf8' });
  if (r.status !== 0) {throw new Error(r.stderr?.trim() || `Failed to merge ${branchName}`);}
}

/** Fetches from all remotes. Returns combined stdout+stderr. */
export function fetchAll(workDir: string): string {
  const r = spawnSync('git', ['fetch', '--all'], { cwd: workDir, encoding: 'utf8', timeout: 30_000 });
  return ((r.stdout || '') + (r.stderr || '')).trim();
}

/** Pulls the current branch. Throws on failure. Returns combined output. */
export function pullCurrent(workDir: string): string {
  const r = spawnSync('git', ['pull'], { cwd: workDir, encoding: 'utf8', timeout: 30_000 });
  if (r.status !== 0) {throw new Error(r.stderr?.trim() || 'git pull failed');}
  return ((r.stdout || '') + (r.stderr || '')).trim();
}

/**
 * Rebases the current branch onto branchName.
 * Automatically aborts the rebase if it fails (e.g. conflicts).
 * Throws on failure.
 */
export function rebaseBranch(workDir: string, branchName: string): void {
  const r = spawnSync('git', ['rebase', branchName], { cwd: workDir, encoding: 'utf8' });
  if (r.status !== 0) {
    spawnSync('git', ['rebase', '--abort'], { cwd: workDir });
    const msg = (r.stderr || r.stdout || '').trim();
    throw new Error(msg || `Failed to rebase onto ${branchName}`);
  }
}
