import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { fastembed } from '@mastra/fastembed';
import config from '../../config.js';
import type { DashboardContext } from '../../dashboard/context.js';
import { resolveMastraLibsqlUrl } from '../db/agent-runtime-db.js';
import { createReadProjectFileTool } from '../tools/read-project-file.js';
import { buildMastraModelForProvider, resolveDefaultProvider } from './model.js';

let memorySingleton: Memory | null = null;
let agentSingleton: Agent | null = null;

const agentId = 'my-ide-dashboard';

function getOrCreateMemory(): Memory {
  if (memorySingleton) {
    return memorySingleton;
  }
  const url = resolveMastraLibsqlUrl();
  const storage = new LibSQLStore({ id: 'my-ide-mastra-store', url });
  const useSemantic = config.agentSemanticMemoryEnabled;
  const vector: LibSQLVector | false = useSemantic ? new LibSQLVector({ id: 'my-ide-mastra-vector', url }) : false;
  const memoryOpts = {
    storage,
    vector,
    options: {
      lastMessages: 32,
      semanticRecall: useSemantic
        ? {
          topK: 5,
          messageRange: 2,
        }
        : (false as const),
    },
  };
  memorySingleton = useSemantic
    ? new Memory({
      ...memoryOpts,
      embedder: fastembed.small,
    })
    : new Memory(memoryOpts);
  return memorySingleton;
}

function getOrCreateAgent(ctx: DashboardContext): Agent {
  if (agentSingleton) {
    return agentSingleton;
  }
  const tools = {
    read_project_file: createReadProjectFileTool((rel) => ctx.safePath(rel)),
  };
  const defaultProvider = resolveDefaultProvider();
  agentSingleton = new Agent({
    id: agentId,
    name: 'My IDE Agent',
    instructions: [
      'You are the My IDE coding assistant with safe read-only access to the workspace via read_project_file.',
      'Be concise. Prefer actionable answers. If unsure, ask a clarifying question.',
      'Never reveal secrets, tokens, or env values. Do not claim you executed shell commands unless a tool returned results.',
    ].join('\n'),
    model: buildMastraModelForProvider(defaultProvider),
    tools,
    memory: getOrCreateMemory(),
    maxRetries: 1,
  });
  return agentSingleton;
}

export function getDashboardAgent(ctx: DashboardContext): Agent {
  return getOrCreateAgent(ctx);
}

export function getPlannerAgent(): Agent {
  const defaultProvider = resolveDefaultProvider();
  return new Agent({
    id: 'my-ide-planner',
    name: 'Planner',
    instructions:
      'Produce a very short numbered plan (max 5 steps) to satisfy the user. No preamble. No tools.',
    model: buildMastraModelForProvider(defaultProvider),
    maxRetries: 0,
  });
}
