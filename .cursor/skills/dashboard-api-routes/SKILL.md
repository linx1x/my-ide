---
name: dashboard-api-routes
description: Adds new Express API routes to the dashboard server with correct auth, CSRF, and path safety. Use when adding an API route, new endpoint, dashboard server route, Express route, or when working on api/files, api/chat, or similar API surface.
---

# Dashboard API Routes

Add new routes in [src/dashboard/server.ts](src/dashboard/server.ts). Follow these patterns so auth, CSRF, and path safety are correct.

## Auth

- Use `authMiddleware` on every `/api/*` route that requires a logged-in user.
- Place it as the first route handler: `app.get("/api/thing", authMiddleware, (req, res) => { ... })`.
- Routes that must stay public (e.g. webhooks, health) do not use `authMiddleware`.

## CSRF

- All POST/PUT/DELETE/PATCH under `/api` already go through `csrfGuard` (applied at line ~602). Do not skip it for new mutating routes.
- The client must call the API via the `api()` helper in [src/dashboard/client/src/api.ts](src/dashboard/client/src/api.ts), which sends `X-Requested-With: fetch`. Never use raw `fetch()` for POST/PUT/DELETE/PATCH from the dashboard client.

## Path safety

- Any route that accepts a file path from the client (query or body) must resolve it with `safePath(relPath, root)`. Root defaults to `getCodebaseRoot()`.
- After `safePath`, check for null: `if (!full) return res.status(403).json({ error: "Invalid path" });`.
- For write or read operations, also reject sensitive paths: `if (isSensitivePath(rel)) return res.status(403).json({ error: "Access denied: sensitive file" });`.
- Use the resolved `full` path for `fs`/read/write; never use raw `req.query.rel` or `req.body.path` for I/O. See bridge-security skill for full rules.

## Route shape

1. **Validate input** — Return 400 when required params are missing or invalid.
2. **Resolve paths** — Use `safePath()` and `isSensitivePath()` when the route touches files.
3. **Logic** — Then run your handler logic.
4. **Response** — Use `res.json(...)` or `res.status(...).json({ error: "..." })`.

## Examples

**GET with optional query (no path):**

```js
app.get("/api/thing", authMiddleware, (req, res) => {
  const { param } = req.query;
  if (!param) return res.status(400).json({ error: "param required" });
  // ... logic
  res.json({ ok: true, data });
});
```

**GET with file path:**

```js
app.get("/api/files/content", authMiddleware, (req, res) => {
  const rel = req.query.path;
  if (!rel) return res.status(400).json({ error: "path required" });
  if (isSensitivePath(rel)) return res.status(403).json({ error: "Access denied: sensitive file" });
  const full = safePath(rel);
  if (!full) return res.status(403).json({ error: "Invalid path" });
  if (!existsSync(full)) return res.status(404).json({ error: "File not found" });
  const content = readFileSync(full, "utf8");
  res.json({ path: rel, content });
});
```

**POST (mutating) with JSON body:**

```js
app.post("/api/thing", authMiddleware, express.json(), (req, res) => {
  const { name, value } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });
  // ... logic
  res.json({ ok: true });
});
```

- For POST/PUT that need a body, use `express.json()` (or the existing json parser). Skip it only for paths listed in `skipJsonPaths` if you add a special case.
- When adding a route that accepts file paths, mirror the pattern used by `/api/files/content`, `/api/files/raw`, `/api/files/rename`, etc.: validate rel, check sensitive, safePath, then I/O.

## Client usage

From the dashboard client, always use:

```ts
import { api } from "../api";
const r = await api("/thing", { method: "POST", body: { name: "x" } });
const data = await r.json();
if (!r.ok) throw new Error(data.error || "Failed");
```

This ensures the CSRF header is sent and credentials are included.
