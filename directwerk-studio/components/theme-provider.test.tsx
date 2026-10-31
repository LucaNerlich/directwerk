import {cleanup, render, screen} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'

import {
    STUDIO_THEME_STORAGE_KEY,
    ThemeProvider,
    themeInitScript,
    useTheme,
} from '@/components/theme-provider'

function ThemeProbe(): React.JSX.Element {
    const {theme, resolvedTheme, setTheme} = useTheme()
    return (
        <div>
            <span data-testid="theme">{theme}</span>
            <span data-testid="resolved">{resolvedTheme}</span>
            <button type="button" onClick={() => setTheme('dark')}>
                dark
            </button>
            <button type="button" onClick={() => setTheme('light')}>
                light
            </button>
            <button type="button" onClick={() => setTheme('system')}>
                system
            </button>
        </div>
    )
}

describe('ThemeProvider', () => {
    beforeEach(() => {
        window.localStorage.clear()
        document.documentElement.classList.remove('light', 'dark')
    })

    afterEach(() => {
        cleanup()
    })

    it('applies a stored theme after mount and persists toggles', async () => {
        window.localStorage.setItem(STUDIO_THEME_STORAGE_KEY, 'dark')

        render(
            <ThemeProvider>
                <ThemeProbe />
            </ThemeProvider>,
        )

        expect(await screen.findByTestId('theme')).toHaveTextContent('dark')
        expect(screen.getByTestId('resolved')).toHaveTextContent('dark')
        expect(document.documentElement.classList.contains('dark')).toBe(true)

        screen.getByRole('button', {name: 'light'}).click()
        expect(await screen.findByTestId('theme')).toHaveTextContent('light')
        expect(document.documentElement.classList.contains('light')).toBe(true)
        expect(window.localStorage.getItem(STUDIO_THEME_STORAGE_KEY)).toBe('light')
    })

    it('emits a bootstrap script that mirrors the storage key', () => {
        const script = themeInitScript('custom-key')
        expect(script).toContain('custom-key')
        expect(script).toContain('prefers-color-scheme: dark')
        expect(script).toContain('classList.add')
    })
})
