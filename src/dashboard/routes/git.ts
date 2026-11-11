/**
 * Git and accept/reject API routes. Mounted at /api/git with authMiddleware applied.
 */
import type express from 'express';
import {
  isGitRepo,
  getChangedFilesDetailed,
  getCommitLog,
  getCommitShow,
  getBranches,
  stageFile,
  stageAll,
  unstageFile,
  unstageAll,
  discardFile,
  getFileDiff,
  commitStaged,
  checkoutBranch,
  createBranch,
  mergeBranch,
  rebaseBranch,
  deleteBranch,
  fetchAll,
  pullCurrent,
  pushBranch,
  getCurrentBranch,
} from '../../core/git-utils.js';
import type { DashboardContext } from '../context.js';
import { subscribeGitMetadataChanges } from '../git-metadata-watch.js';

export function registerGitRoutes(app: express.Application, ctx: DashboardContext): void {
  const { authMiddleware, getCodebaseRoot } = ctx;
  const errMsg = (err: unknown): string => (err instanceof Error ? err.message : String(err));
  const qStr = (v: unknown): string => (typeof v === 'string' ? v : '');

  app.get('/api/git/log', authMiddleware, (req, res) => {
    const root = getCodebaseRoot();
    if (!isGitRepo(root)) {return res.json({ commits: [] });}
    const limit = Math.min(parseInt(qStr((req as any).query?.limit), 10) || 150, 500);
    res.json({ commits: getCommitLog(root, limit) });
  });

  app.get('/api/git/show', authMiddleware, (req, res) => {
    const root = getCodebaseRoot();
    const hash = qStr((req as any).query?.hash);
    if (!hash || !/^[0-9a-f]{4,40}$/i.test(hash)) {return res.status(400).json({ error: 'invalid hash' });}
    res.json({ stat: getCommitShow(root, hash) });
  });

  app.get('/api/git/branches', authMiddleware, (req, res) => {
    const root = getCodebaseRoot();
    if (!isGitRepo(root)) {return res.json({ local: [], remote: [], current: null });}
    res.json(getBranches(root));
  });

  app.get('/api/git/status', authMiddleware, (req, res) => {
    const root = getCodebaseRoot();
    if (!isGitRepo(root)) {return res.json({ files: [] });}
    res.json({ files: getChangedFilesDetailed(root) });
  });

  app.get('/api/git/live', authMiddleware, (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const sendGitEvent = () => {
      try {
        res.write(`event: git\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`);
        if (typeof (res as any).flush === 'function') {
          (res as any).flush();
        }
      } catch {
        /* client gone */
      }
    };

    const unsub = subscribeGitMetadataChanges(getCodebaseRoot, sendGitEvent);

    const heartbeat = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        /* ignore */
      }
    }, 30000);

    try {
      res.write('event: ready\ndata: {}\n\n');
    } catch {}

    req.on('close', () => {
      clearInterval(heartbeat);
      unsub();
    });
  });

  app.post('/api/git/stage', authMiddleware, (req, res) => {
    const root = getCodebaseRoot();
    const { path: filePath, all } = req.body || {};
    try {
      if (all) {stageAll(root);}
      else {
        if (!filePath) {return res.status(400).json({ error: 'path required' });}
        stageFile(root, filePath);
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: errMsg(err) });
    }
  });

  app.post('/api/git/unstage', authMiddleware, (req, res) => {
    const root = getCodebaseRoot();
    const { path: filePath, all } = req.body || {};
    try {
      if (all) {unstageAll(root);}
      else {
        if (!filePath) {return res.status(400).json({ error: 'path required' });}
        unstageFile(root, filePath);
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: errMsg(err) });
    }
  });

  app.post('/api/git/discard', authMiddleware, (req, res) => {
    const root = getCodebaseRoot();
    const { path: filePath, untracked } = req.body || {};
    if (!filePath) {return res.status(400).json({ error: 'path required' });}
    try {
      discardFile(root, filePath, !!untracked);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: errMsg(err) });
    }
  });

  app.get('/api/git/file-diff', authMiddleware, (req, res) => {
    const root = getCodebaseRoot();
    const filePath = qStr((req as any).query?.path);
    const staged = qStr((req as any).query?.staged);
    if (!filePath) {return res.status(400).json({ error: 'path required' });}
    res.json({ diff: getFileDiff(root, filePath, staged === '1' || staged === 'true') });
  });

  app.post('/api/git/commit', authMiddleware, (req, res) => {
    const root = getCodebaseRoot();
    const { message } = req.body || {};
    if (!message?.trim()) {return res.status(400).json({ error: 'message required' });}
    try {
      commitStaged(root, message.trim());
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: errMsg(err) });
    }
  });

  app.post('/api/git/checkout', authMiddleware, (req, res) => {
    const root = getCodebaseRoot();
    const { branch } = req.body || {};
    if (!branch) {return res.status(400).json({ error: 'branch required' });}
    try {
      checkoutBranch(root, branch);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: errMsg(err) });
    }
  });

  app.post('/api/git/create-branch', authMiddleware, (req, res) => {
    const root = getCodebaseRoot();
    const { name } = req.body || {};
    if (!name?.trim()) {return res.status(400).json({ error: 'name required' });}
    try {
      createBranch(root, name.trim());
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: errMsg(err) });
    }
  });

  app.post('/api/git/merge', authMiddleware, (req, res) => {
    const root = getCodebaseRoot();
    const { branch } = req.body || {};
    if (!branch) {return res.status(400).json({ error: 'branch required' });}
    try {
      mergeBranch(root, branch);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: errMsg(err) });
    }
  });

  app.post('/api/git/fetch', authMiddleware, (req, res) => {
    const root = getCodebaseRoot();
    try {
      res.json({ ok: true, output: fetchAll(root) });
    } catch (err) {
      res.status(500).json({ error: errMsg(err) });
    }
  });

  app.post('/api/git/pull', authMiddleware, (req, res) => {
    const root = getCodebaseRoot();
    try {
      res.json({ ok: true, output: pullCurrent(root) });
    } catch (err) {
      res.status(500).json({ error: errMsg(err) });
    }
  });

  app.post('/api/git/push', authMiddleware, (req, res) => {
    const root = getCodebaseRoot();
    try {
      const branch = getCurrentBranch(root);
      if (!branch) {throw new Error('Not on a named branch');}
      res.json({ ok: true, output: pushBranch(root, branch) });
    } catch (err) {
      res.status(500).json({ error: errMsg(err) });
    }
  });

  app.post('/api/git/rebase', authMiddleware, (req, res) => {
    const root = getCodebaseRoot();
    const { branch } = req.body || {};
    if (!branch) {return res.status(400).json({ error: 'branch required' });}
    try {
      rebaseBranch(root, branch);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: errMsg(err) });
    }
  });

  app.post('/api/git/delete-branch', authMiddleware, (req, res) => {
    const root = getCodebaseRoot();
    const { branch } = req.body || {};
    if (!branch) {return res.status(400).json({ error: 'branch required' });}
    const current = getCurrentBranch(root);
    if (branch === current) {return res.status(400).json({ error: 'Cannot delete the current branch' });}
    try {
      deleteBranch(root, branch);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: errMsg(err) });
    }
  });
}
