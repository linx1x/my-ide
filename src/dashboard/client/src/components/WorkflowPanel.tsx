import { useLayout } from '../context/LayoutContext';
import { useWorkflow } from '../hooks/useWorkflow';
import { Skeleton } from './Skeleton';

type WorkflowRun = {
  id: string | number;
  name: string;
  status?: string;
  conclusion?: string | null;
  htmlUrl: string;
};
type PullRequest = { number: number; title: string; state: string; htmlUrl: string };
type RepoInfo = { owner: string; repo: string };

function RunStatus({ run }: { run: WorkflowRun }) {
  const status = run.conclusion || run.status;
  const passed = run.conclusion === 'success';
  const failed = run.conclusion === 'failure';
  const running = run.status === 'in_progress' || run.status === 'queued';

  let cls = 'workflow-run';
  if (passed) {cls += ' success';}
  else if (failed) {cls += ' failure';}
  else if (running) {cls += ' running';}
  else {cls += ' pending';}

  return (
    <a
      href={run.htmlUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cls}
      title={`${run.name} — ${status}`}
    >
      <span className="run-dot" />
      <span className="run-name">{run.name}</span>
      <span className="run-status">
        {passed ? '✓ Passed' : failed ? '✗ Failed' : running ? '● Running' : status || '—'}
      </span>
    </a>
  );
}

export function WorkflowPanel() {
  const { activePanel } = useLayout();
  const { ok, repo, branch, prs, runs, error, loading, refresh } = useWorkflow(activePanel) as any;
  const repoInfo = repo as RepoInfo | null;
  const pullRequests = (prs ?? []) as PullRequest[];
  const workflowRuns = (runs ?? []) as WorkflowRun[];

  return (
    <>
      <div className="sidebar-header">
        <span className="sidebar-title">WORKFLOW</span>
        <button className="icon-btn" onClick={() => refresh()} disabled={loading} title="Refresh">
          ↻
        </button>
      </div>
      <div className="sidebar-body">
        {loading && !repo && (
          <div className="workflow-loading-skeleton" aria-busy="true">
            <Skeleton variant="text" style={{ width: '60%', marginBottom: 8 }} />
            <Skeleton variant="text" style={{ width: '80%', marginBottom: 12 }} />
            <Skeleton variant="rect" height={24} style={{ width: '100%', marginBottom: 8 }} />
            <Skeleton variant="rect" height={20} style={{ width: '70%' }} />
          </div>
        )}
        {error && !ok && (
          <div className="workflow-error">
            {error}
            {error === 'Not a GitHub repo' && (
              <p className="workflow-hint">Ensure remote.origin points to GitHub.</p>
            )}
          </div>
        )}
        {!loading && ok && repoInfo && (
          <>
            <div className="workflow-branch">
              <strong>Branch:</strong> {branch || '—'}
            </div>
            <div className="workflow-repo">
              {repoInfo.owner}/{repoInfo.repo}
            </div>

            <div className="workflow-section">
              <div className="workflow-section-title">Pull Requests</div>
              {pullRequests.length === 0 ? (
                <p className="workflow-empty">No open PRs for this branch.</p>
              ) : (
                <ul className="workflow-pr-list">
                  {pullRequests.map((pr: PullRequest) => (
                    <li key={pr.number}>
                      <a
                        href={pr.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="workflow-pr"
                      >
                        <span className="pr-title">#{pr.number} {pr.title}</span>
                        <span className="pr-state">{pr.state}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="workflow-section">
              <div className="workflow-section-title">CI/CD (GitHub Actions)</div>
              {workflowRuns.length === 0 ? (
                <p className="workflow-empty">No recent workflow runs.</p>
              ) : (
                <div className="workflow-runs">
                  {workflowRuns.slice(0, 5).map((run: WorkflowRun) => (
                    <RunStatus key={run.id} run={run} />
                  ))}
                </div>
              )}
            </div>

            <div className="workflow-convention">
              <strong>Convention:</strong> Branch = feat/slug, Commit = clear message
            </div>
          </>
        )}
      </div>
    </>
  );
}
