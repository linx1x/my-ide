/**
 * Living Canvas — cursor-reactive 2D particle background.
 * Respects prefers-reduced-motion; performance-adaptive.
 */
import { useEffect, useRef } from 'react';

const CURSOR_RADIUS = 200;
const CURSOR_GLOW_DIAMETER = 300;
const PARTICLE_FRICTION = 0.98;
const ATTRACT_STRENGTH = 0.03;

// Simple 2D noise for idle drift (permutation-based)
const PERM = new Uint8Array(512);
(function () {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {p[i] = i;}
  for (let i = 255; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [p[i], p[j]] = [p[j] ?? 0, p[i] ?? 0];
  }
  for (let i = 0; i < 512; i++) {PERM[i] = p[i & 255] ?? 0;}
})();

const permAt = (index: number): number => PERM[index & 511] ?? 0;

function noise2D(x: number, y: number): number {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  x -= Math.floor(x);
  y -= Math.floor(y);
  const u = x * x * (3 - 2 * x);
  const v = y * y * (3 - 2 * y);
  const A = permAt(X) + Y;
  const B = permAt(X + 1) + Y;
  return (
    (1 - v) *
      (u * (permAt(permAt(A) + 1) - permAt(permAt(A))) +
        (1 - u) * (permAt(permAt(B) + 1) - permAt(permAt(B)))) +
    v *
      (u * (permAt(permAt(A + 1) + 1) - permAt(permAt(A + 1))) +
        (1 - u) * (permAt(permAt(B + 1) + 1) - permAt(permAt(B + 1))))
  );
}

function getParticleCount(isMobile: boolean): number {
  if (isMobile) {return 120;}
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
  return Math.min(450, 200 + cores * 40);
}

