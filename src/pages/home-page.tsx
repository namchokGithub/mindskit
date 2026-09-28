import { ArrowRight, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { categories, getToolsByCategory } from '@/config/tools'

export function HomePage() {
  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">MindsKit</h1>
        <p className="text-base text-muted-foreground">Simple tools for everyday development.</p>
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0 text-primary" />
          Your data stays in the browser. Nothing you paste here is sent to a server.
        </div>
      </section>

      {categories.map((category) => (
        <section key={category.id} id={category.id} className="scroll-mt-6 space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {category.name}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {getToolsByCategory(category.id).map((tool) => (
              <Link key={tool.id} to={tool.path}>
                <Card className="h-full transition-colors hover:border-primary/50 hover:bg-accent/40">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2 text-base">
                      <span className="flex min-w-0 items-center gap-2">
                        <tool.icon className="size-4 shrink-0 text-primary" />
                        <span className="truncate">{tool.name}</span>
                        {tool.comingSoon && (
                          <Badge variant="secondary" className="shrink-0 text-[10px]">
                            Soon
                          </Badge>
                        )}
                        {tool.isNew && (
                          <Badge className="shrink-0 text-[10px]">New</Badge>
                        )}
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{tool.description}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
