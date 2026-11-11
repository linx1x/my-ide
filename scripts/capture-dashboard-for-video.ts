/**
 * Captures dashboard screenshots for the Remotion marketing video.
 * Run with the dashboard already running (e.g. http://localhost:3847 or :5173).
 *
 * Auth: The dashboard requires login. After logging in in your browser, copy the
 * session cookie and pass it so the script can reuse your session:
 *   1. In Chrome DevTools: Application → Cookies → your dashboard URL → copy the
 *      value of the "dashboard_token" cookie.
 *   2. Set env DASHBOARD_VIDEO_TOKEN=<paste> or put the value in
 *      marketing-video/capture-token.txt (one line, no quotes). Then run this script.
 *
 * Usage:
 *   npx tsx scripts/capture-dashboard-for-video.ts
 *   npx tsx scripts/capture-dashboard-for-video.ts --url http://localhost:5173
 *   npm run capture:video -- --url http://localhost:3848
 *   npm run capture:video -- --url http://localhost:3848 --headed   (show browser window)
 */
import { config as loadEnv } from 'dotenv';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

loadEnv({ path: resolve(ROOT, '.env') });

const DEFAULT_BASE_URL = process.env.DASHBOARD_VIDEO_URL || 'http://localhost:3847';
const DEFAULT_OUT_DIR = resolve(ROOT, 'marketing-video', 'public', 'captures');
const TOKEN_FILE = resolve(ROOT, 'marketing-video', 'capture-token.txt');
const VIEWPORT = { width: 1920, height: 1080 };

const WAIT_MS = 800;
const PAGE_TIMEOUT = 20000;

function getAuthToken(): string | null {
  const fromEnv = process.env.DASHBOARD_VIDEO_TOKEN?.trim();
  if (fromEnv) {return fromEnv;}
  if (existsSync(TOKEN_FILE)) {
    try {
      const value = readFileSync(TOKEN_FILE, 'utf8').trim();
      if (value) {return value;}
    } catch {
      // ignore
    }
  }
  return null;
}

function parseArgs(): { baseUrl: string; outDir: string; headed: boolean } {
  const args = process.argv.slice(2);
  let baseUrl = DEFAULT_BASE_URL;
  let outDir = DEFAULT_OUT_DIR;
  let headed = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === '--url' && next) {
      baseUrl = next;
      i++;
    } else if ((arg === '--out' || arg === '-o') && next) {
      outDir = resolve(process.cwd(), next);
      i++;
    } else if (args[i] === '--headed' || args[i] === '--no-headless') {
      headed = true;
    }
  }
  return { baseUrl, outDir, headed };
}

type CaptureStep = {
  name: string;
  file: string;
  before?: () => Promise<void>;
  waitSelector?: string;
};

