import { ArrowLeft, Search, SearchX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { tools } from '@/config/tools'

export function NotFoundPage() {
  const { pathname } = useLocation()
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return []
    return tools
      .filter(
        (tool) =>
          tool.name.toLowerCase().includes(normalized) ||
          tool.description.toLowerCase().includes(normalized),
      )
      .slice(0, 8)
  }, [query])

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 py-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <SearchX className="size-8 text-muted-foreground" />
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Page not found</h1>
          <p className="text-sm break-all text-muted-foreground">
            There is no page at <code className="rounded bg-muted px-1 py-0.5 text-foreground">{pathname}</code>.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/">
            <ArrowLeft />
            Back to Home
          </Link>
        </Button>
      </div>

      <section className="space-y-2 rounded-lg border border-border bg-card/60 p-3">
        <label className="relative block">
          <span className="sr-only">Find a tool</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a tool…"
            className="h-9 w-full rounded-lg border border-input bg-background py-1 pr-2 pl-8 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
          />
        </label>
        {query.trim() &&
          (results.length ? (
            <ul className="space-y-0.5">
              {results.map((tool) => (
                <li key={tool.id}>
                  <Link to={tool.path} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent">
                    <tool.icon className="size-4 shrink-0 text-primary" />
                    <span className="truncate text-sm font-medium text-foreground">{tool.name}</span>
                    {tool.comingSoon && (
                      <Badge variant="secondary" className="ml-auto shrink-0 px-1.5 py-0 text-[10px]">
                        Soon
                      </Badge>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-2 py-3 text-sm text-muted-foreground">No tools found.</p>
          ))}
      </section>
    </div>
  )
}
