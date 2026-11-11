# Marketing Video

Remotion project for the My IDE marketing video. Uses pre-captured dashboard screenshots and text slides with transitions.

## Prerequisites

1. **Captures:** Start the dashboard and log in in your browser. Then give the script your session so it can get past the login page:

   - In Chrome/Edge: open DevTools (F12) → **Application** → **Cookies** → select your dashboard URL (e.g. `http://localhost:3848`) → find **dashboard_token** and copy its **Value**.
   - Either set it when running:
     ```bash
     set DASHBOARD_VIDEO_TOKEN=paste_value_here
     npm run capture:video -- --url http://localhost:3848
     ```
     (On macOS/Linux use `export DASHBOARD_VIDEO_TOKEN=...`.)
   - Or put the value in a file (one line, no quotes): `marketing-video/capture-token.txt`. That file is gitignored. Then:
     ```bash
     npm run capture:video -- --url http://localhost:3848
     ```

   This fills `public/captures/` with PNGs (including theme variants and editor-with-file). If you see the login page in the video, the script didn’t get a valid token (expired or missing). Copy a fresh `dashboard_token` and try again.

2. **Remotion:** Install and run from this folder:

   ```bash
   cd marketing-video
   npm install
   npm start
   ```

   Then open the Remotion Studio URL (e.g. http://localhost:3000), select the **MarketingVideo** composition, and preview or render.

## Render to file

```bash
npm run render
```

Output: `out/marketing.mp4`.

### Matrix Birthday composition

- **ASCII art** lives in plain text under `src/ascii/` (`matrix-birthday-cat.txt`, `matrix-birthday-cake.txt`). Edit those files directly—no escaping in TypeScript.
- **Imports:** `remotion.config.ts` registers a webpack rule so `import text from "./ascii/foo.txt"` resolves to a string (`src/webpack-override.ts`, `src/txt-imports.d.ts`).
- Render MP4: `npm run render:matrix-birthday` → `out/matrix-birthday.mp4`.
- Render GIF (fluid 30fps, every frame; scaled ~65% for sane file size): `npm run render:matrix-birthday-gif` → `out/matrix-birthday.gif`. For full HD GIF, drop `--scale=0.65` from the script in `package.json` (much larger file). 60fps GIFs are usually impractical; this composition stays at **30fps** for smooth motion without huge encodes.

## Scene list and copy

See [SCRIPT.md](./SCRIPT.md) for the narrative, text slide copy, and capture filenames.
