/**
 * MCP stdio server exposing read-only workspace tools (same bounds as dashboard safePath).
 * Usage: npx tsx scripts/agent-mcp-server.ts
 * Configure CODEX_ROOT or rely on DASHBOARD_WORKDIR / cwd for codebase root.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import config from '../src/config.js';
import { safePathResolve } from '../src/dashboard/path-utils.js';

function codebaseRoot(): string {
  const envRoot = process.env.MCP_CODEBASE_ROOT?.trim();
  if (envRoot) {
    return resolve(envRoot);
  }
  return resolve(config.codebaseWorkDir);
}

const root = codebaseRoot();

const server = new McpServer(
  { name: 'my-ide-bridge-tools', version: '1.0.0' },
  { instructions: `Read-only tools for workspace rooted at ${root}` },
);

server.registerTool(
  'workspace_root',
  {
    description: 'Return the absolute codebase root used for path validation.',
  },
  async () => ({
    content: [{ type: 'text', text: JSON.stringify({ root }) }],
  }),
);

server.registerTool(
  'read_project_file',
  {
    description: 'Read a UTF-8 text file relative to the workspace root.',
    inputSchema: z.object({
      path: z.string().min(1).describe('Relative path from workspace root'),
    }),
  },
  async ({ path: rel }) => {
    const abs = safePathResolve(rel, root);
    if (!abs) {
      return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'invalid_or_blocked_path' }) }],
      };
    }
    try {
      const content = readFileSync(abs, 'utf8');
      const max = 120_000;
      const payload = {
        ok: true,
        path: rel,
        truncated: content.length > max,
        content: content.length > max ? content.slice(0, max) : content,
      };
      return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
    } catch (e) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({ ok: false, error: e instanceof Error ? e.message : 'read_failed' }),
          },
        ],
      };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
