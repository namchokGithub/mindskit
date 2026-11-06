import { useRef, useState } from 'react'

import { LargeInputDialog } from '@/components/tool/large-input-dialog'

export const DEFAULT_LARGE_INPUT_LIMIT_BYTES = 5 * 1024 * 1024

export function useLargeInputConfirmation(limitBytes = DEFAULT_LARGE_INPUT_LIMIT_BYTES) {
  const [pendingAction, setPendingAction] = useState<{ input: string; action: () => void } | null>(null)
  // One confirmation covers one input: re-running the same input (an option, indent, or affix change) does not ask
  // again, while a new or edited input over the limit does.
  const confirmedInput = useRef<string | null>(null)

  const confirm = (input: string, action: () => void) => {
    if (input === confirmedInput.current || new Blob([input]).size <= limitBytes) {
      action()
      return
    }
    setPendingAction({ input, action })
  }

  const limitLabel = limitBytes < 1024 * 1024 ? `${Math.round(limitBytes / 1024)} KB` : `${Math.round(limitBytes / (1024 * 1024))} MB`
  const dialog = pendingAction ? <LargeInputDialog limitLabel={limitLabel} onCancel={() => setPendingAction(null)} onContinue={() => { const { input, action } = pendingAction; confirmedInput.current = input; setPendingAction(null); action() }} /> : null

  return { confirm, dialog }
}
