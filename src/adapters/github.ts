/**
 * GitHub API helpers for Workflow panel.
 * Requires GITHUB_TOKEN for API calls.
 */
import { execSync } from 'node:child_process';
import config from '../config.js';

const GITHUB_API = 'https://api.github.com';

/** Parse owner/repo from git remote URL. Returns null if not GitHub. */
export function getGitHubOwnerRepo(workDir: string): { owner: string; repo: string } | null {
  try {
    const url = execSync('git config --get remote.origin.url', {
      cwd: workDir,
      encoding: 'utf8',
      timeout: 3000,
    }).trim();
    // https://github.com/owner/repo.git or git@github.com:owner/repo.git
    const m = url.match(/github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?$/);
    if (m?.[1] && m?.[2]) {return { owner: m[1], repo: m[2] };}
  } catch {}
  return null;
}

/** Fetch from GitHub API. Returns null if token missing or request fails. */
async function ghFetch(path: string, opts: RequestInit = {}): Promise<unknown | null> {
  const token = config.githubToken;
  if (!token) {return null;}
  try {
    const url = path.startsWith('http') ? path : `${GITHUB_API}${path}`;
    const r = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...opts.headers,
      },
      ...opts,
    });
    if (!r.ok) {return null;}
    return r.json();
  } catch {
    return null;
  }
}

/** Get open PRs for the repo, optionally filtered by head branch. */
export async function getPullRequests(owner: string, repo: string, headBranch: string | null = null): Promise<unknown[]> {
  let path = `/repos/${owner}/${repo}/pulls?state=open&per_page=20`;
  if (headBranch) {path += `&head=${owner}:${headBranch}`;}
  const data = await ghFetch(path);
  return Array.isArray(data) ? data : [];
}

/** Get workflow runs for the repo, optionally filtered by branch. */
type WorkflowRun = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  head_branch: string;
  html_url: string;
  created_at: string;
  updated_at: string;
};

export async function getWorkflowRuns(owner: string, repo: string, branch: string | null = null): Promise<Array<{
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  branch: string;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
}>> {
  let path = `/repos/${owner}/${repo}/actions/runs?per_page=10`;
  if (branch) {path += `&branch=${encodeURIComponent(branch)}`;}
  const data = await ghFetch(path);
  if (!data || typeof data !== 'object' || !('workflow_runs' in data) || !Array.isArray((data as { workflow_runs?: unknown }).workflow_runs)) {return [];}
  return ((data as { workflow_runs: WorkflowRun[] }).workflow_runs).map((run) => ({
    id: run.id,
    name: run.name,
    status: run.status,
    conclusion: run.conclusion,
    branch: run.head_branch,
    htmlUrl: run.html_url,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
  }));
}

/** Get repo info (default branch, etc.). */
export async function getRepoInfo(owner: string, repo: string): Promise<unknown | null> {
  return ghFetch(`/repos/${owner}/${repo}`);
}
