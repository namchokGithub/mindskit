import { AudioLines } from "lucide-react";
import { useEffect, useRef } from "react";

import {
  NOISE_FRAME_SIZE,
  fillNoiseFrame,
  type NoiseColor,
} from "@/features/screen-simulator/noise";

/**
 * Animated black-and-white TV static (the same for every noise color). It moves while sound is playing and freezes when paused;
 * with reduced motion it redraws only a few times per second.
 */
export function NoiseScreen({
  color,
  playing,
  remainingSeconds,
}: {
  color: NoiseColor;
  playing: boolean;
  remainingSeconds: number | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { width, height } = NOISE_FRAME_SIZE;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const image = context.createImageData(width, height);
    const draw = () => {
      fillNoiseFrame(image.data);
      context.putImageData(image, 0, 0);
    };
    draw();
    if (!playing) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const frameInterval = reduced ? 250 : 1000 / 30;
    let last = 0;
    let frame = requestAnimationFrame(function tick(time) {
      if (time - last >= frameInterval) {
        last = time;
        draw();
      }
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing, width, height]);

  const minutes =
    remainingSeconds === null
      ? null
      : `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, "0")}`;
  return (
    <div className="absolute inset-0 bg-black">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="absolute inset-0 h-full w-full [image-rendering:pixelated]"
      />
      <div className="absolute bottom-[5cqh] left-1/2 flex -translate-x-1/2 items-center gap-[1.5cqw] rounded-full bg-black/65 px-[2.5cqw] py-[1.2cqh] text-white backdrop-blur-sm">
        <AudioLines
          className={
            playing ? "animate-pulse motion-reduce:animate-none" : "opacity-50"
          }
          style={{ width: "3.4cqh", height: "3.4cqh" }}
        />
        <span className="capitalize" style={{ fontSize: "2.6cqh" }}>
          {color} noise
        </span>
        <span className="text-white/60" style={{ fontSize: "2.2cqh" }}>
          {playing ? (minutes ? `Stops in ${minutes}` : "Playing") : "Paused"}
        </span>
      </div>
    </div>
  );
}
