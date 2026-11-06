import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

export function useCopy() {
  const [copied, setCopied] = useState(false)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    }
  }, [])

  const copy = async (value: string) => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success('Copied to clipboard')
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
      resetTimerRef.current = setTimeout(() => {
        resetTimerRef.current = null
        setCopied(false)
      }, 1500)
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  return { copied, copy }
}
