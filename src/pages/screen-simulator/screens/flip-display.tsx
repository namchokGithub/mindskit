import {
  css,
  faceValue,
  flipClock,
  theme,
  type Face,
  type FaceValue,
} from "flipclock";
import { useEffect, useRef } from "react";

/**
 * A FlipClock.js face whose text is set from outside. MindsKit keeps its own clock/timer state (pause, laps,
 * offsets), so the library only renders and animates the flipping cards.
 */
class ExternalValueFace implements Face<ExternalValueFace> {
  readonly value: FaceValue<string>;

  constructor(initial: string) {
    this.value = faceValue(initial);
  }

  faceValue() {
    return this.value;
  }

  interval() {
    // Values are pushed from React; nothing to compute on the library's timer.
  }
}

export type FlipAppearance = "dark" | "light";

/**
 * Light theme, following the flipclockjs.com "Customizing CSS" guide: keep the default dark cards but make the digits
 * white and the dividers dark so they read on the white background the light screens use.
 */
const lightCss = css.extend(() => ({
  ".flip-clock-divider": { color: "#1C1C1E" },
  ".flip-clock-card": { color: "#FFFFFF" },
}));

/**
 * Dark theme, the mirror of light: white cards with black digits on the black background, light dividers. Card
 * faces, hinge lines, and flip shading are overridden because the default theme draws dark cards.
 */
const darkCss = css.extend(() => ({
  ".flip-clock-divider": { color: "#F2F2F2" },
  ".flip-clock-card": {
    color: "#000000",
    boxShadow:
      "0 1.5px 3px rgba(255, 255, 255, 0.12), 0 3px 8px rgba(0, 0, 0, 0.4)",
    ".flip-clock-card-item-inner": {
      ".top, .bottom": {
        background: "#ededed",
        boxShadow: "inset 0 0 .2em rgba(0, 0, 0, .15)",
      },
      ".top": { "&:before": { background: "#8E8E93" } },
      ".bottom": { "&:before": { background: "#ededed" } },
    },
    ".before": {
      ".top": {
        "&:after": {
          background:
            "linear-gradient(to bottom, rgba(0,0,0,.02) 0%, rgba(0,0,0,.25) 100%)",
        },
      },
      ".bottom": {
        "&:after": {
          background:
            "linear-gradient(to bottom, rgba(0,0,0,.25) 0%, rgba(0,0,0,.02) 100%)",
        },
      },
    },
  },
}));

/** Flip-card display in the flipclockjs.com style. `fontSize` accepts any CSS length (e.g. `18cqh`). */
export function FlipDisplay({
  value,
  fontSize,
  appearance = "dark",
}: {
  value: string;
  fontSize: string;
  appearance?: FlipAppearance;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<ExternalValueFace | null>(null);
  const latestValue = useRef(value);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const face = new ExternalValueFace(latestValue.current);
    const instance = flipClock({
      parent: container,
      face,
      autoStart: false,
      theme: theme({
        dividers: [":", "."],
        css: (appearance === "light" ? lightCss : darkCss)({
          fontSize,
          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          animationDuration: reduced ? "0ms" : "250ms",
        }),
      }),
    });
    faceRef.current = face;
    return () => {
      instance.unmount();
      faceRef.current = null;
    };
  }, [fontSize, appearance]);

  useEffect(() => {
    latestValue.current = value;
    // Push the value inside requestAnimationFrame, like the library's own timer does. A card removes its
    // `animate` class when the value changes and re-adds it on the next frame; if the change happens outside a
    // frame callback (React effects run after paint), the browser never sees the class removed and the flip
    // animation does not restart, so some seconds appear not to flip.
    const frame = requestAnimationFrame(() => {
      const face = faceRef.current;
      if (face && face.value.value !== latestValue.current) face.value.value = latestValue.current;
    });
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="flex justify-center [&_.flip-clock]:w-auto"
    />
  );
}
