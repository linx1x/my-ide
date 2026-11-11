/**
 * Projects API routes: list, add, clone stream, delete, active, pull.
 */
import type express from 'express';
import { getProjects, addProject, removeProject, setActiveProject, pullProject } from '../../services/projects.js';
import type { DashboardContext } from '../context.js';

export function registerProjectsRoutes(app: express.Application, ctx: DashboardContext): void {
  const paramId = (req: any): string => String(req.params?.id ?? '');
  const { authMiddleware, createProjectJob, pushProjectJobLog, finishProjectJob, getProjectJob } = ctx;

  app.get('/api/projects', authMiddleware, (req, res) => {
    try {
      const data = getProjects();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/projects', authMiddleware, async (req, res) => {
    const { path: inputPath, gitUrl } = req.body || {};
    if (gitUrl) {
      const created = createProjectJob();
      if (!created) {
        return res.status(503).json({
          error: 'Too many project clone jobs. Wait for one to finish or try again later.',
        });
      }
      const { id: jobId, job } = created;
      res.json({ ok: true, jobId });
      addProject({ path: inputPath, gitUrl }, (line: string) => pushProjectJobLog(job, line))
        .then((project) => finishProjectJob(jobId, 'done', { result: project }))
        .catch((err) => finishProjectJob(jobId, 'error', { error: (err as Error).message }));
      return;
    }
    try {
      const project = await addProject({ path: inputPath, gitUrl });
      res.json(project);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.get('/api/projects/clone/:jobId/stream', authMiddleware, (req, res) => {
    const job = getProjectJob(String((req as any).params?.jobId ?? ''));
    if (!job) {return res.status(404).json({ error: 'Job not found' });}
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    for (const line of job.logs) {
      res.write(`event: progress\ndata: ${JSON.stringify({ line })}\n\n`);
    }
    if (job.status !== 'running') {
      res.write(`event: done\ndata: ${JSON.stringify({ status: job.status, result: job.result, error: job.error })}\n\n`);
      return res.end();
    }
    job.watchers.add(res);
    req.on('close', () => job.watchers.delete(res));
  });

  app.delete('/api/projects/:id', authMiddleware, (req, res) => {
    const deleteFiles = req.query.deleteFiles === '1';
    try {
      removeProject(paramId(req), { deleteFiles });
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.put('/api/projects/active', authMiddleware, (req, res) => {
    const { projectId } = req.body || {};
    try {
      setActiveProject(projectId ?? null);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/projects/:id/pull', authMiddleware, async (req, res) => {
    const id = paramId(req);
    const { stream } = req.query;
    if (stream === '1') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      try {
        await pullProject(id, (line: string) => {
          try {
            res.write(`event: progress\ndata: ${JSON.stringify({ line: String(line || '') })}\n\n`);
          } catch {}
        });
        res.write(`event: done\ndata: ${JSON.stringify({ ok: true })}\n\n`);
      } catch (err) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
      }
      return res.end();
    }
    try {
      const project = await pullProject(id);
      res.json({ ok: true, project });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });
}
