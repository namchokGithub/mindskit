import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import { getThemeMode, resolveTheme, themes, type ThemeMode, type ThemePreference } from '@/config/themes'

const THEME_STORAGE_KEY = 'mindskit:theme'

interface ThemeContextValue {
  preference: ThemePreference
  theme: ReturnType<typeof resolveTheme>
  mode: ThemeMode
  setPreference: (preference: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function getSystemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function getInitialPreference(): ThemePreference {
  let stored: string | null = null
  try {
    stored = localStorage.getItem(THEME_STORAGE_KEY)
  } catch {
    return 'system'
  }
  if (stored === 'system' || themes.some((t) => t.id === stored)) {
    return stored as ThemePreference
  }
  return 'system'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(getInitialPreference)
  const [systemPrefersDark, setSystemPrefersDark] = useState(getSystemPrefersDark)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () => setSystemPrefersDark(media.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [])

  const theme = resolveTheme(preference, systemPrefersDark)
  const mode = getThemeMode(theme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.classList.toggle('dark', mode === 'dark')
  }, [theme, mode])

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, preference)
    } catch {
      // Storage can be blocked; keep the preference in memory only.
    }
  }, [preference])

  const setPreference = (next: ThemePreference) => setPreferenceState(next)

  return (
    <ThemeContext.Provider value={{ preference, theme, mode, setPreference }}>{children}</ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within a ThemeProvider')
  return context
}
