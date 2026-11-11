# Marketing Video Script

Narrative and scene list for the Remotion marketing video. FPS: 30. All durations in frames.

## Scene list (order and duration)

| # | Type   | Key / Filename           | Duration (frames) | Notes |
|---|--------|---------------------------|-------------------|--------|
| 1 | text   | hook                      | 90                | 3s – problem |
| 2 | text   | solution                  | 90                | 3s – product |
| 3 | capture| dashboard-overview.png   | 120               | 4s – overview |
| 4 | capture| chat-panel.png            | 120               | 4s – chat |
| 5 | capture| file-explorer.png         | 90                 | 3s – files |
| 6 | capture| terminal.png              | 120                | 4s – terminal |
| 7 | capture| project-builder.png       | 120                | 4s – builder |
| 8 | text   | features                  | 90                 | 3s – bullets |
| 9 | text   | cta                       | 120                | 4s – CTA |

Total: 9 sequences. Sum of durations = 90+90+120+120+90+120+120+90+120 = 960 frames. With 8 transitions × 15 frames = 120 overlap → **840 frames** (~28s). For a longer video, increase durationInFrames per scene in the composition.

## Text slide copy

### hook (scene 1)
- **Title:** Code from your phone?
- **Subtitle:** Manage repos. Ship features. From anywhere.

### solution (scene 2)
- **Title:** My IDE
- **Subtitle:** Cursor AI + Web IDE. From your phone or browser.

### features (scene 9)
- **Title:** Built for power users
- **Subtitle:** Multi-agent orchestration · Accept/Reject flow · Project builder from a prompt

### cta (scene 10)
- **Title:** Try it
- **Subtitle:** My IDE — try it

## Capture filenames (from Puppeteer script)

- `dashboard-overview.png`, `dashboard-editor.png`, `chat-panel.png`, `file-explorer.png`, `git-panel.png`, `terminal.png`
- **App creation A–Z:** `builder-step0-template.png` … `builder-step5-cta.png`, `builder-final-filled.png`
- `theme-cyberpunk.png`, `theme-matrix.png`, `theme-glass.png`, `theme-tactical-dark.png`

See [landing-script.md](./landing-script.md) for the landing page description and choices used in the builder flow.

## Auth note

If the dashboard requires login, run the capture script after logging in once (same browser session is not shared; use a public/demo route or pre-captured assets).
