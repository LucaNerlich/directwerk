import {render, screen} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

const verifyEmail = vi.fn()
vi.mock('@/lib/api/client', () => ({
    verifyEmail: (...args: unknown[]) => verifyEmail(...args),
}))
vi.mock('next/navigation', () => ({
    useSearchParams: () => new URLSearchParams('token=abc'),
}))
vi.mock('@/lib/i18n/LocaleProvider', () => ({
    useLocale: () => 'de',
    useDictionary: () => ({
        auth: {
            verifyPending: 'E-Mail-Adresse wird bestätigt…',
            verifySuccess: 'E-Mail-Adresse bestätigt.',
            verifyInvalid: 'Dieser Bestätigungslink ist ungültig.',
            verifyMissingToken: 'Token fehlt.',
            verifyTitle: 'E-Mail bestätigen',
            resetToLogin: 'Zur Anmeldung',
        },
        common: {loading: 'Wird geladen…'},
    }),
}))
vi.mock('@/lib/i18n/paths', () => ({localizedPath: (lang: string, path: string) => `/${lang}${path}`}))

import VerifyEmailPage from './page'

describe('VerifyEmailPage', () => {
    it('confirms the token once and reports success', async () => {
        verifyEmail.mockResolvedValue(undefined)
        render(<VerifyEmailPage />)

        expect(await screen.findByText('E-Mail-Adresse bestätigt.')).toBeInTheDocument()
        expect(verifyEmail).toHaveBeenCalledTimes(1)
        expect(verifyEmail).toHaveBeenCalledWith('abc')
    })

    it('reports an invalid token', async () => {
        verifyEmail.mockRejectedValue(new Error('INVALID_VERIFICATION_TOKEN'))
        render(<VerifyEmailPage />)

        expect(await screen.findByText('Dieser Bestätigungslink ist ungültig.')).toBeInTheDocument()
    })
})
