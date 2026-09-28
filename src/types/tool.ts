import type { LucideIcon } from 'lucide-react'

export type ToolCategory = 'json' | 'xml' | 'formatters' | 'sql' | 'text-tools' | 'encode-decode' | 'generators' | 'converters' | 'images'

export interface ToolDefinition {
  id: string
  name: string
  description: string
  category: ToolCategory
  path: string
  icon: LucideIcon
  isNew?: boolean
  comingSoon?: boolean
}

export interface CategoryDefinition {
  id: ToolCategory
  name: string
}
