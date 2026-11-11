/**
 * In-memory project clone jobs and SSE progress streaming.
 */
import { randomUUID } from 'node:crypto';
import config from '../config.js';
import { logger } from '../logger.js';

type ProjectJob = {
  status: string;
  logs: string[];
  result: unknown;
  error: unknown;
  watchers: Set<any>;
  createdAt?: number;
  finishedAt?: number;
};
const projectJobs = new Map<string, ProjectJob>();

function pruneProjectJobs() {
  const max = config.projectJobsMaxEntries;
  const retention = config.projectJobsFinishedRetentionMs;
  const now = Date.now();
  for (const [jobId, job] of [...projectJobs]) {
    if (job.status === 'running') {continue;}
    const finishedAt = job.finishedAt || 0;
    if (finishedAt && now - finishedAt > retention) {
      projectJobs.delete(jobId);
    }
  }
  while (projectJobs.size >= max) {
    let victim = null;
    let oldest = Infinity;
    for (const [id, job] of projectJobs) {
      if (job.status === 'running') {continue;}
      const t = job.finishedAt || job.createdAt || 0;
      if (t < oldest) {
        oldest = t;
        victim = id;
      }
    }
    if (!victim) {break;}
    logger.warn({ jobId: victim }, 'Dashboard: evicted finished project job (PROJECT_JOBS_MAX_ENTRIES)');
    projectJobs.delete(victim);
  }
}

export function createProjectJob() {
  pruneProjectJobs();
  if (projectJobs.size >= config.projectJobsMaxEntries) {
    logger.warn('Dashboard: project job cap reached (too many concurrent clone jobs)');
    return null;
  }
  const id = randomUUID();
  const job = {
    status: 'running',
    logs: [],
    result: null,
    error: null,
    watchers: new Set(),
    createdAt: Date.now(),
    finishedAt: 0,
  };
  projectJobs.set(id, job);
  return { id, job };
}

export function pushProjectJobLog(job: ProjectJob, line: string) {
  const text = String(line || '');
  if (!text) {return;}
  job.logs.push(text);
  if (job.logs.length > 500) {job.logs = job.logs.slice(-500);}
  const payload = `event: progress\ndata: ${JSON.stringify({ line: text })}\n\n`;
  for (const res of job.watchers) {
    if (res.destroyed) {continue;}
    res._sseQueue = res._sseQueue || [];
    res._sseQueue.push(payload);
    if (res._sseProcessing) {continue;}
    res._sseProcessing = true;
    const flush = () => {
      if (!res._sseQueue || res._sseQueue.length === 0) {
        res._sseProcessing = false;
        return;
      }
      const chunk = res._sseQueue.shift();
      if (!res.write(chunk)) {
        res._sseQueue.unshift(chunk);
        res.once('drain', flush);
      } else {
        setImmediate(flush);
      }
    };
    flush();
  }
}

export function finishProjectJob(jobId: string, status: string, payload: any = {}) {
  const job = projectJobs.get(jobId);
  if (!job) {return;}
  job.status = status;
  job.finishedAt = Date.now();
  if (payload.result !== undefined) {job.result = payload.result;}
  if (payload.error !== undefined) {job.error = payload.error;}
  for (const res of job.watchers) {
    res.write(
      `event: done\ndata: ${JSON.stringify({ status: job.status, result: job.result, error: job.error })}\n\n`,
    );
    res.end();
  }
  job.watchers.clear();
  const retention = config.projectJobsFinishedRetentionMs;
  setTimeout(() => {
    projectJobs.delete(jobId);
    pruneProjectJobs();
  }, retention);
}

export function getProjectJob(jobId: string) {
  return projectJobs.get(jobId);
}
