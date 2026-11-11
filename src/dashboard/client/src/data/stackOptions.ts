/**
 * Stack options for project starter: backend, frontend, database, styling.
 * Each option has id (used in API), label (display), and color (brand/accent).
 */

export type StackCategory = 'backend' | 'frontend' | 'database' | 'styling';

export interface StackOption {
  id: string;
  label: string;
  subtitle?: string;
  color?: string;
  logo?: string;
}

const BACKEND_OPTIONS: StackOption[] = [
  { id: 'node-express', label: 'Node (Express)', subtitle: 'Industry standard', color: '#68a063' },
  { id: 'supabase', label: 'Supabase', subtitle: 'PostgreSQL & Auth', color: '#3ecf8e' },
  { id: 'neon', label: 'Neon', subtitle: 'Serverless Postgres', color: '#00e599' },
  { id: 'bun', label: 'Bun', subtitle: 'Fast runtime', color: '#fbf0df' },
  { id: 'hono', label: 'Hono', subtitle: 'Lightweight & fast', color: '#6c5ce7' },
  { id: 'python-fastapi', label: 'Python (FastAPI)', subtitle: 'Modern & type-safe', color: '#009688' },
  { id: 'go-echo', label: 'Go (Echo)', subtitle: 'High performance', color: '#00add8' },
  { id: 'rust-axum', label: 'Rust (Axum)', subtitle: 'Safe & blazing fast', color: '#ce422b' },
  { id: 'deno', label: 'Deno', subtitle: 'Secure TS runtime', color: '#70ffaf' },
  { id: 'csharp-aspnet', label: 'C# (ASP.NET Core)', subtitle: 'Enterprise ready', color: '#512bd4' },
  { id: 'php-laravel', label: 'PHP (Laravel)', subtitle: 'Productivity focus', color: '#777bb4' },
  { id: 'other', label: 'Other…', subtitle: 'Custom configuration', color: 'var(--border)' },
];

const FRONTEND_OPTIONS: StackOption[] = [
  { id: 'tanstack-start', label: 'TanStack Start', subtitle: 'Full-stack React, Router, Query', color: '#e34c26' },
  { id: 'react', label: 'React', subtitle: 'Component library', color: '#61dafb' },
  { id: 'react-vite', label: 'React (Vite)', subtitle: 'Vite bundler', color: '#646cff' },
  { id: 'next', label: 'Next.js', subtitle: 'Full-stack React', color: '#ffffff' },
  { id: 'vue', label: 'Vue', subtitle: 'Progressive framework', color: '#42b883' },
  { id: 'vue-vite', label: 'Vue (Vite)', subtitle: 'Vite bundler', color: '#646cff' },
  { id: 'nuxt', label: 'Nuxt', subtitle: 'Full-stack Vue', color: '#42b883' },
  { id: 'svelte', label: 'Svelte', subtitle: 'Compiled framework', color: '#ff3e00' },
  { id: 'svelte-vite', label: 'Svelte (Vite)', subtitle: 'Vite bundler', color: '#646cff' },
  { id: 'astro', label: 'Astro', subtitle: 'Content-focused', color: '#ff5d01' },
  { id: 'remix', label: 'Remix', subtitle: 'Full-stack React', color: '#654ff0' },
  { id: 'solid', label: 'SolidJS', subtitle: 'Fine-grained reactivity', color: '#2c4f7c' },
  { id: 'html-css-js', label: 'HTML + CSS + JS', subtitle: 'Vanilla web', color: '#e34c26' },
  { id: 'react-native', label: 'React Native', subtitle: 'Mobile apps', color: '#61dafb' },
  { id: 'flutter', label: 'Flutter', subtitle: 'Cross-platform', color: '#02569b' },
  { id: 'other', label: 'Other…', subtitle: 'Custom configuration', color: 'var(--border)' },
];

