---
name: fullstack-preview-runner
description: Documents industry standards and design patterns for server-side fullstack preview runners. Use when building or refactoring template-based preview systems, multi-service dev orchestration, dependency warmup, or manifest-driven start procedures.
---

# Fullstack Preview Runner (Server-Side)

Design patterns and industry standards for running fullstack app previews on the server: template warmup, workspace isolation, multi-service orchestration, dependency caching, port allocation, and process lifecycle.

## Template pre-warming

Pre-install dependencies in template directories at startup so the first preview starts quickly.

- **Node/npm**: Run `npm install` (or `bun install`) in each template root and in backend `server/` (or `api/`) subdirs that have `package.json`. Preserve `node_modules` when copying the template into a workspace so the preview skips install.
- **Bun**: Use `bun install` and `bun run dev`; warmup is the same as npm (produces `node_modules`).
- **Deno**: No `node_modules`. Run `deno cache <entry>` to prefetch JSR/URL deps. Skip when `deno.lock` exists. Use `deno task dev` to run.
- **Concurrency**: Limit parallel installs (e.g. 4) to avoid OOM. Batch warmup by framework dirs then backend dirs.
- **Manifest-driven**: Read `manifest.json` per template for `runtime`, `cwd`, and `install`; use `install` to choose runner (npm vs bun vs deno cache).

## Workspace isolation

- **Ephemeral workspaces**: Copy template from disk into a unique workspace dir (e.g. `preview/builder-<uuid>`). Do not mutate the template on disk.
- **Overlay then run**: After copy, apply user overlay files (e.g. edited components), then run install (if not cached) and dev.
- **Cleanup**: Remove workspace on preview stop or timeout; retry remove on Windows (handles locked files).

## Manifest-driven start procedure

Each template has a manifest (`runtime`, `cwd`, `install`, `dev`, optional `services`).

- **Single service**: `install` then `dev`, with `{port}` substituted. Use `cwd` for working directory.
- **Multi-service (fullstack)**: `services: [{ name, cwd, install?, dev, defaultPort }]`. Run all installs in parallel, then start all dev processes in parallel. Expose the preview port (e.g. `previewServiceIndex: 0` for frontend).
- **Framework-specific dev args**: Next.js uses `-p {port} --hostname 127.0.0.1`; Vite uses `--port {port} --strictPort --host 127.0.0.1`. Use the correct CLI flags per runtime.

## Dependency caching

- **Skip install when cached**: If `node_modules` exists (or `deno.lock` for Deno), skip install and log "Using cached dependencies". Run install only when cache is missing or user adds deps (incremental install).
- **Do not delete after copy**: When materializing a workspace from a template, do not remove copied `node_modules`; warmup is intended to make copy-and-run fast.

## Port allocation

- Reserve a range (e.g. 5173–5199 for previews). For multi-service, reserve one port per service up front (e.g. frontend 5173, backend 4000) so no race.
- Check port free with a short TCP connect or listen probe. On Windows, prefer `.cmd` variants for npm/bun/deno when spawning.

## Process lifecycle

- **Spawn**: Use `child_process.spawn` with `PORT` and `HOST` in env. On Windows, run npm/bun/deno via shell or normalized command (`npm.cmd`, etc.) so batch scripts are found.
- **Ready detection**: Poll TCP until the process listens, or HTTP GET until 200. Timeout after ~90s and surface last stderr.
- **Teardown**: Terminate process tree (SIGTERM then SIGKILL; on Windows use `taskkill /T /F`). Close any static HTTP server handles. Remove ephemeral workspace with retry.

## Native runtimes (npm vs bun vs deno)

- **Registry**: Maintain a backend registry mapping backend id → `{ cwd, install, dev, defaultPort }`. Use native commands: `bun install` / `bun run dev`, `deno cache src/main.ts` / `deno task dev`, not npm for those runtimes.
- **Write manifests to disk**: When emitting templates to disk, set per-backend manifest overrides so `manifest.json` contains the correct `install` and `dev` for that runtime.
