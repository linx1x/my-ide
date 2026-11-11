import * as React from 'react';

const variantClass = {
  text: 'skeleton-text',
  circular: 'skeleton-circle',
  rect: 'skeleton-rect',
} as const;

type SkeletonVariant = keyof typeof variantClass;

interface SkeletonProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  className?: string;
  width?: number | string;
  height?: number | string;
  variant?: SkeletonVariant;
  style?: React.CSSProperties;
  as?: React.ElementType;
}

/**
 * Skeleton placeholder for loading states. Use CSS variables for theming.
 */
export function Skeleton({
  className = '',
  width,
  height,
  variant = 'text',
  style = {},
  as: Component = 'span',
  ...rest
}: SkeletonProps) {
  const cls = ['skeleton', variantClass[variant] || variantClass.text, className].filter(Boolean).join(' ');
  const combinedStyle = {
    ...(width !== null && width !== undefined && { width: typeof width === 'number' ? `${width}px` : width }),
    ...(height !== null && height !== undefined && { height: typeof height === 'number' ? `${height}px` : height }),
    ...style,
  };
  return React.createElement(Component as React.ElementType, {
    ...rest,
    className: cls,
    style: combinedStyle,
    'aria-hidden': 'true',
  });
}

/**
 * Wrapper for a list of skeleton rows with consistent spacing.
 */
type SkeletonGroupProps = React.HTMLAttributes<HTMLDivElement>;

export function SkeletonGroup({ className = '', children, ...rest }: SkeletonGroupProps) {
  return (
    <div className={`skeleton-group ${className}`.trim()} role="presentation" aria-busy="true" {...rest}>
      {children}
    </div>
  );
}
