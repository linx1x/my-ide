/**
 * Backend templates: loaded from API (bridge-data). Only fallback is kept here
 * for when the API is unavailable or a template id is missing on disk.
 */

import type { FeatureTemplate } from './types';

export const FALLBACK_BACKEND: FeatureTemplate = {
  id: '_fallback',
  category: 'backend',
  files: [
    { path: 'server/README.md', content: '# Backend\n\nAdd your server (Node, Python, Go, etc.) here.\n' },
  ],
};
