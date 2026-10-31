'use client'

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react'

import {STUDIO_THEME_STORAGE_KEY} from '@/lib/studio/theme-init-script'

export type Theme = 'dark' | 'light' | 'system'

export {STUDIO_THEME_STORAGE_KEY}

type ThemeProviderProps = {
    children: ReactNode
    defaultTheme?: Theme
    /** localStorage key — studio-scoped like desk preference. */
    storageKey?: string
}

type ThemeProviderState = {
    theme: Theme
    /** Resolved light/dark after applying system preference. */
    resolvedTheme: 'light' | 'dark'
    setTheme: (theme: Theme) => void
}

const ThemeProviderContext = createContext<ThemeProviderState | null>(null)

function readStoredTheme(storageKey: string, fallback: Theme): Theme {
    if (typeof window === 'undefined') {
        return fallback
    }
    try {
        const stored = window.localStorage.getItem(storageKey)
        if (stored === 'dark' || stored === 'light' || stored === 'system') {
            return stored
        }
    } catch {
        // Private mode / blocked storage — keep default.
    }
    return fallback
}

function systemPrefersDark(): boolean {
    if (typeof window === 'undefined') {
        return false
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
    if (theme === 'system') {
        return systemPrefersDark() ? 'dark' : 'light'
    }
    return theme
}

function applyThemeClass(resolved: 'light' | 'dark'): void {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(resolved)
}

/**
 * Class-based theme provider matching shared `@directwerk/ui` `.dark` tokens
 * (`theme.css` `@custom-variant dark`). Persists to localStorage.
 *
 * Until the client mounts, the document class is owned by the SSR-safe
 * `themeInitScript` string (`lib/studio/theme-init-script.ts`) so this provider
 * does not overwrite the pre-paint theme during hydration.
 */
export function ThemeProvider({
    children,
    defaultTheme = 'system',
    storageKey = STUDIO_THEME_STORAGE_KEY,
}: ThemeProviderProps): React.JSX.Element {
    const [theme, setThemeState] = useState<Theme | null>(null)
    const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() =>
        resolveTheme(defaultTheme),
    )

    useEffect(() => {
        setThemeState(readStoredTheme(storageKey, defaultTheme))
    }, [defaultTheme, storageKey])

    useEffect(() => {
        if (theme === null) {
            return
        }

        const resolved = resolveTheme(theme)
        applyThemeClass(resolved)
        setResolvedTheme(resolved)

        if (theme !== 'system') {
            return
        }

        const media = window.matchMedia('(prefers-color-scheme: dark)')
        const onChange = (): void => {
            const next = resolveTheme('system')
            applyThemeClass(next)
            setResolvedTheme(next)
        }
        media.addEventListener('change', onChange)
        return () => media.removeEventListener('change', onChange)
    }, [theme])

    const setTheme = useCallback(
        (next: Theme) => {
            try {
                window.localStorage.setItem(storageKey, next)
            } catch {
                // Ignore quota / private-mode failures; in-memory theme still applies.
            }
            setThemeState(next)
        },
        [storageKey],
    )

    const value = useMemo(
        () => ({
            theme: theme ?? defaultTheme,
            resolvedTheme,
            setTheme,
        }),
        [theme, defaultTheme, resolvedTheme, setTheme],
    )

    return (
        <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>
    )
}

export function useTheme(): ThemeProviderState {
    const context = useContext(ThemeProviderContext)
    if (context === null) {
        throw new Error('useTheme must be used within a ThemeProvider')
    }
    return context
}
