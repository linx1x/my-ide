import React from "react";
import { Composition } from "remotion";
import { MarketingVideo } from "./MarketingVideo";
import { MatrixBirthdayScene } from "./MatrixBirthdayScene";

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;

// Includes app-creation A–Z section; total ≈ 1400
const DURATION_IN_FRAMES = 1400;

// Matrix Birthday: ~8 seconds
const MATRIX_BIRTHDAY_DURATION = 8 * FPS;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MarketingVideo"
        component={MarketingVideo}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{}}
      />
      <Composition
        id="MatrixBirthday"
        component={MatrixBirthdayScene}
        durationInFrames={MATRIX_BIRTHDAY_DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{}}
      />
    </>
  );
};
