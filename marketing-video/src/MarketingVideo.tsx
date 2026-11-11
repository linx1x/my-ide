import React from "react";
import { TransitionSeries, linearTiming, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { TextSlide } from "./TextSlide";
import { CaptureScene } from "./CaptureScene";

const T = 15;
const FADE = linearTiming({ durationInFrames: T });
const SLIDE = linearTiming({ durationInFrames: 20 });

export const MarketingVideo: React.FC = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={90}>
        <TextSlide
          title="Code from your phone?"
          subtitle="Manage repos. Ship features. From anywhere."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={FADE} />
      <TransitionSeries.Sequence durationInFrames={90}>
        <TextSlide
          title="My IDE"
          subtitle="Cursor AI + Web IDE. From your phone or browser."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={SLIDE} />
      <TransitionSeries.Sequence durationInFrames={120}>
        <CaptureScene filename="dashboard-overview.png" caption="Dashboard — Explorer" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={FADE} />
      <TransitionSeries.Sequence durationInFrames={120}>
        <CaptureScene filename="dashboard-editor.png" caption="Code editor with file open" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={FADE} />
      <TransitionSeries.Sequence durationInFrames={120}>
        <CaptureScene filename="chat-panel.png" caption="Chat with the agent" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-left" })} timing={SLIDE} />
      <TransitionSeries.Sequence durationInFrames={90}>
        <CaptureScene filename="file-explorer.png" caption="File explorer" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={FADE} />
      <TransitionSeries.Sequence durationInFrames={120}>
        <CaptureScene filename="terminal.png" caption="Integrated terminal" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={FADE} />
      <TransitionSeries.Sequence durationInFrames={45}>
        <TextSlide title="Create an app from A to Z" subtitle="A few questions. Agent does the rest." />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-left" })} timing={linearTiming({ durationInFrames: 14 })} />
      <TransitionSeries.Sequence durationInFrames={50}>
        <CaptureScene filename="builder-step0-template.png" caption="Choose a template" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence durationInFrames={50}>
        <CaptureScene filename="builder-step1-goals.png" caption="A few questions" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={FADE} />
      <TransitionSeries.Sequence durationInFrames={50}>
        <CaptureScene filename="builder-step2-theme.png" caption="Theme & style" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={FADE} />
      <TransitionSeries.Sequence durationInFrames={50}>
        <CaptureScene filename="builder-step3-assets.png" caption="Assets & CTA" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={FADE} />
      <TransitionSeries.Sequence durationInFrames={50}>
        <CaptureScene filename="builder-step4-upload.png" caption="Optional upload" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={FADE} />
      <TransitionSeries.Sequence durationInFrames={50}>
        <CaptureScene filename="builder-step5-cta.png" caption="Almost there" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={FADE} />
      <TransitionSeries.Sequence durationInFrames={55}>
        <CaptureScene filename="builder-final-filled.png" caption="Describe your app — agent does the rest" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={SLIDE} />
      <TransitionSeries.Sequence durationInFrames={60}>
        <TextSlide
          title="Agent builds your app"
          subtitle="Design → Frontend → Backend. One click."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={FADE} />
      <TransitionSeries.Sequence durationInFrames={60}>
        <TextSlide
          title="Preview in browser"
          subtitle="Run and browse your app — no deploy needed."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={SLIDE} />
      <TransitionSeries.Sequence durationInFrames={75}>
        <CaptureScene filename="theme-cyberpunk.png" caption="Theme: Cyberpunk" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={FADE} />
      <TransitionSeries.Sequence durationInFrames={75}>
        <CaptureScene filename="theme-matrix.png" caption="Theme: Matrix" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={FADE} />
      <TransitionSeries.Sequence durationInFrames={75}>
        <CaptureScene filename="theme-glass.png" caption="Theme: Glassmorphism" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={FADE} />
      <TransitionSeries.Sequence durationInFrames={75}>
        <CaptureScene filename="theme-tactical-dark.png" caption="Theme: Tactical Dark" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-top" })} timing={SLIDE} />
      <TransitionSeries.Sequence durationInFrames={90}>
        <TextSlide
          title="Built for power users"
          subtitle="Multi-agent · Accept/Reject flow · Project builder from a prompt"
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={springTiming({ config: { damping: 25 }, durationInFrames: 22 })} />
      <TransitionSeries.Sequence durationInFrames={120}>
        <TextSlide title="Try it" subtitle="My IDE — code from anywhere" />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
