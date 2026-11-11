/**
 * Captures a screenshot of an HTML file using Puppeteer.
 * Uses system Chrome/Chromium if Puppeteer's bundled browser isn't installed.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

let puppeteer: any = null;

const SYSTEM_CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

function findSystemChrome(): string | undefined {
  return SYSTEM_CHROME_PATHS.find((p) => existsSync(p));
}

async function loadPuppeteer() {
  if (puppeteer) {return puppeteer;}
  try {
    puppeteer = await import('puppeteer');
    return puppeteer;
  } catch {
    return null;
  }
}

/**
 * Quick check: Puppeteer module can be loaded. Use for status/capabilities.
 * Does not launch Chrome (use captureHtmlScreenshot to verify full flow).
 */
export async function isPuppeteerAvailable() {
  const p = await loadPuppeteer();
  return !!p;
}

const LAUNCH_OPTS = {
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
};

/** Launch a shared browser (reused for batch captures). Optional override for outreach stealth args. */
export async function launchBrowser(
  pptr: any,
  override?: { args?: string[]; headless?: boolean },
) {
  const opts = override?.args?.length
    ? { headless: override.headless ?? true, args: override.args }
    : LAUNCH_OPTS;
  try {
    return await pptr.default.launch(opts);
  } catch (err: unknown) {
    const systemChrome = findSystemChrome();
    const message = err instanceof Error ? err.message : String(err);
    if (systemChrome && /Could not find Chrome|could not find Chrome/i.test(message)) {
      return await pptr.default.launch({
        ...opts,
        executablePath: systemChrome,
      });
    }
    throw err;
  }
}

function resolveHtmlPath(htmlPath: string, workDir: string): string | null {
  const trimmed = htmlPath.trim().replace(/^["']|["']$/g, '');
  const candidates = trimmed.startsWith('/')
    ? [trimmed]
    : [resolve(workDir, trimmed), resolve(process.cwd(), trimmed)];
  return [...new Set(candidates)].find((p) => existsSync(p)) || null;
}

/** Capture one URL in an existing browser (caller closes page). */
async function captureOneInBrowser(browser: any, fileUrl: string, htmlPath: string): Promise<Buffer | null> {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await new Promise((r) => setTimeout(r, 500));
    const buffer = await page.screenshot({ type: 'png', fullPage: false });
    return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[Screenshot] Capture failed for ${htmlPath}:`, message);
    return null;
  } finally {
    await page.close();
  }
}

/**
 * Captures multiple HTML files in parallel using a single browser.
 * @param {string[]} htmlPaths - Paths to HTML files
 * @param {string} workDir - Primary working directory
 * @returns {Promise<(Buffer|null)[]>} PNG buffers in same order as htmlPaths (null on failure)
 */
export async function captureHtmlScreenshots(htmlPaths: string[], workDir: string): Promise<Array<Buffer | null>> {
  if (!htmlPaths.length) {return [];}
  const pptr = await loadPuppeteer();
  if (!pptr) {
    console.warn('[Screenshot] Puppeteer not installed. Run: npm install puppeteer');
    return htmlPaths.map(() => null);
  }
  const resolved = htmlPaths.map((p) => ({ path: p, absPath: resolveHtmlPath(p, workDir) }));
  let browser: any;
  try {
    browser = await launchBrowser(pptr);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[Screenshot] Launch failed:', message);
    return htmlPaths.map(() => null);
  }
  try {
    const results = await Promise.all(
      resolved.map(({ path, absPath }) => {
        if (!absPath) {
          console.warn(`[Screenshot] File not found: ${path}`);
          return Promise.resolve(null);
        }
        return captureOneInBrowser(browser, `file://${absPath}`, path);
      })
    );
    return results;
  } finally {
    if (browser) {await browser.close();}
  }
}

/**
 * Takes a screenshot of an HTML file.
 * Tries multiple base dirs: configured workdir, then process.cwd(), then absolute path.
 * @param {string} htmlPath - Absolute or relative path to the HTML file
 * @param {string} workDir - Primary working directory for dashboard/project assets.
 * @returns {Promise<Buffer|null>} PNG buffer or null if capture failed
 */
export async function captureHtmlScreenshot(htmlPath: string, workDir: string): Promise<Buffer | null> {
  const results = await captureHtmlScreenshots([htmlPath], workDir);
  return results[0] ?? null;
}

const HTTP_URL_RE = /^https?:\/\//i;

/**
 * Capture a viewport screenshot of a public HTTP(S) URL (reference site for design clone).
 * @returns PNG buffer or null on failure / invalid URL
 */
export async function captureUrlScreenshot(url: string): Promise<Buffer | null> {
  const trimmed = String(url || '').trim();
  if (!HTTP_URL_RE.test(trimmed)) {
    return null;
  }
  const pptr = await loadPuppeteer();
  if (!pptr) {
    console.warn('[Screenshot] Puppeteer not installed for URL capture');
    return null;
  }
  let browser: any;
  try {
    browser = await launchBrowser(pptr);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[Screenshot] Launch failed for URL capture:', message);
    return null;
  }
  try {
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(trimmed, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise((r) => setTimeout(r, 800));
      const buffer = await page.screenshot({ type: 'png', fullPage: false });
      return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[Screenshot] URL capture failed for ${trimmed}:`, message);
      return null;
    } finally {
      await page.close();
    }
  } finally {
    if (browser) {await browser.close();}
  }
}

/**
 * Parses agent output for SCREENSHOT: path lines.
 * @param {string} output - Raw agent output
 * @returns {{ text: string; screenshotPaths: string[] }}
 */
export function parseScreenshotMarkers(output: string): { text: string; screenshotPaths: string[] } {
  const screenshotPaths: string[] = [];
  const lines = output.split('\n');
  const keptLines: string[] = [];

  // Match SCREENSHOT: path (handles markdown like *SCREENSHOT:* or **SCREENSHOT:**)
  const screenshotRe = /^\s*\*{0,2}SCREENSHOT\*{0,2}\s*:\s*(.+)$/i;
  for (const line of lines) {
    const match = line.match(screenshotRe);
    if (match) {
      if (match[1]) {screenshotPaths.push(match[1].trim());}
    } else {
      keptLines.push(line);
    }
  }

  return {
    text: keptLines.join('\n').trim(),
    screenshotPaths,
  };
}
