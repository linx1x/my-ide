import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { MotionStyle } from 'motion/react';
import type { IconType } from 'react-icons';
import type { StackCategory, StackOption } from '../data/stackOptions';
import { getStackOptions, getCategoryLabel, getCategoryStep, getNextCategoryLabel } from '../data/stackOptions';
import {
  SiSupabase,
  SiNodedotjs,
  SiBun,
  SiFastapi,
  SiGo,
  SiRust,
  SiDeno,
  SiDotnet,
  SiLaravel,
  SiReact,
  SiNextdotjs,
  SiVuedotjs,
  SiNuxt,
  SiSvelte,
  SiAstro,
  SiRemix,
  SiSolid,
  SiHtml5,
  SiCss,
  SiFlutter,
  SiPostgresql,
  SiSqlite,
  SiMysql,
  SiMongodb,
  SiRedis,
  SiTailwindcss,
  SiSass,
  SiBootstrap,
  SiUnocss,
  SiPlanetscale,
  SiShadcnui,
  SiMui,
  SiChakraui,
  SiRadixui,
  SiAntdesign,
  SiMantine,
  SiVuetify,
  SiPrimevue,
  SiQuasar,
} from 'react-icons/si';
import { MdMoreHoriz } from 'react-icons/md';

const ICON_SIZE = 24;

const TECH_ICONS: Record<string, IconType> = {
  supabase: SiSupabase,
  neon: SiPostgresql,
  'node-express': SiNodedotjs,
  bun: SiBun,
  hono: SiNodedotjs,
  'python-fastapi': SiFastapi,
  'go-echo': SiGo,
  'rust-axum': SiRust,
  deno: SiDeno,
  'csharp-aspnet': SiDotnet,
  'php-laravel': SiLaravel,
  react: SiReact,
  next: SiNextdotjs,
  vue: SiVuedotjs,
  nuxt: SiNuxt,
  svelte: SiSvelte,
  astro: SiAstro,
  remix: SiRemix,
  solid: SiSolid,
  'html-css-js': SiHtml5,
  'react-native': SiReact,
  flutter: SiFlutter,
  postgresql: SiPostgresql,
  sqlite: SiSqlite,
  mysql: SiMysql,
  mongodb: SiMongodb,
  'supabase-db': SiSupabase,
  'neon-db': SiPostgresql,
  redis: SiRedis,
  planetscale: SiPlanetscale,
  tailwind: SiTailwindcss,
  'css-modules': SiCss,
  'styled-components': SiCss,
  emotion: SiCss,
  sass: SiSass,
  'vanilla-extract': SiCss,
  unocss: SiUnocss,
  bootstrap: SiBootstrap,
  shadcn: SiShadcnui,
  mui: SiMui,
  chakra: SiChakraui,
  radix: SiRadixui,
  'ant-design': SiAntdesign,
  mantine: SiMantine,
  vuetify: SiVuetify,
  primevue: SiPrimevue,
  quasar: SiQuasar,
  'headless-ui-vue': SiVuedotjs,
  skeleton: SiSvelte,
  'carbon-svelte': SiSvelte,
  'native-base': SiReact,
  'react-native-paper': SiReact,
  tamagui: SiReact,
  material: SiMui,
  cupertino: SiCss,
  dash: SiReact,
  yew: SiRust,
  none: MdMoreHoriz,
  other: MdMoreHoriz,
};

