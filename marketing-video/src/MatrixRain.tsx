import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

const MATRIX_CHARS =
  "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン";

export type MatrixRainProps = {
  /** Visual layer 0–2 for variety */
  layer?: number;
  /** Multiplier on fall speed */
  speedFactor?: number;
  /** Extra frames added to animation (stagger layers) */
  frameOffset?: number;
  /** 0–1 multiply column opacity */
  opacityScale?: number;
  /** Monospace font size in px */
  fontSize?: number;
  /** Column width in px */
  columnWidth?: number;
  /** Number of columns */
  numColumns?: number;
};

/** Deterministic choice from MATRIX_CHARS for column, row, frame */
function charAt(column: number, row: number, frame: number): string {
  const n =
    (column * 7 + row * 13 + Math.floor(frame / 3) * 17) % MATRIX_CHARS.length;
  return MATRIX_CHARS[n < 0 ? n + MATRIX_CHARS.length : n];
}

export const MatrixRain: React.FC<MatrixRainProps> = ({
  layer = 0,
  speedFactor = 1,
  frameOffset = 0,
  opacityScale = 1,
  fontSize = 18,
  columnWidth = 18,
  numColumns = 85,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const effectiveFrame = frame + frameOffset + layer * 23;
  const rowHeight = Math.round(fontSize * 1.25);

  const columns = useMemo(() => {
    const list: Array<{ x: number; speed: number; phase: number; content: string }> = [];
    const rows = Math.ceil((height / rowHeight) * 2) + 24;
    for (let c = 0; c < numColumns; c++) {
      const x = (c / numColumns) * width;
      const speed = (0.45 + (c % 13) / 26 + layer * 0.12) * speedFactor;
      const phase = (c * 31 + layer * 47) % 120;
      let content = "";
      for (let r = 0; r < rows; r++) {
        content += charAt(c + layer * 100, r, 0);
      }
      list.push({ x, speed, phase, content });
    }
    return list;
  }, [width, height, numColumns, layer, speedFactor, rowHeight]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        fontFamily: '"Courier New", Courier, monospace',
        fontSize,
        lineHeight: `${rowHeight}px`,
        color: "#00DD00",
        textShadow:
          "0 0 6px #00FF00, 0 0 12px #00DD00, 0 0 20px rgba(0,255,0,0.45)",
        pointerEvents: "none",
      }}
    >
      {columns.map((col, c) => {
        const offset = (effectiveFrame * col.speed + col.phase) * rowHeight;
        const totalH = col.content.length * rowHeight;
        const translateY = offset % totalH;
        const rows = col.content.length;
        const headRow = Math.floor(offset / rowHeight) % rows;
        const trailLen = 5;

        return (
          <div
            key={`${layer}-${c}`}
            style={{
              position: "absolute",
              left: col.x,
              top: 0,
              bottom: 0,
              width: columnWidth,
              height: "100%",
              overflow: "hidden",
              opacity: Math.min(1, (0.35 + (c % 7) / 14) * opacityScale),
              whiteSpace: "pre",
              letterSpacing: 0,
            }}
          >
            <div
              style={{
                transform: `translateY(${translateY}px)`,
                willChange: "transform",
              }}
            >
              {col.content.split("").map((ch, r) => {
                const trailDist = (r - headRow + rows) % rows;
                const isHead = trailDist === 0;
                const inTrail = trailDist > 0 && trailDist <= trailLen;
                const trailFade = inTrail ? 1 - trailDist / (trailLen + 1) : 0;
                return (
                  <span
                    key={r}
                    style={{
                      display: "block",
                      height: rowHeight,
                      lineHeight: `${rowHeight}px`,
                      color: isHead ? "#00FF00" : "#00DD00",
                      opacity: isHead ? 1 : 0.35 + trailFade * 0.55,
                      textShadow: isHead
                        ? "0 0 10px #00FF00, 0 0 22px #00DD00"
                        : inTrail
                          ? "0 0 4px rgba(0,255,0,0.5)"
                          : "none",
                    }}
                  >
                    {charAt(c + layer * 100, r, effectiveFrame)}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
