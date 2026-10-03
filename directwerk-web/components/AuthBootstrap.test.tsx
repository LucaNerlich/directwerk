import {act, fireEvent, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

const {navigation, replace, ensureAuthenticated} = vi.hoisted(() => ({
    navigation: {pathname: '/de'},
    replace: vi.fn(),
    ensureAuthenticated: vi.fn(),
}))

const router = {replace}

vi.mock('next/navigation', () => ({
    usePathname: () => navigation.pathname,
    useRouter: () => router,
}))
vi.mock('@/lib/auth/session', () => ({ensureAuthenticated}))
vi.mock('@/lib/auth/tokenStore', () => ({getAccessToken: () => 'token'}))

import {TestLocale} from '@/lib/i18n/testWrapper'

import AuthBootstrap from './AuthBootstrap'

afterEach(() => {
    navigation.pathname = '/de'
    replace.mockReset()
    ensureAuthenticated.mockReset()
})

describe('AuthBootstrap', () => {
    it('does not reuse public-path readiness after navigation to a protected path', async () => {
        let finishAuthentication!: () => void
        ensureAuthenticated.mockReturnValue(
            new Promise<string>((resolve) => {
                finishAuthentication = () => resolve('token')
            }),
        )
        const {rerender} = render(
            <TestLocale><AuthBootstrap><p>Page shell</p></AuthBootstrap></TestLocale>,
        )
        expect(screen.getByText('Page shell')).toBeInTheDocument()

        navigation.pathname = '/de/account'
        rerender(<TestLocale><AuthBootstrap><p>Page shell</p></AuthBootstrap></TestLocale>)

        expect(screen.getByText('Wird geladen…')).toBeInTheDocument()
        expect(screen.queryByText('Page shell')).not.toBeInTheDocument()

        await act(async () => finishAuthentication())
        expect(await screen.findByText('Page shell')).toBeInTheDocument()
    })

    it('treats newsletter confirm as a public path', async () => {
        navigation.pathname = '/de/newsletter/confirm'
        render(<TestLocale><AuthBootstrap><p>Confirm page</p></AuthBootstrap></TestLocale>)

        expect(screen.getByText('Confirm page')).toBeInTheDocument()
        await act(async () => {
            await Promise.resolve()
        })
        expect(replace).not.toHaveBeenCalled()
        expect(ensureAuthenticated).not.toHaveBeenCalled()
    })

    it('treats imprint and privacy as public paths', async () => {
        for (const pathname of ['/de/imprint', '/de/privacy']) {
            navigation.pathname = pathname
            replace.mockReset()
            ensureAuthenticated.mockReset()
            const {unmount} = render(
                <TestLocale><AuthBootstrap>
                    <p>Legal page</p>
                </AuthBootstrap></TestLocale>,
            )

            expect(screen.getByText('Legal page')).toBeInTheDocument()
            await act(async () => {
                await Promise.resolve()
            })
            expect(replace).not.toHaveBeenCalled()
            expect(ensureAuthenticated).not.toHaveBeenCalled()
            unmount()
        }
    })

    it('treats checkout cancel as a public path', async () => {
        navigation.pathname = '/de/checkout/cancel'
        render(
            <TestLocale><AuthBootstrap>
                <p>Cancel page</p>
            </AuthBootstrap></TestLocale>,
        )

        expect(screen.getByText('Cancel page')).toBeInTheDocument()
        await act(async () => {
            await Promise.resolve()
        })
        expect(replace).not.toHaveBeenCalled()
        expect(ensureAuthenticated).not.toHaveBeenCalled()
    })

    it('does not redirect on a transient auth failure and offers a retry', async () => {
        navigation.pathname = '/de/account'
        ensureAuthenticated.mockRejectedValue(new Error('AUTH_TRANSIENT'))
        render(
            <TestLocale><AuthBootstrap>
                <p>Account page</p>
            </AuthBootstrap></TestLocale>,
        )

        expect(
            await screen.findByRole('button', {name: 'Erneut versuchen'}),
        ).toBeInTheDocument()
        expect(replace).not.toHaveBeenCalled()

        ensureAuthenticated.mockResolvedValueOnce('token')
        await act(async () => {
            fireEvent.click(
                screen.getByRole('button', {name: 'Erneut versuchen'}),
            )
        })
        expect(await screen.findByText('Account page')).toBeInTheDocument()
        expect(replace).not.toHaveBeenCalled()
    })

    it('redirects to the locale-prefixed login on AUTH_REQUIRED', async () => {
        navigation.pathname = '/de/account'
        ensureAuthenticated.mockRejectedValue(new Error('AUTH_REQUIRED'))
        render(
            <TestLocale>
                <AuthBootstrap>
                    <p>Account page</p>
                </AuthBootstrap>
            </TestLocale>,
        )

        await act(async () => {
            await Promise.resolve()
        })
        expect(replace).toHaveBeenCalledWith(expect.stringMatching(/^\/de\/login/))
    })
})
