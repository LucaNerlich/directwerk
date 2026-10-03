import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

import {LocaleProvider} from '@/components/i18n/LocaleProvider'
import de from '@/dictionaries/de.json'
import en from '@/dictionaries/en.json'
import type {Locale} from '@/lib/i18n/config'

vi.mock('@/components/marketing/AltchaWidget', () => ({
    default: ({
        onVerifiedChange,
    }: {
        onVerifiedChange?: (verified: boolean) => void
    }) => (
        <div>
            <input name="altcha" readOnly value="test-payload" />
            <button onClick={() => onVerifiedChange?.(true)} type="button">
                Verify captcha
            </button>
        </div>
    ),
}))

import Home from '@/app/[lang]/page'
import {LIVE_EXAMPLE_URL} from '@/lib/marketing/constants'

afterEach(() => cleanup())

async function renderHome(lang: Locale = 'de'): Promise<void> {
    const page = await Home({params: Promise.resolve({lang})})
    render(
        <LocaleProvider dictionary={lang === 'de' ? de : en} lang={lang}>
            {page}
        </LocaleProvider>,
    )
}

describe('Home', () => {
    it('introduces the platform with navigation and developer path (de)', async () => {
        await renderHome('de')

        expect(
            screen.getByRole('heading', {name: /Deine Inhalte/}),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('link', {name: 'API-Auszug ansehen'}),
        ).toHaveAttribute('href', '/de/developers')
        expect(
            screen.getByRole('link', {name: 'Vollständige Docs'}),
        ).toBeInTheDocument()
        expect(screen.getByRole('button', {name: 'Nachricht senden'})).toBeInTheDocument()
        expect(
            screen.getByRole('heading', {name: /Jeder Hörer bekommt seinen eigenen Feed/}),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('heading', {name: /Kurz beantwortet/}),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('link', {name: 'Live-Beispiel'}),
        ).toHaveAttribute('href', LIVE_EXAMPLE_URL)
        expect(
            screen.getByRole('heading', {
                name: /Liedermacherleben — eine echte Show auf Directwerk/,
            }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('link', {name: 'Liedermacherleben öffnen'}),
        ).toHaveAttribute('href', LIVE_EXAMPLE_URL)
    })

    it('renders English copy under /en', async () => {
        await renderHome('en')

        expect(
            screen.getByRole('heading', {name: /Your content/}),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('link', {name: 'View API excerpt'}),
        ).toHaveAttribute('href', '/en/developers')
        expect(screen.getByRole('button', {name: 'Send message'})).toBeInTheDocument()
        expect(
            screen.getByRole('heading', {name: /Every listener gets their own feed/}),
        ).toBeInTheDocument()
    })

    it('lets visitors try the feed builder demo', async () => {
        await renderHome('de')

        expect(screen.getByText(/Persönliche Feed-URL/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', {name: 'Bonus'}))
        expect(screen.getByText(/2 von 3 Formaten/)).toBeInTheDocument()
    })
})
