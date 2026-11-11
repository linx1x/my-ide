import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily: headingFont } = loadFont("normal", { weights: ["600", "700"], subsets: ["latin"] });

export type TextSlideProps = {
  title: string;
  subtitle?: string;
};

export const TextSlide: React.FC<TextSlideProps> = ({ title, subtitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const scale = spring({
    frame,
    fps,
    config: { damping: 24, stiffness: 180 },
  });

  const subtitleOpacity = interpolate(frame, [8, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #0a0e17 0%, #0d1321 40%, #1a1f35 100%)",
        justifyContent: "center",
        alignItems: "center",
        padding: 48,
      }}
    >
      <div
        style={{
          opacity,
          transform: `scale(${0.92 + scale * 0.08})`,
          textAlign: "center",
          maxWidth: 920,
        }}
      >
        <h1
          style={{
            fontFamily: headingFont,
            fontSize: 64,
            fontWeight: 700,
            color: "#f0f6fc",
            margin: 0,
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            textShadow: "0 0 40px rgba(59, 130, 246, 0.15)",
          }}
        >
          {title}
        </h1>
        {subtitle ? (
          <p
            style={{
              fontFamily: "system-ui, sans-serif",
              fontSize: 26,
              color: "#94a3b8",
              marginTop: 28,
              marginBottom: 0,
              lineHeight: 1.5,
              opacity: subtitleOpacity,
            }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
