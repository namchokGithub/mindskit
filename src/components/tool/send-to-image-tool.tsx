import { ArrowRightLeft, Send, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { tools } from '@/config/tools'
import { sendImage } from '@/features/images/handoff'

/** Image tools that can receive a handed-off image, except the current one. */
function imageTargets(currentPath: string) {
  return tools.filter((tool) => tool.category === 'images' && !tool.comingSoon && tool.path !== currentPath)
}

/**
 * "Send to…" for an image result: builds the PNG with `getFile`, hands it off in memory, and opens the
 * chosen image tool. `getFile` may return null to cancel (for example when the result is not ready).
 */
export function SendToImageTool({
  currentPath,
  getFile,
  disabled,
  size = 'sm',
  label = 'Send to',
  className,
}: {
  currentPath: string
  getFile: () => Promise<File | null>
  disabled?: boolean
  size?: 'sm' | 'default'
  label?: string
  className?: string
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [busyPath, setBusyPath] = useState<string | null>(null)
  const from = tools.find((tool) => tool.path === currentPath)?.name ?? 'another tool'

  const send = async (path: string) => {
    setBusyPath(path)
    try {
      const file = await getFile()
      if (!file) return
      sendImage(file, from, path)
      setOpen(false)
      navigate(path)
    } catch (cause) {
      console.error('[send-to-image-tool]', cause)
      toast.error('Could not prepare the image to send.')
    } finally {
      setBusyPath(null)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size={size} disabled={disabled || busyPath !== null} className={className}>
          <Send />
          {busyPath ? 'Preparing…' : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1.5">
        <p className="px-2 pt-1 pb-1.5 text-xs text-muted-foreground">Open the result as PNG in:</p>
        <ul className="flex flex-col">
          {imageTargets(currentPath).map((tool) => (
            <li key={tool.id}>
              <button
                type="button"
                onClick={() => void send(tool.path)}
                disabled={busyPath !== null}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none disabled:opacity-50"
              >
                <tool.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{tool.name}</span>
                {busyPath === tool.path && <span className="text-xs text-muted-foreground">…</span>}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

/** Small note on the receiving page: which tool the current image came from. */
export function ReceivedImageNote({ from, onDismiss }: { from: string | null; onDismiss: () => void }) {
  if (!from) return null
  return (
    <div role="status" className="flex w-fit items-center gap-2 rounded-full border border-border bg-muted/40 py-1 pr-1 pl-3 text-xs text-muted-foreground">
      <ArrowRightLeft className="size-3.5" aria-hidden="true" />
      <span>From {from}</span>
      <Button type="button" size="icon-xs" variant="ghost" onClick={onDismiss} aria-label="Hide note"><X /></Button>
    </div>
  )
}
