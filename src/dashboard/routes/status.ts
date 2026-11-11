/**
 * Status API route: GET /api/status.
 * Reports dashboard and codebase health without agent runtime state.
 */
import type express from 'express';
import { execSync } from 'node:child_process';
import config from '../../config.js';
import { isGitRepo } from '../../core/git-utils.js';
import { getProjects } from '../../services/projects.js';
import { isPuppeteerAvailable } from '../../adapters/screenshot.js';
import type { DashboardContext } from '../context.js';

export function registerStatusRoutes(
  app: express.Application,
  ctx: DashboardContext,
): void {
  const { authMiddleware, getCodebaseRoot } = ctx;

  app.get('/api/status', authMiddleware, async (req, res) => {
    const root = getCodebaseRoot();
    let branch: string | null = null;
    if (isGitRepo(root)) {
      try {
        branch = execSync('git rev-parse --abbrev-ref HEAD', {
          cwd: root,
          encoding: 'utf8',
          timeout: 3000,
        }).trim();
      } catch {}
    }
    const projectsData = getProjects();
    const activeProject = projectsData.projects.find((p) => p.id === projectsData.activeProjectId) ?? null;
    let puppeteerAvailable = false;
    try {
      puppeteerAvailable = await isPuppeteerAvailable();
    } catch {
      // ignore
    }
    res.json({
      codebaseRoot: root,
      isGitRepo: isGitRepo(root),
      branch,
      pendingReview: false,
      agentRunning: false,
      agentChatEnabled: config.agentChatEnabled,
      agentStartedAt: null,
      agentDurationMs: 0,
      queueLength: 0,
      projects: projectsData.projects,
      activeProjectId: projectsData.activeProjectId,
      activeProjectName: activeProject?.name ?? null,
      gitPanelStatusPollMs: config.dashboardGitStatusPollMs,
      capabilities: {
        puppeteer: puppeteerAvailable,
      },
    });
  });
}
