import { useCallback, useEffect, useRef, useState } from 'react'

import { clearImageHandoff, peekImageHandoff } from '@/features/images/handoff'

/**
 * Loads an image sent from another image tool when the page opens.
 * `receive` gets the file (usually the page's handleFile); `receivedFrom` names the sending tool until
 * `dismiss()` is called (when the user picks another image or clears the page).
 */
export function useImageHandoff(path: string, receive: (file: File) => unknown) {
  const [receivedFrom, setReceivedFrom] = useState<string | null>(null)
  const receiveRef = useRef(receive)
  // Declared before the loading effect, so it runs first and the latest handler is used.
  useEffect(() => {
    receiveRef.current = receive
  })

  useEffect(() => {
    const handoff = peekImageHandoff(path)
    if (!handoff) return
    let cancelled = false
    void Promise.resolve(receiveRef.current(handoff.file)).finally(() => {
      if (!cancelled) clearImageHandoff(handoff.id)
    })
    setReceivedFrom(handoff.from)
    return () => {
      cancelled = true
    }
  }, [path])

  const dismiss = useCallback(() => setReceivedFrom(null), [])
  return { receivedFrom, dismiss }
}
