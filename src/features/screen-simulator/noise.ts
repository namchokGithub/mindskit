export type NoiseColor = 'white' | 'pink' | 'brown'

export const NOISE_TIMER_MINUTES = [0, 15, 30, 60] as const

/**
 * Fills `samples` with noise in the range [-1, 1]. Pink uses Paul Kellet's economy filter; brown integrates white
 * noise with a small leak so it never drifts away from zero.
 */
export function fillNoise(samples: Float32Array, color: NoiseColor, random: () => number = Math.random): Float32Array {
  let b0 = 0
  let b1 = 0
  let b2 = 0
  let brown = 0
  for (let index = 0; index < samples.length; index += 1) {
    const white = random() * 2 - 1
    if (color === 'white') {
      samples[index] = white
    } else if (color === 'pink') {
      b0 = 0.99765 * b0 + white * 0.099046
      b1 = 0.963 * b1 + white * 0.2965164
      b2 = 0.57 * b2 + white * 1.0526913
      samples[index] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.1848) * 0.18))
    } else {
      brown = (brown + 0.02 * white) / 1.02
      samples[index] = Math.max(-1, Math.min(1, brown * 3.5))
    }
  }
  return samples
}