async function run(): Promise<void> {
  const { baseUrl, outDir, headed } = parseArgs();
  if (!outDir.includes('marketing-video')) {
    console.warn('[capture] Warning: output dir is not under marketing-video/; Remotion expects public/captures/.');
  }
  mkdirSync(outDir, { recursive: true });
  console.log('[capture] Dashboard URL:', baseUrl);
  console.log('[capture] Output dir:', outDir);
  if (headed) {console.log('[capture] Headed mode: browser window will open so you can watch.');}

  const puppeteer = await import('puppeteer').catch(() => null);
  if (!puppeteer?.default) {
    console.error('[capture] Puppeteer not installed. Run: npm install puppeteer');
    process.exit(1);
  }

  const browser = await puppeteer.default.launch({
    headless: !headed,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);
    page.setDefaultTimeout(PAGE_TIMEOUT);

    const authToken = getAuthToken();
    if (authToken) {
      const url = new URL(baseUrl);
      const domain = url.hostname === 'localhost' ? 'localhost' : url.hostname;
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });
      await page.setCookie({
        name: 'dashboard_token',
        value: authToken,
        domain,
        path: '/',
      });
      console.log('[capture] Using session cookie for', domain);
    } else {
      console.warn('[capture] No DASHBOARD_VIDEO_TOKEN or capture-token.txt; you may get the login page.');
    }

    // Use domcontentloaded so we don't wait for SSE/WebSocket to "idle" (dashboard keeps connections open)
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });
    await new Promise((r) => setTimeout(r, 2000));

    const onLoginPage = await page.evaluate(() => {
      const doc = (globalThis as { document?: { querySelector: (s: string) => unknown; body?: { innerText?: string } } }).document;
      if (!doc) {return false;}
      const hasPhoneInput = !!doc.querySelector('input[type="tel"], input[placeholder*="phone"], input[placeholder*="Phone"]');
      const hasSendCode = /\bsend code\b/i.test(doc.body?.innerText || '');
      return hasPhoneInput || hasSendCode;
    }).catch(() => false);

    if (onLoginPage) {
      console.error('[capture] Still on login page. Log in once in your browser, then copy the dashboard_token cookie (DevTools → Application → Cookies → your dashboard URL) into DASHBOARD_VIDEO_TOKEN or marketing-video/capture-token.txt and run again.');
      process.exit(1);
    }

    try {
      await page.waitForSelector('.ide-layout, .activity-bar', { timeout: 8000 });
    } catch {
      console.warn('[capture] .ide-layout not found; continuing.');
    }

    const click = async (selector: string) => {
      await page.click(selector).catch(() => {});
      await new Promise((r) => setTimeout(r, WAIT_MS));
    };

    const openFirstFileInExplorer = async () => {
      await click('[aria-label="explorer"]');
      await new Promise((r) => setTimeout(r, 600));
      const fileRow = await page.$('.tree-item.file');
      if (fileRow) {
        await fileRow.click();
        await new Promise((r) => setTimeout(r, 800));
      }
    };

    const setTheme = async (themeName: string) => {
      await click('[aria-label="settings"]');
      await new Promise((r) => setTimeout(r, 500));
      const themeBtn = await page.$(`button[title="${themeName}"]`);
      if (themeBtn) {await themeBtn.click();}
      await new Promise((r) => setTimeout(r, 600));
      await click('[aria-label="explorer"]');
      await new Promise((r) => setTimeout(r, 400));
    };

    const clickBuilderOptionByLabel = async (label: string) => {
      await page.evaluate((text) => {
        const doc = (globalThis as { document?: { querySelectorAll: (s: string) => unknown } }).document;
        const buttons = doc ? Array.from(doc.querySelectorAll('.builder-option-btn') as ArrayLike<{ textContent?: string; click: () => void }>) : [];
        const btn = buttons.find((b) => b.textContent?.includes(text));
        btn?.click();
      }, label);
      await new Promise((r) => setTimeout(r, 400));
    };

    const clickBuilderNext = async () => {
      const nextBtn = await page.$('.builder-next-btn');
      if (nextBtn) {await nextBtn.click();}
      await new Promise((r) => setTimeout(r, 600));
    };

    const LANDING_DESCRIPTION =
      'Landing page for a developer tool: hero with headline and subheadline, feature grid (3–4 bullets), single primary CTA button, dark theme. Clean and minimal.';

    const runLandingBuilderFlow = async (): Promise<void> => {
      await click('[aria-label="create-project"]');
      await new Promise((r) => setTimeout(r, 1400));
      await page.waitForSelector('.builder-template-picker, .builder-template-card', { timeout: 8000 }).catch(() => {});
    };

    const steps: CaptureStep[] = [
      {
        name: 'Dashboard overview (Explorer)',
        file: 'dashboard-overview.png',
        waitSelector: '.ide-layout',
      },
      {
        name: 'Dashboard with file open',
        file: 'dashboard-editor.png',
        before: openFirstFileInExplorer,
        waitSelector: '.ide-layout',
      },
      {
        name: 'Chat panel',
        file: 'chat-panel.png',
        before: async () => await click('[aria-label="chat"]'),
        waitSelector: '.chat-panel-body, .sidebar-panel.active',
      },
      {
        name: 'File explorer',
        file: 'file-explorer.png',
        before: async () => await click('[aria-label="explorer"]'),
        waitSelector: '.explorer-panel, .sidebar-panel.active',
      },
      {
        name: 'Git panel',
        file: 'git-panel.png',
        before: async () => await click('[aria-label="git"]'),
        waitSelector: '.git-panel, .sidebar-panel.active',
      },
      {
        name: 'Terminal',
        file: 'terminal.png',
        before: async () => {
          await click('[aria-label="explorer"]');
          const terminalBtn = await page.$('button[title*="Toggle Terminal"]');
          if (terminalBtn) {await terminalBtn.click();}
          await new Promise((r) => setTimeout(r, WAIT_MS));
        },
        waitSelector: '.terminal-panel, .terminal-container',
      },
      {
        name: 'Builder: template picker',
        file: 'builder-step0-template.png',
        before: runLandingBuilderFlow,
        waitSelector: '.builder-template-picker, .project-builder',
      },
      {
        name: 'Builder: goals',
        file: 'builder-step1-goals.png',
        before: async () => {
          await page.evaluate(() => {
            const doc = (globalThis as { document?: { querySelectorAll: (s: string) => unknown } }).document;
            const cards = doc ? Array.from(doc.querySelectorAll('.builder-template-card') as ArrayLike<{ textContent?: string; click: () => void }>) : [];
            cards.find((c) => c.textContent?.includes('Landing'))?.click();
          });
          await new Promise((r) => setTimeout(r, 800));
        },
        waitSelector: '.builder-question-step',
      },
      {
        name: 'Builder: theme',
        file: 'builder-step2-theme.png',
        before: async () => {
          await clickBuilderOptionByLabel('Customer-facing product');
          await clickBuilderNext();
          await new Promise((r) => setTimeout(r, 400));
        },
        waitSelector: '.builder-question-step',
      },
      {
        name: 'Builder: assets',
        file: 'builder-step3-assets.png',
        before: async () => {
          await clickBuilderOptionByLabel('Dark');
          await clickBuilderNext();
          await new Promise((r) => setTimeout(r, 400));
        },
        waitSelector: '.builder-question-step',
      },
      {
        name: 'Builder: upload (skip)',
        file: 'builder-step4-upload.png',
        before: async () => {
          await clickBuilderOptionByLabel('Use placeholders for now');
          await clickBuilderNext();
          await new Promise((r) => setTimeout(r, 500));
        },
        waitSelector: '.builder-upload-step, .builder-question-step',
      },
      {
        name: 'Builder: CTA',
        file: 'builder-step5-cta.png',
        before: async () => {
          const nextBtn = await page.$('.builder-next-btn');
          if (nextBtn) {await nextBtn.click();}
          await new Promise((r) => setTimeout(r, 600));
        },
        waitSelector: '.builder-question-step',
      },
      {
        name: 'Builder: final (filled)',
        file: 'builder-final-filled.png',
        before: async () => {
          await clickBuilderOptionByLabel('Single primary CTA');
          await clickBuilderNext();
          await new Promise((r) => setTimeout(r, 800));
          await page.waitForSelector('.builder-input-name', { timeout: 3000 }).catch(() => {});
          await page.type('.builder-input-name', 'my-landing', { delay: 60 });
          await new Promise((r) => setTimeout(r, 400));
          const descInput = await page.$('.builder-input-desc');
          if (descInput) {
            await descInput.click({ count: 3 });
            await descInput.type(LANDING_DESCRIPTION, { delay: 30 });
          }
          await new Promise((r) => setTimeout(r, 500));
        },
        waitSelector: '.builder-final-step',
      },
      {
        name: 'Theme: Cyberpunk',
        file: 'theme-cyberpunk.png',
        before: async () => {
          await setTheme('Cyberpunk');
          await openFirstFileInExplorer();
        },
        waitSelector: '.ide-layout',
      },
      {
        name: 'Theme: Matrix',
        file: 'theme-matrix.png',
        before: async () => {
          await setTheme('Matrix');
          await openFirstFileInExplorer();
        },
        waitSelector: '.ide-layout',
      },
      {
        name: 'Theme: Glassmorphism',
        file: 'theme-glass.png',
        before: async () => {
          await setTheme('Glassmorphism');
          await openFirstFileInExplorer();
        },
        waitSelector: '.ide-layout',
      },
      {
        name: 'Theme: Tactical Dark',
        file: 'theme-tactical-dark.png',
        before: async () => {
          await setTheme('Tactical Dark');
          await openFirstFileInExplorer();
        },
        waitSelector: '.ide-layout',
      },
    ];

    for (const step of steps) {
      if (step.before) {await step.before();}
      if (step.waitSelector) {
        try {
          await page.waitForSelector(step.waitSelector, { timeout: 5000 });
        } catch {
          console.warn('[capture] Selector not found:', step.waitSelector);
        }
      }
      await new Promise((r) => setTimeout(r, 300));
      const path = resolve(outDir, step.file);
      await page.screenshot({ path, type: 'png', fullPage: false });
      console.log('[capture] Saved:', step.file);
    }

    console.log('[capture] Done. Captures in', outDir);
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('[capture]', err);
  process.exit(1);
});
