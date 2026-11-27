import {cleanup, render, screen, waitFor} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

import {AUTH_REQUIRED} from '@directwerk/api/constants'

const {ensureAuthenticated, fetchMe, replace} = vi.hoisted(() => ({
    ensureAuthenticated: vi.fn(),
    fetchMe: vi.fn(),
    replace: vi.fn(),
}))

vi.mock('next/navigation', () => ({useRouter: () => ({replace})}))
vi.mock('@/components/i18n/LocaleProvider', () => ({
    useDictionary: () => ({
        auth: {connectionFailed: 'Verbindung fehlgeschlagen', studioLoading: 'Lädt…'},
    }),
}))
vi.mock('@/components/i18n/useLocalizedPath', () => ({
    useLocalizedPath: () => (path: string) => `/de${path}`,
}))
vi.mock('@/lib/api/authApi', () => ({fetchMe}))
vi.mock('@/lib/auth/session', () => ({ensureAuthenticated, clearSessionTokens: vi.fn()}))
vi.mock('@directwerk/api/client/useCachedTenantQuery', () => ({
    clearAllCachedTenantData: vi.fn(),
}))

import AuthGuard from './AuthGuard'

afterEach(() => {
    cleanup()
    ensureAuthenticated.mockReset()
    fetchMe.mockReset()
    replace.mockReset()
})

describe('AuthGuard', () => {
    it('resumes a fresh tab from the refresh cookie without redirecting', async () => {
        ensureAuthenticated.mockResolvedValue('token')
        fetchMe.mockResolvedValue({userId: 1, email: 'ed@example.com', roles: ['EDITOR']})

        render(<AuthGuard><p>Studio content</p></AuthGuard>)

        expect(screen.getByText('Studio content')).toBeInTheDocument()
        await waitFor(() => expect(fetchMe).toHaveBeenCalled())
        expect(replace).not.toHaveBeenCalled()
    })

    it('redirects to login on a definitive auth failure', async () => {
        ensureAuthenticated.mockRejectedValue(new Error(AUTH_REQUIRED))

        render(<AuthGuard><p>Studio content</p></AuthGuard>)

        await waitFor(() => expect(replace).toHaveBeenCalledWith('/de/login'))
    })
})
