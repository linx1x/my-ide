import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export type NameAnimationType = 'fade' | 'slide' | 'bounce';

const ANIMATION_TYPES: NameAnimationType[] = ['fade', 'slide', 'bounce'];

interface NameAnimationProps {
  animationType?: NameAnimationType;
}

export function NameAnimation({ animationType = 'fade' }: NameAnimationProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const springProgress = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  let opacity = 1;
  let transform = '';

  if (animationType === 'fade') {
    opacity = interpolate(frame, [0, fps], [0, 1], { extrapolateRight: 'clamp' });
  } else if (animationType === 'slide') {
    const y = interpolate(springProgress, [0, 1], [80, 0]);
    opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
    transform = `translateY(${y}px)`;
  } else if (animationType === 'bounce') {
    const scale = spring({
      frame,
      fps,
      config: { damping: 8, stiffness: 150 },
    });
    opacity = interpolate(frame, [0, 5], [0, 1], { extrapolateRight: 'clamp' });
    transform = `scale(${scale})`;
  }

  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
      }}
    >
      <div
        style={{
          opacity,
          transform: transform || undefined,
          fontSize: 42,
          fontWeight: 700,
          color: '#e8e8e8',
          fontFamily: 'JetBrains Mono, Cascadia Code, monospace',
        }}
      >
        My name
      </div>
    </AbsoluteFill>
  );
}

export { ANIMATION_TYPES };
