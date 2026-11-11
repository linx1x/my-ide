import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

export type CaptureSceneProps = {
  filename: string;
  caption?: string;
};

export const CaptureScene: React.FC<CaptureSceneProps> = ({ filename, caption }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const src = staticFile(`captures/${filename}`);

  const captionOpacity = caption
    ? interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;
  const captionY = caption
    ? spring({ frame, fps, config: { damping: 20, stiffness: 120 }, delayInFrames: 5 })
    : 0;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0e17",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
      />
      {caption ? (
        <div
          style={{
            position: "absolute",
            bottom: 48,
            left: 48,
            right: 48,
            opacity: captionOpacity,
            transform: `translateY(${(1 - captionY) * 20}px)`,
          }}
        >
          <div
            style={{
              display: "inline-block",
              padding: "12px 24px",
              background: "rgba(15, 23, 42, 0.85)",
              borderLeft: "4px solid #3b82f6",
              borderRadius: 4,
              fontFamily: "system-ui, sans-serif",
              fontSize: 22,
              fontWeight: 600,
              color: "#e2e8f0",
            }}
          >
            {caption}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
