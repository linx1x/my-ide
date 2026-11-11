#!/usr/bin/env node
/**
 * Docker entrypoint: run setup if needed, ensure deps when dev mount overlays node_modules, then start the bridge (or run the given command).
 */
import { needsSetup, runSetup, writeEnvFromEnvVars } from './setup.js';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

const DATA_DIR = process.env.DOCKER_DATA_DIR || '/data';

async function ensureNodeModules() {
  const rootLock = '/app/node_modules/.package-lock.json';
  const clientDir = '/app/src/dashboard/client/node_modules';
  if (!existsSync(rootLock)) {
    console.log('[Docker] Installing root dependencies (npm ci)...');
    const npm = spawn('npm', ['ci'], { stdio: 'inherit', cwd: '/app', env: process.env });
    await new Promise<void>((resolve, reject) => {
      npm.on('exit', (code) => {
        if (code === 0) {resolve();}
        else {reject(new Error(`npm ci exited ${code}`));}
      });
    });
  }
  if (!existsSync(clientDir) || !existsSync(clientDir + '/vite')) {
    console.log('[Docker] Installing dashboard client dependencies...');
    const npm = spawn('npm', ['install', '--prefix', 'src/dashboard/client'], {
      stdio: 'inherit',
      cwd: '/app',
      env: process.env,
    });
    await new Promise<void>((resolve, reject) => {
      npm.on('exit', (code) => {
        if (code === 0) {resolve();}
        else {reject(new Error(`npm install client exited ${code}`));}
      });
    });
  }
}

async function main() {
  process.env.DOCKER = '1';
  process.env.DOCKER_DATA_DIR = DATA_DIR;
  process.env.DOTENV_CONFIG_PATH = `${DATA_DIR}/.env`;

  if (needsSetup(DATA_DIR)) {
    const isTTY = process.stdin.isTTY;
    if (!isTTY) {
      if (writeEnvFromEnvVars(DATA_DIR)) {
        console.log('[Docker] First-time config created from ALLOWED_NUMBERS.');
        console.log('[Docker] Check logs for the WhatsApp QR code and scan it with your phone.');
      } else {
        console.log('\n⚠️  First-time setup: set ALLOWED_NUMBERS (see below), or use a terminal.');
        console.log('   Option A — No terminal: In Docker Desktop → bridge container → Duplicate/Edit.');
        console.log('     Add environment: ALLOWED_NUMBERS=1234567890');
        console.log('     Then restart. The QR code will appear in the container logs.');
        console.log('   Option B — With terminal: docker compose run --rm -it bridge\n');
        process.exit(1);
      }
    } else {
      const ok = await runSetup();
      if (!ok) {process.exit(1);}
    }
  }

  // When compose passes a command (e.g. tsx watch src/index.ts), use it; otherwise default to tsx src/index.ts
  const args = process.argv.slice(2);
  const isDev = args[0] === 'tsx' && args[1] === 'watch';
  if (isDev) {
    await ensureNodeModules();
  }

  const cmd = args.length >= 2 && args[0] ? args[0] : 'tsx';
  const cmdArgs = args.length >= 2 ? args.slice(1) : ['src/index.ts'];

  const proc = spawn(cmd, cmdArgs, {
    stdio: 'inherit',
    cwd: '/app',
    env: { ...process.env, DOTENV_CONFIG_PATH: `${DATA_DIR}/.env` },
  });
  proc.on('exit', (code: number | null) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
