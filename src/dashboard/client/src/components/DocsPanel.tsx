export function DocsPanel() {
  return (
    <>
      <div className="sidebar-header">
        <span className="sidebar-title">HOW IT WORKS</span>
      </div>
      <div className="sidebar-body docs-panel">
        <details className="docs-section" open>
          <summary className="docs-section-title">Architecture</summary>
          <div className="docs-section-body">
            <details className="docs-qa">
              <summary>What is this project?</summary>
              <div className="docs-qa-body">
                My IDE is a WhatsApp-authenticated dashboard for files, source control,
                terminal sessions, previews, database tools, n8n, and an optional Mastra
                agent chat (dashboard-only; enable with AGENT_CHAT_ENABLED=1 and provider keys).
              </div>
            </details>
            <details className="docs-qa">
              <summary>High-level data flow</summary>
              <div className="docs-qa-body">
                <pre className="docs-ascii">{`Browser dashboard
        ↓
Express routes + WebSockets
        ↓
Files / Git / terminal / preview APIs

WhatsApp
        ↓
OTP delivery for dashboard login`}</pre>
              </div>
            </details>
          </div>
        </details>

        <details className="docs-section">
          <summary className="docs-section-title">Login</summary>
          <div className="docs-section-body">
            <details className="docs-qa">
              <summary>How does WhatsApp work now?</summary>
              <div className="docs-qa-body">
                WhatsApp uses Baileys and remains connected for dashboard OTP delivery.
                Only numbers in <code>ALLOWED_NUMBERS</code> can request login codes.
              </div>
            </details>
            <details className="docs-qa">
              <summary>How is login handled?</summary>
              <div className="docs-qa-body">
                Request a code, receive it in WhatsApp, enter it in the browser, and
                receive an httpOnly JWT cookie. OTP requests are rate limited.
              </div>
            </details>
          </div>
        </details>

        <details className="docs-section">
          <summary className="docs-section-title">Dashboard</summary>
          <div className="docs-section-body">
            <details className="docs-qa">
              <summary>What does the file explorer do?</summary>
              <div className="docs-qa-body">
                The file explorer provides a project tree and Codeium editor with create,
                rename, delete, syntax highlighting, and save support. Path traversal is
                blocked server-side.
              </div>
            </details>
            <details className="docs-qa">
              <summary>What is the terminal?</summary>
              <div className="docs-qa-body">
                The integrated xterm.js terminal connects via WebSocket to a real shell on
                the server. Sensitive environment variables are stripped before spawn.
              </div>
            </details>
            <details className="docs-qa">
              <summary>What is the n8n button?</summary>
              <div className="docs-qa-body">
                It opens n8n as an embedded editor tab through the app reverse proxy.
                Configure it with <code>N8N_ENABLED</code>, <code>N8N_INTERNAL_URL</code>,
                and <code>N8N_PUBLIC_PATH</code>.
              </div>
            </details>
          </div>
        </details>

        <details className="docs-section">
          <summary className="docs-section-title">Git Workflow</summary>
          <div className="docs-section-body">
            <details className="docs-qa">
              <summary>What git tools are available?</summary>
              <div className="docs-qa-body">
                The Source Control panel can inspect changes, stage and unstage files,
                commit staged work, switch branches, fetch, pull, and push.
              </div>
            </details>
            <details className="docs-qa">
              <summary>What branch protection is in place?</summary>
              <div className="docs-qa-body">
                <code>PROTECTED_BRANCHES</code> protects important branches in dashboard
                git flows.
              </div>
            </details>
          </div>
        </details>
      </div>
    </>
  );
}
