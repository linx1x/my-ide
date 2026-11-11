import { createTool } from '@mastra/core/tools';
import { readFileSync } from 'node:fs';
import { z } from 'zod';

export function createReadProjectFileTool(safePath: (rel: string) => string | null) {
  return createTool({
    id: 'read_project_file',
    description:
      'Read a UTF-8 text file from the active codebase root. Path is project-relative; sensitive paths are blocked server-side.',
    inputSchema: z.object({
      path: z.string().min(1).describe('Relative file path from codebase root'),
    }),
    execute: async ({ path: rel }) => {
      const resolved = safePath(rel);
      if (!resolved) {
        return { ok: false as const, error: 'Invalid or blocked path' };
      }
      try {
        const content = readFileSync(resolved, 'utf8');
        const max = 120_000;
        return {
          ok: true as const,
          path: rel,
          truncated: content.length > max,
          content: content.length > max ? content.slice(0, max) : content,
        };
      } catch (e) {
        return { ok: false as const, error: e instanceof Error ? e.message : 'read failed' };
      }
    },
  });
}