const DATABASE_OPTIONS: StackOption[] = [
  { id: 'postgresql', label: 'PostgreSQL', subtitle: 'Relational powerhouse', color: '#336791' },
  { id: 'sqlite', label: 'SQLite', subtitle: 'Embedded & simple', color: '#44a8d6' },
  { id: 'supabase-db', label: 'Supabase (Postgres)', subtitle: 'Managed + Auth', color: '#3ecf8e' },
  { id: 'neon-db', label: 'Neon (Postgres)', subtitle: 'Serverless branching', color: '#00e599' },
  { id: 'mysql', label: 'MySQL', subtitle: 'Widely deployed', color: '#4479a1' },
  { id: 'mongodb', label: 'MongoDB', subtitle: 'Document store', color: '#47a248' },
  { id: 'redis', label: 'Redis', subtitle: 'In-memory cache', color: '#dc382d' },
  { id: 'planetscale', label: 'PlanetScale', subtitle: 'MySQL serverless', color: '#ffffff' },
  { id: 'other', label: 'Other…', subtitle: 'Custom configuration', color: 'var(--border)' },
];

const STYLING_OPTIONS: StackOption[] = [
  { id: 'tailwind', label: 'Tailwind CSS', subtitle: 'Utility-first', color: '#06b6d4' },
  { id: 'css-modules', label: 'CSS Modules', subtitle: 'Scoped styles', color: '#1572b6' },
  { id: 'sass', label: 'Sass', subtitle: 'CSS preprocessor', color: '#cc6699' },
  { id: 'unocss', label: 'UnoCSS', subtitle: 'Atomic CSS engine', color: '#888888' },
  { id: 'bootstrap', label: 'Bootstrap', subtitle: 'Component library', color: '#7952b3' },
  { id: 'styled-components', label: 'styled-components', subtitle: 'CSS-in-JS', color: '#db7093' },
  { id: 'emotion', label: 'Emotion', subtitle: 'Performant CSS-in-JS', color: '#d26ac2' },
  { id: 'vanilla-extract', label: 'Vanilla Extract', subtitle: 'Zero-runtime CSS', color: '#fcdc00' },
  { id: 'other', label: 'Other…', subtitle: 'Custom configuration', color: 'var(--border)' },
];

export function getStackOptions(category: StackCategory): StackOption[] {
  switch (category) {
  case 'backend':
    return BACKEND_OPTIONS;
  case 'frontend':
    return FRONTEND_OPTIONS;
  case 'database':
    return DATABASE_OPTIONS;
  case 'styling':
    return STYLING_OPTIONS;
  default:
    return [];
  }
}

export function getCategoryLabel(category: StackCategory): string {
  switch (category) {
  case 'backend':
    return 'Backend';
  case 'frontend':
    return 'Frontend';
  case 'database':
    return 'Database';
  case 'styling':
    return 'Styling';
  default:
    return category;
  }
}

export function getCategoryStep(category: StackCategory): { step: number; total: number } {
  const steps: Record<StackCategory, number> = { backend: 1, frontend: 2, database: 3, styling: 4 };
  return { step: steps[category] ?? 1, total: 4 };
}

export function getNextCategoryLabel(category: StackCategory): string {
  const next: Record<StackCategory, string> = {
    backend: 'Frontend',
    frontend: 'Database',
    database: 'Styling',
    styling: 'Name',
  };
  return next[category] ?? 'Next';
}

export const STACK_CATEGORIES: StackCategory[] = [
  'backend',
  'frontend',
  'database',
  'styling',
];

/** Backend → recommended database id (when choice should match). */
export function getRecommendedDatabase(backend: string | null): string | null {
  if (!backend) {return null;}
  if (backend === 'supabase') {return 'supabase-db';}
  if (backend === 'neon') {return 'neon-db';}
  return null;
}

/** Backend → allowed database option ids (null = all allowed). */
export function getAllowedDatabaseIds(backend: string | null): string[] | null {
  if (!backend) {return null;}
  if (backend === 'supabase') {return ['postgresql', 'supabase-db', 'other'];}
  if (backend === 'neon') {return ['postgresql', 'neon-db', 'other'];}
  return null;
}

/** Frontend → recommended styling id (suggestion only). */
export function getRecommendedStyling(frontend: string | null): string | null {
  if (!frontend) {return null;}
  const tailwindFrameworks = ['tanstack-start', 'next', 'nuxt', 'remix', 'astro', 'svelte', 'react-vite', 'vue-vite', 'svelte-vite'];
  return tailwindFrameworks.includes(frontend) ? 'tailwind' : null;
}

/** UI library options for project starter. Same shape as StackOption for reuse in cards. */
export interface UILibraryOption extends StackOption {}

