import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const THIS_FILE = fileURLToPath(import.meta.url);
const ROOT_DIR = join(THIS_FILE, '..', '..');
const TARGET_DIRS = ['src', 'scripts'];
const ALLOWLIST_PATH = join(ROOT_DIR, '.ci', 'ts-nocheck-allowlist.txt');
const BUDGET_PATH = join(ROOT_DIR, '.ci', 'ts-nocheck-budget.json');
const TS_FILE_EXTENSIONS = new Set(['.ts', '.tsx']);

async function walkFiles(dir: string, out: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
        continue;
      }
      await walkFiles(absolutePath, out);
      continue;
    }
    const extension = absolutePath.slice(absolutePath.lastIndexOf('.'));
    if (TS_FILE_EXTENSIONS.has(extension)) {
      out.push(absolutePath);
    }
  }
}

async function collectNoCheckFiles(): Promise<string[]> {
  const files: string[] = [];
  for (const targetDir of TARGET_DIRS) {
    await walkFiles(join(ROOT_DIR, targetDir), files);
  }

  const offenders: string[] = [];
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    if (content.includes('@ts-nocheck')) {
      offenders.push(relative(ROOT_DIR, file).split(sep).join('/'));
    }
  }
  offenders.sort((a, b) => a.localeCompare(b));
  return offenders;
}

async function readAllowlist(): Promise<Set<string>> {
  const text = await readFile(ALLOWLIST_PATH, 'utf8');
  return new Set(
    text
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
  );
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const current = await collectNoCheckFiles();

  if (args.has('--write-allowlist')) {
    const header = [
      '# Temporary allowlist snapshot for files that still use @ts-nocheck.',
      '# Remove entries as files are migrated and keep this list shrinking.',
      '# One path per line, repo-relative.',
      '',
    ].join('\n');
    await writeFile(ALLOWLIST_PATH, `${header}${current.join('\n')}\n`, 'utf8');
    console.log(`Wrote ${current.length} allowlist entries to .ci/ts-nocheck-allowlist.txt`);
    return;
  }

  const allowlist = await readAllowlist();
  const unauthorized = current.filter((file) => !allowlist.has(file));

  if (unauthorized.length > 0) {
    console.error('Unauthorized @ts-nocheck usage detected in:');
    for (const file of unauthorized) {
      console.error(` - ${file}`);
    }
    console.error('\nIf this is intentionally temporary, add the file to .ci/ts-nocheck-allowlist.txt with a follow-up cleanup task.');
    process.exitCode = 1;
    return;
  }

  if (args.has('--enforce-budget')) {
    const budgetRaw = await readFile(BUDGET_PATH, 'utf8');
    const budget = JSON.parse(budgetRaw) as { maxAllowedNoCheckFiles?: number };
    const maxAllowed = Number(budget.maxAllowedNoCheckFiles ?? 0);
    if (current.length > maxAllowed) {
      console.error(
        `@ts-nocheck budget exceeded. Found ${current.length}, max allowed is ${maxAllowed}.`
      );
      process.exitCode = 1;
      return;
    }
    console.log(`@ts-nocheck budget check passed (${current.length}/${maxAllowed}).`);
  }

  console.log(`No new @ts-nocheck usage. Current allowlist size: ${allowlist.size}.`);
}

await main();
