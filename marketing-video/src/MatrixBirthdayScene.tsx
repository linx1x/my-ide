import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { MatrixRain } from "./MatrixRain";
import ASCII_CAT from "./ascii/matrix-birthday-cat.txt";
import ASCII_CAKE from "./ascii/matrix-birthday-cake.txt";

export const MatrixBirthdayScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const catPulse = spring({
    frame,
    fps,
    config: { damping: 30, stiffness: 80 },
    durationInFrames: 90,
  });
  const scale = 0.97 + catPulse * 0.05;

  const textStart = 0.5 * fps;
  const textFade = interpolate(frame, [textStart, textStart + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const glitchWindow = [textStart + 12, textStart + 28];
  const inGlitch =
    frame >= glitchWindow[0] && frame <= glitchWindow[1];
  const glitchIntensity = inGlitch
    ? interpolate(
        frame,
        [glitchWindow[0], glitchWindow[0] + 8, glitchWindow[1]],
        [1, 1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      )
    : 0;
  const flicker = ((frame * 11 + 3) % 4) < 2 ? 1 : 0;
  const jitterPx =
    glitchIntensity * flicker * (2 + ((frame * 13) % 3));

  const chromaR = glitchIntensity * flicker * 2;
  const chromaB = glitchIntensity * flicker * -2;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000",
      }}
    >
      {/* Optional sound: add public/matrix-ambient.mp3 and uncomment:
          import { Audio } from "@remotion/media"; import { staticFile } from "remotion";
          <Audio src={staticFile("matrix-ambient.mp3")} volume={0.35} loop /> */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.55 }}>
        <MatrixRain
          layer={0}
          speedFactor={0.85}
          frameOffset={0}
          opacityScale={1}
          fontSize={14}
          columnWidth={14}
          numColumns={100}
        />
      </div>
      <div style={{ position: "absolute", inset: 0, opacity: 0.75 }}>
        <MatrixRain
          layer={1}
          speedFactor={1.15}
          frameOffset={40}
          opacityScale={1}
          fontSize={19}
          columnWidth={19}
          numColumns={72}
        />
      </div>
      <div style={{ position: "absolute", inset: 0, opacity: 0.9 }}>
        <MatrixRain
          layer={2}
          speedFactor={1.4}
          frameOffset={80}
          opacityScale={1}
          fontSize={11}
          columnWidth={11}
          numColumns={120}
        />
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            opacity: interpolate(frame, [0, 0.4 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            transform: `scale(${scale})`,
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: 11,
            lineHeight: 1.12,
            color: "#00DD00",
            textShadow:
              "0 0 10px #00FF00, 0 0 20px #00DD00, 0 0 32px rgba(0,255,0,0.45)",
            whiteSpace: "pre",
            textAlign: "center",
            maxWidth: "96%",
          }}
        >
          {ASCII_CAT}
          {"\n\n"}
          {ASCII_CAKE}
        </div>
        <div
          style={{
            position: "relative",
            marginTop: 6,
          }}
        >
          <div
            style={{
              opacity: textFade,
              transform: `translateX(${jitterPx}px)`,
              fontFamily: '"Courier New", Courier, monospace',
              fontSize: 52,
              fontWeight: 700,
              color: "#00FF00",
              textShadow: `${chromaR}px 0 0 rgba(255,0,80,0.55), ${chromaB}px 0 0 rgba(0,255,255,0.45), 0 0 14px #00FF00, 0 0 28px #00DD00`,
              letterSpacing: "0.06em",
            }}
          >
            Happy Birthday
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
