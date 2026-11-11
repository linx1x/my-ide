/**
 * GitHub API routes: workflow (PRs, Actions).
 */
import type express from 'express';
import { execSync } from 'node:child_process';
import { getGitHubOwnerRepo, getPullRequests, getWorkflowRuns } from '../../adapters/github.js';
import type { DashboardContext } from '../context.js';

export function registerGithubRoutes(app: express.Application, ctx: DashboardContext): void {
  const { authMiddleware, getCodebaseRoot, getActiveProject } = ctx;

  app.get('/api/github/workflow', authMiddleware, async (req, res) => {
    const root = getActiveProject()?.path || getCodebaseRoot();
    const gh = getGitHubOwnerRepo(root);
    if (!gh) {
      return res.json({ ok: false, error: 'Not a GitHub repo', repo: null, prs: [], runs: [], branch: null });
    }
    let branch: string | null = null;
    try {
      branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: root, encoding: 'utf8', timeout: 3000 }).trim();
    } catch {}
    const [prs, runs] = await Promise.all([
      getPullRequests(gh.owner, gh.repo, branch),
      getWorkflowRuns(gh.owner, gh.repo, branch),
    ]);
    res.json({
      ok: true,
      repo: { owner: gh.owner, repo: gh.repo },
      branch,
      prs: (prs as Array<{ number: number; title: string; state: string; html_url: string; head?: { ref: string }; created_at: string }>).map((p) => ({
        number: p.number,
        title: p.title,
        state: p.state,
        htmlUrl: p.html_url,
        headRef: p.head?.ref,
        createdAt: p.created_at,
      })),
      runs,
    });
  });
}
