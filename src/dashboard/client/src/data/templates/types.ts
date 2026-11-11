/**
 * Template types for project builder preview.
 * Each feature can contribute files; the resolver merges them into a single tree.
 */

export interface TemplateFile {
  path: string;
  content: string;
  /** Optional: only include when this feature id is selected. */
  when?: string;
}

export interface FeatureTemplate {
  id: string;
  /** Category this template belongs to (framework, backend, etc.). */
  category: string;
  files: TemplateFile[];
}
