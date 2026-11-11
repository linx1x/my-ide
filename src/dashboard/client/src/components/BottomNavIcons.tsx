/**
 * Animated SVG icons for the mobile bottom navigation bar.
 * Each icon has a distinct idle → active animation driven by `motion/react`.
 */
import { motion, useReducedMotion } from 'motion/react';

interface NavIconProps {
  active: boolean;
  size?: number;
  stroke?: number;
}

/** Chat — message bubble breathes + notification dot pops in */
export function ChatNavIcon({ active, size = 22, stroke = 1.75 }: NavIconProps) {
  const reduce = useReducedMotion();
  const pulse = active && !reduce;
  return (
    <motion.svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={stroke}>
      <motion.g
        style={{ transformOrigin: '12px 13px' }}
        animate={pulse ? { scale: [1, 1.1, 1] } : { scale: 1 }}
        transition={pulse ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.4 } : { duration: 0.2 }}
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </motion.g>
      <motion.circle
        cx="18.5" cy="4.5" r="2.8"
        fill="currentColor" stroke="none"
        initial={{ scale: 0, opacity: 0 }}
        animate={active ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 520, damping: 22 }}
        style={{ transformOrigin: '18.5px 4.5px' }}
      />
    </motion.svg>
  );
}

/** Explorer — folder lid swings open on active */
export function ExplorerNavIcon({ active, size = 22, stroke = 1.75 }: NavIconProps) {
  const reduce = useReducedMotion();
  const open = active && !reduce;
  return (
    <motion.svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={stroke}>
      {/* folder body */}
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      {/* lid line */}
      <motion.line
        x1="3" y1="11" x2="21" y2="11"
        animate={open ? { y1: 9, y2: 9, opacity: 0.5 } : { y1: 11, y2: 11, opacity: 1 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
      />
      {/* small document lines slide in when open */}
      <motion.g
        initial={{ opacity: 0, y: 3 }}
        animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 3 }}
        transition={{ duration: 0.25, delay: active ? 0.1 : 0 }}
      >
        <line x1="8" y1="14" x2="16" y2="14" />
        <line x1="8" y1="17" x2="13" y2="17" />
      </motion.g>
    </motion.svg>
  );
}

/** Search — magnifying glass rocks gently on active */
export function SearchNavIcon({ active, size = 22, stroke = 1.75 }: NavIconProps) {
  const reduce = useReducedMotion();
  const swing = active && !reduce;
  return (
    <motion.svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={stroke}>
      <motion.g
        style={{ transformOrigin: '11px 11px' }}
        animate={swing ? { rotate: [-8, 8, -8] } : { rotate: 0 }}
        transition={swing ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
      >
        <circle cx="11" cy="11" r="8" />
      </motion.g>
      <motion.line
        x1="21" y1="21" x2="16.65" y2="16.65"
        animate={swing ? { x1: [21, 20.5, 21], y1: [21, 20.5, 21], x2: [16.65, 16.15, 16.65], y2: [16.65, 16.15, 16.65] } : {}}
        transition={swing ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : {}}
      />
    </motion.svg>
  );
}

/** n8n — workflow nodes pulse on active */
export function N8nNavIcon({ active, size = 22, stroke = 1.75 }: NavIconProps) {
  const reduce = useReducedMotion();
  const pulse = active && !reduce;
  return (
    <motion.svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={stroke}>
      <motion.rect
        x="3" y="4" width="7" height="7" rx="1.5"
        animate={pulse ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={pulse ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
        style={{ transformOrigin: '6.5px 7.5px' }}
      />
      <motion.rect
        x="14" y="4" width="7" height="7" rx="1.5"
        animate={pulse ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={pulse ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: 0.2 } : { duration: 0.2 }}
        style={{ transformOrigin: '17.5px 7.5px' }}
      />
      <motion.rect
        x="8.5" y="14" width="7" height="7" rx="1.5"
        animate={pulse ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={pulse ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: 0.4 } : { duration: 0.2 }}
        style={{ transformOrigin: '12px 17.5px' }}
      />
      <line x1="10" y1="11" x2="10" y2="14" />
      <line x1="17" y1="11" x2="14" y2="14" />
    </motion.svg>
  );
}

/** Git — branch lines spring outward on active */
export function GitNavIcon({ active, size = 22, stroke = 1.75 }: NavIconProps) {
  const reduce = useReducedMotion();
  const spread = active && !reduce;
  return (
    <motion.svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={stroke}>
      {/* vertical stem */}
      <line x1="6" y1="3" x2="6" y2="21" />
      {/* main branch node circles */}
      <circle cx="6" cy="6" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="6" cy="18" r="1.8" fill="currentColor" stroke="none" />
      {/* side branch */}
      <motion.g
        animate={spread ? { x: [0, 3, 0] } : { x: 0 }}
        transition={spread ? { type: 'spring', stiffness: 300, damping: 14, repeat: 1, repeatDelay: 0.8 } : {}}
      >
        <line x1="6" y1="9" x2="18" y2="6" />
        <motion.circle
          cx="18" cy="6" r="1.8"
          fill="currentColor" stroke="none"
          animate={active ? { scale: [0.8, 1.2, 1] } : { scale: 1 }}
          transition={active ? { duration: 0.4, ease: 'backOut' } : {}}
          style={{ transformOrigin: '18px 6px' }}
        />
      </motion.g>
    </motion.svg>
  );
}

/** More — three dots stagger-bounce on active */
export function MoreNavIcon({ active, size = 22, stroke = 1.75 }: NavIconProps) {
  const reduce = useReducedMotion();
  const bounce = active && !reduce;
  const dots = [5, 12, 19];
  return (
    <motion.svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={stroke}>
      {dots.map((cx, i) => (
        <motion.circle
          key={cx}
          cx={cx} cy="12" r="1.8"
          fill="currentColor" stroke="none"
          animate={bounce ? { y: [0, -3.5, 0] } : { y: 0 }}
          transition={bounce ? { duration: 0.7, repeat: Infinity, ease: 'easeInOut', delay: i * 0.12, repeatDelay: 0.6 } : { duration: 0.2 }}
        />
      ))}
    </motion.svg>
  );
}

/** Terminal — blinking block cursor on active */
export function TerminalNavIcon({ active, size = 22, stroke = 1.75 }: NavIconProps) {
  const reduce = useReducedMotion();
  const blink = active && !reduce;
  return (
    <motion.svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={stroke}>
      {/* terminal frame */}
      <rect x="2" y="3" width="20" height="18" rx="2" />
      {/* prompt chevron */}
      <polyline points="6 9 10 12 6 15" />
      {/* cursor block — blinks */}
      <motion.rect
        x="13" y="14.5" width="5" height="2.5" rx="0.5"
        fill="currentColor" stroke="none"
        animate={blink ? { opacity: [1, 0, 1] } : { opacity: 1 }}
        transition={blink ? { duration: 1.1, repeat: Infinity, ease: 'linear' } : {}}
      />
    </motion.svg>
  );
}