function TechIcon({ id, color }: { id: string; color?: string }) {
  const Icon = TECH_ICONS[id];
  const c = color || 'currentColor';
  if (Icon) {return <Icon size={ICON_SIZE} color={c} style={{ flexShrink: 0 }} />;}
  return <MdMoreHoriz size={ICON_SIZE} color={c} style={{ flexShrink: 0, opacity: 0.7 }} />;
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="var(--accent)"/>
      <path d="M5 8l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}

interface StackChoiceCardsProps {
  category: StackCategory;
  selectedId: string | null;
  onSelect: (id: string, customLabel?: string) => void;
  onCustomRequest?: (category: StackCategory, name: string) => Promise<{ opinion: string; suggestedId?: string }>;
  /** When set, only these option ids are shown (e.g. database filtered by backend). */
  allowedIds?: string[] | null;
  /** Option id to show as "Recommended" or "Matches your backend". */
  recommendedId?: string | null;
  /** Override options (e.g. UI library list for chosen frontend). When set, category is only used for layout. */
  optionsOverride?: StackOption[];
  /** Override step label in heading (e.g. "UI library"). */
  stepLabelOverride?: string;
  /** Override step X of Y (e.g. { step: 2, total: 5 }). */
  stepOverride?: { step: number; total: number };
  /** Override "Next" button label. */
  nextLabelOverride?: string;
}

export function StackChoiceCards({
  category,
  selectedId,
  onSelect,
  onCustomRequest,
  allowedIds,
  recommendedId,
  optionsOverride,
  stepLabelOverride,
  stepOverride,
  nextLabelOverride,
}: StackChoiceCardsProps) {
  const categoryOptions = getStackOptions(category);
  const allOptions = optionsOverride ?? categoryOptions;
  const options = allowedIds && !optionsOverride
    ? allOptions.filter((opt) => allowedIds.includes(opt.id))
    : allOptions;
  const [customInput, setCustomInput] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchResult, setResearchResult] = useState<{ opinion: string; suggestedId?: string } | null>(null);
  const categoryStep = getCategoryStep(category);
  const { step, total } = stepOverride ?? categoryStep;
  const _nextLabel = nextLabelOverride ?? getNextCategoryLabel(category);
  const headingLabel = stepLabelOverride ?? getCategoryLabel(category);
  const showCustom = !optionsOverride && options.some((o) => o.id === 'other');

  const handleCardClick = (opt: StackOption) => {
    if (opt.id === 'other' && showCustom) {
      setCustomOpen(true);
      setResearchResult(null);
      setCustomInput('');
      return;
    }
    onSelect(opt.id);
  };

  const handleCustomSubmit = async () => {
    const name = customInput.trim();
    if (!name || !onCustomRequest) {return;}
    setResearchLoading(true);
    setResearchResult(null);
    try {
      const result = await onCustomRequest(category, name);
      setResearchResult(result);
    } catch (err) {
      setResearchResult({ opinion: (err as Error).message || 'Research failed.' });
    } finally {
      setResearchLoading(false);
    }
  };

  const handleAcceptCustom = () => {
    if (customInput.trim()) {
      onSelect('other', customInput.trim());
      setCustomOpen(false);
      setResearchResult(null);
      setCustomInput('');
    }
  };

  const handleDeclineCustom = () => {
    setResearchResult(null);
    setCustomInput('');
  };

  return (
    <div className="stack-choice-cards">
      <div className="stack-choice-step-label">STEP {step} OF {total}</div>
      <h3 className="stack-choice-heading">
        Choose your <span className="stack-choice-heading-accent">{headingLabel}</span>
      </h3>
      <p className="stack-choice-subtitle">
        {optionsOverride
          ? `Component library for your ${headingLabel.toLowerCase()} app.`
          : allowedIds
            ? 'Options that work with your backend selection.'
            : `Select the infrastructure and framework for your ${getCategoryLabel(category).toLowerCase()}.`}
      </p>
      <div className="stack-choice-grid">
        {options.map((opt, index) => (
          <motion.button
            key={opt.id}
            type="button"
            className={`stack-choice-card ${selectedId === opt.id ? 'selected' : ''} ${opt.id === recommendedId ? 'recommended' : ''}`}
            style={{ '--card-color': opt.color || 'var(--border)' } as unknown as MotionStyle}
            onClick={() => handleCardClick(opt)}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: index * 0.03 }}
            whileTap={{ scale: 0.98 }}
          >
            {selectedId === opt.id && (
              <span className="stack-choice-check"><CheckIcon /></span>
            )}
            {opt.id === recommendedId && (
              <span className="stack-choice-recommended">{category === 'database' ? 'Matches backend' : 'Recommended'}</span>
            )}
            <span className="stack-choice-icon">
              <TechIcon id={opt.id} {...(opt.color ? { color: opt.color } : {})} />
            </span>
            <span className="stack-choice-label">{opt.label}</span>
            {opt.subtitle && <span className="stack-choice-desc">{opt.subtitle}</span>}
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {showCustom && customOpen && (
          <motion.div
            className="stack-choice-custom"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <input
              type="text"
              className="stack-choice-custom-input"
              placeholder="e.g. Elixir Phoenix"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
              disabled={researchLoading}
            />
            <div className="stack-choice-custom-actions">
              <button
                type="button"
                className="stack-choice-custom-btn"
                onClick={handleCustomSubmit}
                disabled={researchLoading || !customInput.trim()}
              >
                {researchLoading ? 'Researching…' : 'Research'}
              </button>
              <button
                type="button"
                className="stack-choice-custom-btn secondary"
                onClick={() => setCustomOpen(false)}
              >
                Cancel
              </button>
            </div>
            {researchResult && (
              <div className="stack-choice-research">
                <p className="stack-choice-research-opinion">{researchResult.opinion}</p>
                <div className="stack-choice-research-actions">
                  <button
                    type="button"
                    className="stack-choice-custom-btn primary"
                    onClick={handleAcceptCustom}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="stack-choice-custom-btn secondary"
                    onClick={handleDeclineCustom}
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
