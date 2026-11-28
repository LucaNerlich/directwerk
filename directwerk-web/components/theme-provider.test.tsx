import {cleanup, render, screen} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {ThemeProvider, useTheme} from '@/components/theme-provider'
import {WEB_THEME_STORAGE_KEY} from '@/lib/theme/theme-init-script'

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
        window.localStorage.setItem(WEB_THEME_STORAGE_KEY, 'dark')

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
        expect(window.localStorage.getItem(WEB_THEME_STORAGE_KEY)).toBe('light')
    })
})

describe('ThemeProvider initial snapshot', () => {
    it('starts light even when the system prefers dark, then applies the preference', async () => {
        window.localStorage.clear()
        vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
            matches: query.includes('dark'),
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
        })))

        let firstRender: string | null = null
        function Probe(): React.JSX.Element {
            const {resolvedTheme} = useTheme()
            firstRender ??= resolvedTheme
            return <span data-testid="resolved">{resolvedTheme}</span>
        }

        render(
            <ThemeProvider>
                <Probe />
            </ThemeProvider>,
        )

        expect(firstRender).toBe('light')
        expect(await screen.findByTestId('resolved')).toHaveTextContent('dark')
        vi.unstubAllGlobals()
    })
})
