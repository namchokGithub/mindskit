import type { Transition, Variants } from "motion/react";

/**
 * Shared motion presets. Keep animations short (150–250 ms) and ease-out so
 * tools stay snappy; `MotionProvider` turns transform animations off for users
 * who prefer reduced motion.
 */
export const motionEase: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const motionDurations = { fast: 0.15, base: 0.2, slow: 0.25 } as const;

export const baseTransition: Transition = { duration: motionDurations.base, ease: motionEase };

/** Parent of a list whose children use `listItemVariants`; staggers children on mount. */
export const listContainerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
  exit: { opacity: 0, transition: { duration: motionDurations.fast, ease: motionEase } },
};

/** Item that fades/slides in, and shrinks out when removed inside `AnimatePresence`. */
export const listItemVariants: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: baseTransition },
  exit: { opacity: 0, scale: 0.94, transition: { duration: motionDurations.fast, ease: motionEase } },
};

/** Simple fade for swapping blocks, such as an empty state and its content. */
export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: baseTransition },
  exit: { opacity: 0, transition: { duration: motionDurations.fast, ease: motionEase } },
};

/** Micro "pop" for icons that swap state, such as Copy → Check. */
export const popVariants: Variants = {
  hidden: { opacity: 0, scale: 0.5 },
  show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 600, damping: 24 } },
  exit: { opacity: 0, scale: 0.5, transition: { duration: 0.1 } },
};