export function LivingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cursorRef = useRef({ x: -1e6, y: -1e6 });
  const reducedMotionRef = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {return;}
    const ctx = canvas.getContext('2d');
    if (!ctx) {return;}
    const canvasEl = canvas;
    const context = ctx;

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const setReduced = () => { reducedMotionRef.current = mq.matches; };
    setReduced();
    mq.addEventListener('change', setReduced);

    let raf = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    const isMobile = window.innerWidth < 768;
    const count = getParticleCount(isMobile);

    type NumericIndex = Record<number, number>;
    const x = new Float32Array(count) as unknown as NumericIndex;
    const y = new Float32Array(count) as unknown as NumericIndex;
    const vx = new Float32Array(count) as unknown as NumericIndex;
    const vy = new Float32Array(count) as unknown as NumericIndex;
    const radius = new Float32Array(count) as unknown as NumericIndex;
    const opacity = new Float32Array(count) as unknown as NumericIndex;
    const noiseOffset = new Float32Array(count * 2) as unknown as NumericIndex;

    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = window.innerWidth;
      height = window.innerHeight;
      canvasEl.width = width * dpr;
      canvasEl.height = height * dpr;
      canvasEl.style.width = `${width}px`;
      canvasEl.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      {
        for (let i = 0; i < count; i++) {
          if (x[i] === 0 && y[i] === 0) {
            x[i] = Math.random() * width;
            y[i] = Math.random() * height;
          } else {
            x[i] = ((x[i] ?? 0) / (width || 1)) * width;
            y[i] = ((y[i] ?? 0) / (height || 1)) * height;
          }
          vx[i] = 0;
          vy[i] = 0;
          radius[i] = 0.5 + Math.random() * 1.5;
          opacity[i] = 0.1 + Math.random() * 0.4;
          noiseOffset[i * 2] = Math.random() * 1000;
          noiseOffset[i * 2 + 1] = Math.random() * 1000;
        }
      }
    }

    function initPositions() {
      for (let i = 0; i < count; i++) {
        x[i] = Math.random() * width;
        y[i] = Math.random() * height;
        vx[i] = 0;
        vy[i] = 0;
        radius[i] = 0.5 + Math.random() * 1.5;
        opacity[i] = 0.1 + Math.random() * 0.4;
        noiseOffset[i * 2] = Math.random() * 1000;
        noiseOffset[i * 2 + 1] = Math.random() * 1000;
      }
    }

    const mouseHandler = (e: MouseEvent | TouchEvent) => {
      const touch = 'touches' in e ? e.touches[0] : undefined;
      cursorRef.current.x = 'clientX' in e ? e.clientX : touch?.clientX ?? -1e6;
      cursorRef.current.y = 'clientY' in e ? e.clientY : touch?.clientY ?? -1e6;
    };
    const mouseLeave = () => {
      cursorRef.current.x = -1e6;
      cursorRef.current.y = -1e6;
    };
    window.addEventListener('mousemove', mouseHandler, { passive: true });
    window.addEventListener('touchmove', mouseHandler, { passive: true });
    window.addEventListener('mouseleave', mouseLeave);
    window.addEventListener('resize', resize);

    resize();
    initPositions();

    let t = 0;
    const twoPi = Math.PI * 2;

    function loop() {
      raf = requestAnimationFrame(loop);
      t += 0.0003;
      const reduced = reducedMotionRef.current;

      const cx = cursorRef.current.x;
      const cy = cursorRef.current.y;
      const hasCursor = cx >= 0 && cy >= 0 && cx <= width + 300 && cy <= height + 300;

      context.fillStyle = 'rgba(5, 5, 8, 0.12)';
      context.fillRect(0, 0, width, height);

      if (reduced) {
        context.fillStyle = 'rgba(255,255,255,0.06)';
        for (let i = 0; i < count; i++) {
          context.beginPath();
          context.arc(x[i] ?? 0, y[i] ?? 0, radius[i] ?? 1, 0, twoPi);
          context.fill();
        }
        return;
      }

      if (hasCursor) {
        const g = context.createRadialGradient(cx, cy, 0, cx, cy, CURSOR_GLOW_DIAMETER / 2);
        g.addColorStop(0, 'rgba(100, 140, 255, 0.08)');
        g.addColorStop(1, 'rgba(100, 140, 255, 0)');
        context.fillStyle = g;
        context.fillRect(cx - CURSOR_GLOW_DIAMETER / 2, cy - CURSOR_GLOW_DIAMETER / 2, CURSOR_GLOW_DIAMETER, CURSOR_GLOW_DIAMETER);
      }

      const cursorRadiusSq = CURSOR_RADIUS * CURSOR_RADIUS;
      for (let i = 0; i < count; i++) {
        let ax = 0;
        let ay = 0;
        if (hasCursor) {
          const dx = cx - (x[i] ?? 0);
          const dy = cy - (y[i] ?? 0);
          const distSq = dx * dx + dy * dy;
          if (distSq < cursorRadiusSq && distSq > 1) {
            const dist = Math.sqrt(distSq);
            const n = 1 / dist;
            const f = ATTRACT_STRENGTH * (1 - dist / CURSOR_RADIUS);
            ax += dx * n * f;
            ay += dy * n * f;
          }
        }
        const scale = 0.002;
        const speed = 0.0003;
        const nx = noise2D((noiseOffset[i * 2] ?? 0) + (x[i] ?? 0) * scale, (noiseOffset[i * 2 + 1] ?? 0) + t * 100) * 2 - 1;
        const ny = noise2D((noiseOffset[i * 2] ?? 0) + 100 + (x[i] ?? 0) * scale, (noiseOffset[i * 2 + 1] ?? 0) + (y[i] ?? 0) * scale + t * 100) * 2 - 1;
        ax += nx * speed * 80;
        ay += ny * speed * 80;
        vx[i] = ((vx[i] ?? 0) + ax) * PARTICLE_FRICTION;
        vy[i] = ((vy[i] ?? 0) + ay) * PARTICLE_FRICTION;
        x[i] = (x[i] ?? 0) + (vx[i] ?? 0);
        y[i] = (y[i] ?? 0) + (vy[i] ?? 0);
        if ((x[i] ?? 0) < 0 || (x[i] ?? 0) > width) {vx[i] = (vx[i] ?? 0) * -0.5;}
        if ((y[i] ?? 0) < 0 || (y[i] ?? 0) > height) {vy[i] = (vy[i] ?? 0) * -0.5;}
        x[i] = Math.max(0, Math.min(width, x[i] ?? 0));
        y[i] = Math.max(0, Math.min(height, y[i] ?? 0));
      }

      for (let i = 0; i < count; i++) {
        context.fillStyle = `rgba(255,255,255,${opacity[i] ?? 0})`;
        context.beginPath();
        context.arc(x[i] ?? 0, y[i] ?? 0, radius[i] ?? 1, 0, twoPi);
        context.fill();
      }
    }

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      mq.removeEventListener('change', setReduced);
      window.removeEventListener('mousemove', mouseHandler);
      window.removeEventListener('touchmove', mouseHandler);
      window.removeEventListener('mouseleave', mouseLeave);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="living-canvas-backdrop" aria-hidden="true" role="presentation">
      <canvas ref={canvasRef} className="living-canvas-canvas" />
      <div className="living-canvas-vignette" />
      <div className="living-canvas-noise" />
    </div>
  );
}
