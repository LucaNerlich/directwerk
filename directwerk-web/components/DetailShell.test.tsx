import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

import DetailShell from '@/components/DetailShell'
import {TestLocale} from '@/lib/i18n/testWrapper'

afterEach(cleanup)

describe('DetailShell', () => {
    it('shows a skeleton while loading', () => {
        render(
            <TestLocale><DetailShell
                backHref="/episodes"
                backLabel="← Alle Folgen"
                isLoading
                isAuthenticated={false}
                errorMessage={null}
                onRetry={() => {}}
                notFound={null}
                unlockHref="/pricing"
            />,</TestLocale>
        )

        expect(screen.getByLabelText('Inhalt wird geladen')).toBeInTheDocument()
    })

    it('shows a paid-gate EmptyState with Anmelden/Mitgliedschaft/retry actions', () => {
        const onRetry = vi.fn()
        render(
            <TestLocale><DetailShell
                backHref="/articles"
                backLabel="← Beiträge"
                isLoading={false}
                isAuthenticated={false}
                errorMessage={null}
                onRetry={onRetry}
                notFound={{
                    title: 'Beitrag nicht verfügbar',
                    description: 'Anmelden für bezahlte Inhalte.',
                }}
                unlockHref="/pricing#basis"
            /></TestLocale>,
        )

        expect(
            screen.getByRole('heading', {name: 'Beitrag nicht verfügbar'}),
        ).toBeInTheDocument()
        expect(screen.getByRole('link', {name: 'Anmelden'})).toHaveAttribute(
            'href',
            '/de/login',
        )
        expect(
            screen.getByRole('link', {name: 'Mitgliedschaft ansehen'}),
        ).toHaveAttribute('href', '/pricing#basis')
        fireEvent.click(screen.getByRole('button', {name: 'Erneut versuchen'}))
        expect(onRetry).toHaveBeenCalledTimes(1)
    })

    it('omits the login action for authenticated subscribers', () => {
        render(
            <TestLocale><DetailShell
                backHref="/episodes"
                backLabel="← Alle Folgen"
                isLoading={false}
                isAuthenticated
                errorMessage={null}
                onRetry={() => {}}
                notFound={{title: 'Folge nicht verfügbar', description: 'Gesperrt.'}}
                unlockHref="/pricing"
            />,</TestLocale>
        )

        expect(screen.queryByRole('link', {name: 'Anmelden'})).not.toBeInTheDocument()
        expect(
            screen.getByRole('link', {name: 'Mitgliedschaft ansehen'}),
        ).toBeInTheDocument()
    })

    it('shows transport errors as an alert with retry', () => {
        const onRetry = vi.fn()
        render(
            <TestLocale><DetailShell
                backHref="/episodes"
                backLabel="← Alle Folgen"
                isLoading={false}
                isAuthenticated={false}
                errorMessage="Folge konnte nicht geladen werden."
                onRetry={onRetry}
                notFound={null}
                unlockHref="/pricing"
            /></TestLocale>,
        )

        expect(
            screen.getByText('Folge konnte nicht geladen werden.'),
        ).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', {name: 'Erneut versuchen'}))
        expect(onRetry).toHaveBeenCalledTimes(1)
    })
})
