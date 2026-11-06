import { css, faceValue, flipClock, theme, type Face, type FaceValue } from 'flipclock'
import { useEffect, useRef } from 'react'

/**
 * A FlipClock.js face whose text is set from outside. MindsKit keeps its own clock/timer state (pause, laps,
 * offsets), so the library only renders and animates the flipping cards.
 */
class ExternalValueFace implements Face<ExternalValueFace> {
  readonly value: FaceValue<string>

  constructor(initial: string) {
    this.value = faceValue(initial)
  }

  faceValue() {
    return this.value
  }

  interval() {
    // Values are pushed from React; nothing to compute on the library's timer.
  }
}

/** Flip-card display in the flipclockjs.com style. `fontSize` accepts any CSS length (e.g. `18cqh`). */
export function FlipDisplay({ value, fontSize }: { value: string; fontSize: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const faceRef = useRef<ExternalValueFace | null>(null)
  const latestValue = useRef(value)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const face = new ExternalValueFace(latestValue.current)
    const instance = flipClock({
      parent: container,
      face,
      autoStart: false,
      theme: theme({
        dividers: [':', '.'],
        css: css({ fontSize, fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', animationDuration: reduced ? '0ms' : '250ms' }),
      }),
    })
    faceRef.current = face
    return () => {
      instance.unmount()
      faceRef.current = null
    }
  }, [fontSize])

  useEffect(() => {
    latestValue.current = value
    const face = faceRef.current
    if (face && face.value.value !== value) face.value.value = value
  }, [value])

  return <div ref={containerRef} className="dark flex justify-center [&_.flip-clock]:w-auto" />
}
