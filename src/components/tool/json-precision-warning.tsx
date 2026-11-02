import { TriangleAlert } from 'lucide-react'
import { useMemo } from 'react'

import { findUnsafeJsonNumbers } from '@/features/formatters/json-precision'

/** Warns when JSON input has numbers that JavaScript parsing would silently round. Ignores non-JSON (e.g. CSV) input. */
export function JsonPrecisionWarning({ input }: { input: string }) {
  const unsafe = useMemo(() => {
    const trimmed = input.trimStart()
    return trimmed.startsWith('{') || trimmed.startsWith('[') ? findUnsafeJsonNumbers(input) : []
  }, [input])

  if (unsafe.length === 0) return null
  return (
    <div role="status" className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3.5 py-2.5 text-sm text-warning">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <span className="break-words">
        Some numbers are too large or too precise for JavaScript and may change in the result: <code className="font-mono">{unsafe.join(', ')}</code>. Quote them as strings to keep them exact.
      </span>
    </div>
  )
}
