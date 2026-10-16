import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import type { ReactNode } from "react";

/**
 * Wrap an animated feature in this provider and use `m.*` from
 * `motion/react-m`. `LazyMotion` keeps the bundle small, `strict` rejects the
 * heavier `motion.*` components, and `reducedMotion="user"` follows the
 * operating-system preference.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
