import type { MouseEventHandler, SVGProps } from 'react';
import { ChevronRight } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { ICON_SM, ICON_STROKE } from './iconTokens';

export type CaretDirection = 'right' | 'down' | 'left' | 'up';

const ROT: Record<CaretDirection, number> = {
  right: 0,
  down: 90,
  left: 180,
  up: -90,
};

const caretSpring = { type: 'spring' as const, stiffness: 380, damping: 24 };

export type AppCaretProps = {
  direction?: CaretDirection;
  size?: number;
  strokeWidth?: number;
  className?: string;
} & Omit<SVGProps<SVGSVGElement>, 'ref'>;

export function AppCaret({
  direction = 'right',
  size = ICON_SM,
  strokeWidth = ICON_STROKE,
  className,
  style,
  ...rest
}: AppCaretProps) {
  const deg = ROT[direction];
  const cls = className ? `app-caret ${className}` : 'app-caret';
  return (
    <ChevronRight
      size={size}
      strokeWidth={strokeWidth}
      className={cls}
      style={{
        transform: `rotate(${deg}deg)`,
        transformOrigin: 'center',
        color: 'var(--app-caret-color, currentColor)',
        ...style,
      }}
      aria-hidden
      {...rest}
    />
  );
}

export type AppCaretMotionProps = {
  isOpen: boolean;
  closedDirection?: CaretDirection;
  openDirection?: CaretDirection;
  size?: number;
  strokeWidth?: number;
  /** Classes on the motion wrapper */
  className?: string;
  /** Classes on the ChevronRight SVG */
  iconClassName?: string;
  onClick?: MouseEventHandler<HTMLSpanElement>;
};

export function AppCaretMotion({
  isOpen,
  closedDirection = 'right',
  openDirection = 'down',
  size = ICON_SM,
  strokeWidth = ICON_STROKE,
  className,
  iconClassName,
  onClick,
}: AppCaretMotionProps) {
  const reduced = useReducedMotion();
  const target = isOpen ? ROT[openDirection] : ROT[closedDirection];
  const transition = reduced ? { duration: 0 } : caretSpring;
  const wrapCls = className ? `app-caret-wrap ${className}` : 'app-caret-wrap';
  const iconCls = iconClassName ? `app-caret ${iconClassName}` : 'app-caret';

  return (
    <motion.span
      className={wrapCls}
      animate={{ rotate: target }}
      transition={transition}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--app-caret-color, currentColor)',
      }}
      aria-hidden
      onClick={onClick}
    >
      <ChevronRight size={size} strokeWidth={strokeWidth} className={iconCls} aria-hidden />
    </motion.span>
  );
}