const REACT_UI_LIBRARIES: UILibraryOption[] = [
  { id: 'shadcn', label: 'shadcn/ui', subtitle: 'Radix-based components', color: '#000000' },
  { id: 'mui', label: 'Material UI', subtitle: 'Google Material Design', color: '#007fff' },
  { id: 'chakra', label: 'Chakra UI', subtitle: 'Accessible & modular', color: '#319795' },
  { id: 'radix', label: 'Radix UI', subtitle: 'Headless primitives', color: '#161618' },
  { id: 'ant-design', label: 'Ant Design', subtitle: 'Enterprise components', color: '#0170fe' },
  { id: 'mantine', label: 'Mantine', subtitle: 'Full-featured React', color: '#339af0' },
  { id: 'none', label: 'None', subtitle: 'Custom / Tailwind only', color: 'var(--border)' },
];

const VUE_UI_LIBRARIES: UILibraryOption[] = [
  { id: 'vuetify', label: 'Vuetify', subtitle: 'Material Design', color: '#1867c0' },
  { id: 'primevue', label: 'PrimeVue', subtitle: 'Rich components', color: '#22c55e' },
  { id: 'quasar', label: 'Quasar', subtitle: 'Full-stack Vue UI', color: '#1976d2' },
  { id: 'headless-ui-vue', label: 'Headless UI', subtitle: 'Unstyled, accessible', color: '#42b883' },
  { id: 'none', label: 'None', subtitle: 'Custom / Tailwind only', color: 'var(--border)' },
];

const SVELTE_UI_LIBRARIES: UILibraryOption[] = [
  { id: 'skeleton', label: 'Skeleton UI', subtitle: 'Tailwind-based', color: '#ff3e00' },
  { id: 'carbon-svelte', label: 'Carbon Svelte', subtitle: 'IBM Carbon', color: '#393939' },
  { id: 'none', label: 'None', subtitle: 'Custom / Tailwind only', color: 'var(--border)' },
];

const REACT_NATIVE_UI_LIBRARIES: UILibraryOption[] = [
  { id: 'native-base', label: 'NativeBase', subtitle: 'Accessible components', color: '#3366ff' },
  { id: 'react-native-paper', label: 'React Native Paper', subtitle: 'Material Design', color: '#6366f1' },
  { id: 'tamagui', label: 'Tamagui', subtitle: 'Universal UI', color: '#e44848' },
  { id: 'none', label: 'None', subtitle: 'Custom components', color: 'var(--border)' },
];

const FLUTTER_UI_LIBRARIES: UILibraryOption[] = [
  { id: 'material', label: 'Material', subtitle: 'Material Design 3', color: '#6750a4' },
  { id: 'cupertino', label: 'Cupertino', subtitle: 'iOS-style widgets', color: '#02569b' },
  { id: 'none', label: 'None', subtitle: 'Custom only', color: 'var(--border)' },
];

const GENERIC_UI_LIBRARIES: UILibraryOption[] = [
  { id: 'none', label: 'None', subtitle: 'No UI library', color: 'var(--border)' },
];

/** Returns UI library options for the given frontend framework id. */
export function getUILibraryOptions(frontendId: string | null): UILibraryOption[] {
  if (!frontendId) {return GENERIC_UI_LIBRARIES;}
  const reactFamily = ['tanstack-start', 'react', 'react-vite', 'next', 'remix'];
  const vueFamily = ['vue', 'vue-vite', 'nuxt'];
  if (reactFamily.includes(frontendId)) {return REACT_UI_LIBRARIES;}
  if (vueFamily.includes(frontendId)) {return VUE_UI_LIBRARIES;}
  if (frontendId === 'svelte' || frontendId === 'svelte-vite') {return SVELTE_UI_LIBRARIES;}
  if (frontendId === 'astro' || frontendId === 'solid') {return REACT_UI_LIBRARIES;} // Astro often uses React components; Solid can use similar
  if (frontendId === 'react-native') {return REACT_NATIVE_UI_LIBRARIES;}
  if (frontendId === 'flutter') {return FLUTTER_UI_LIBRARIES;}
  if (frontendId === 'html-css-js' || frontendId === 'other') {return GENERIC_UI_LIBRARIES;}
  return GENERIC_UI_LIBRARIES;
}
