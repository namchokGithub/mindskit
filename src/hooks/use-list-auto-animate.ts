import { useAutoAnimate } from "@formkit/auto-animate/react";

import { motionDurations } from "@/lib/motion";

/**
 * AutoAnimate for simple lists that add, remove, or reorder children without
 * their own transforms. Do not use it on lists managed by `@dnd-kit` or Motion
 * `layout`, because both would animate the same move. AutoAnimate already
 * respects `prefers-reduced-motion`.
 */
export function useListAutoAnimate<T extends HTMLElement>() {
  const [ref] = useAutoAnimate<T>({ duration: motionDurations.slow * 1000, easing: "ease-out" });
  return ref;
}
