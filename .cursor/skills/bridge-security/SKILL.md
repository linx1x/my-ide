---
name: bridge-security
description: Applies security and safety patterns when adding file access, API routes, or logging in My IDE. Use when implementing path-based file operations, new dashboard routes, logging of user data, or when the user mentions safePath, path traversal, sensitive files, blocklist, CSRF, secrets, or security.
---

# My IDE Security

Apply these patterns whenever adding or changing code that touches files, routes, or logs in this codebase.

## Path traversal

- **All user-supplied paths** (query, body, headers) must be resolved via `safePath(relPath, root)` in [src/dashboard/server.ts](src/dashboard/server.ts) (lines 342–346).
- **Never** use raw `req.query.rel`, `req.body.path`, or similar in `fs`/read/write without validation.
- Pattern: `const full = safePath(relPath); if (!full) return res.status(400).json({ error: "Invalid path" });` then use `full` for I/O.
- Root comes from `getCodebaseRoot()` (active project or `DASHBOARD_WORKDIR`). Do not pass untrusted paths to `resolve(root, ...)` without the `full.startsWith(resolve(root))` check that `safePath` performs.

## Sensitive paths

- The server blocklist lives in `SENSITIVE_PATTERNS` and `isSensitivePath()` in [src/dashboard/server.ts](src/dashboard/server.ts) (lines 347–363).
- **Do not** read, write, or expose content of: `.env*`, `auth_store/`, `chat_history/`, `*.pem`, `*.key`, credentials, secrets, `.cursor/mcp.json`, `.npmrc`, `.gitconfig`, `*.sqlite*`, `bridge-data/`.
- File tree, search, and raw/content endpoints already filter these; any new file-serving or path-accepting route must use `safePath()` and must not serve paths for which `isSensitivePath(relPath)` is true.

## Secrets

- **Never** log or echo API keys, `DASHBOARD_SECRET`, OTPs, auth tokens, or other secrets.
- Read configuration only through [src/config.ts](src/config.ts); do not use `process.env` directly in application code or logs.
- If adding new env vars, add them in config and (if sensitive) include in any strip/list used before spawning child processes or sending data to clients.

## CSRF

- All POST/PUT/DELETE/PATCH under `/api` are protected by `csrfGuard` (server.ts ~577–601). No extra middleware needed for new routes.
- Client must use the `api()` helper from [src/dashboard/client/src/api.js](src/dashboard/client/src/api.js) so `X-Requested-With: fetch` is sent. Do not use raw `fetch()` for mutating requests.

## Rate limiting

- Auth routes use `authLimiter`; general API uses `apiLimiter`; search and skills have their own limiters. When adding new auth or public-facing endpoints, attach the appropriate limiter.

## ReDoS

- Avoid `new RegExp(userInput)`. Search uses literal `String.includes()` and a query length cap (e.g. 200 chars). Do not build regexes from unsanitized user input.

## Checklist

When adding file access, new routes, or logging:

- [ ] User-supplied paths go through `safePath()`; null/out-of-root handled.
- [ ] No read/write of blocklisted paths; `isSensitivePath()` respected.
- [ ] No secrets in logs or responses; config via config.ts.
- [ ] Mutating routes are under `/api` (csrfGuard applied); client uses `api()`.
- [ ] New auth or heavy public endpoints have rate limiting.
- [ ] No regex built from raw user input (ReDoS).
