import { ChevronRight, ChevronsUpDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { categories, getToolsByCategory, tools } from '@/config/tools'
import { cn } from '@/lib/utils'

const DEFAULT_OPEN_CATEGORIES = categories.slice(0, 1).map((category) => category.id)

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation()
  const [openCategories, setOpenCategories] = useState<Set<string>>(() => new Set(DEFAULT_OPEN_CATEGORIES))

  useEffect(() => {
    const activeCategory = tools.find((tool) => tool.path === location.pathname)?.category
    if (!activeCategory) return
    setOpenCategories((prev) => (prev.has(activeCategory) ? prev : new Set(prev).add(activeCategory)))
  }, [location.pathname])

  const toggleCategory = (id: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allCategoriesOpen = openCategories.size === categories.length

  const toggleAllCategories = () => {
    setOpenCategories(allCategoriesOpen ? new Set() : new Set(categories.map((category) => category.id)))
  }

  return (
    <nav className="flex flex-col gap-1">
      <button
        type="button"
        onClick={toggleAllCategories}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
        aria-label={allCategoriesOpen ? 'Collapse all menu groups' : 'Expand all menu groups'}
      >
        <ChevronsUpDown className="size-3.5" />
        {allCategoriesOpen ? 'Collapse all' : 'Expand all'}
      </button>
      {categories.map((category) => {
        const isOpen = openCategories.has(category.id)
        return (
          <Collapsible key={category.id} open={isOpen} onOpenChange={() => toggleCategory(category.id)}>
            <CollapsibleTrigger className="flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase transition-colors hover:bg-accent/60 hover:text-foreground">
              <ChevronRight className={cn('size-3.5 shrink-0 transition-transform', isOpen && 'rotate-90')} />
              {category.name}
            </CollapsibleTrigger>
            <CollapsibleContent className="flex flex-col gap-1 py-1">
              {getToolsByCategory(category.id).map((tool) => (
                <NavLink
                  key={tool.id}
                  to={tool.path}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 rounded-lg border border-transparent py-1.5 pr-2 pl-6 text-sm font-medium transition-colors',
                      isActive
                        ? 'sidebar-tool-active border-[color-mix(in_oklch,var(--primary)_24%,transparent)] text-primary-hover'
                        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                    )
                  }
                >
                  <tool.icon className="size-4 shrink-0" />
                  <span className="truncate">{tool.name}</span>
                  {tool.comingSoon && (
                    <Badge variant="secondary" className="badge-soon ml-auto shrink-0 px-1.5 py-0 text-[10px]">
                      Soon
                    </Badge>
                  )}
                </NavLink>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )
      })}
    </nav>
  )
}
