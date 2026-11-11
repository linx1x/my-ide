/**
 * Framework templates: loaded from API (bridge-data). Only fallback is kept here
 * for when the API is unavailable or a template id is missing on disk.
 */

import type { FeatureTemplate } from './types';

/** Fallback when framework has no template on disk: minimal Vite app so preview can run. */
export const FALLBACK_FRAMEWORK: FeatureTemplate = {
  id: '_fallback',
  category: 'framework',
  files: [
    {
      path: 'package.json',
      content: '{ "name": "my-app", "private": true, "type": "module", "scripts": { "dev": "vite", "build": "vite build" }, "devDependencies": { "vite": "^6.0.0" } }\n',
    },
    {
      path: 'vite.config.mjs',
      content: 'import { defineConfig } from \'vite\';\nexport default defineConfig({ root: \'.\' });\n',
    },
    {
      path: 'index.html',
      content: '<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>My App</title></head>\n<body><div id="root"></div><script type="module" src="/src/main.js"></script></body>\n</html>\n',
    },
    {
      path: 'src/main.js',
      content: 'document.getElementById(\'root\').innerHTML = \'<p style="padding:1rem;font-family:system-ui">Preview placeholder. Choose a framework for a full template.</p>\';\n',
    },
  ],
};
