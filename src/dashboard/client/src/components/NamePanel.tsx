import { useState } from 'react';
import { Player } from '@remotion/player';
import { NameAnimation, ANIMATION_TYPES, type NameAnimationType } from './NameAnimation';

const FPS = 30;
const DURATION_FRAMES = 90;
const WIDTH = 400;
const HEIGHT = 120;

export function NamePanel() {
  const [animationType, setAnimationType] = useState<NameAnimationType>('fade');

  return (
    <>
      <div className="sidebar-header">
        <span className="sidebar-title">MY NAME</span>
      </div>
      <div className="sidebar-body name-panel">
        <div className="name-animation-wrapper">
          <Player
            component={NameAnimation}
            inputProps={{ animationType }}
            compositionWidth={WIDTH}
            compositionHeight={HEIGHT}
            durationInFrames={DURATION_FRAMES}
            fps={FPS}
            style={{ width: WIDTH, height: HEIGHT, maxWidth: '100%' }}
            loop
            controls
          />
        </div>
        <div className="name-animation-buttons">
          {ANIMATION_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className={`name-anim-btn ${animationType === type ? 'active' : ''}`}
              onClick={() => setAnimationType(type)}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
