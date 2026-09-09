import {act, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

const {navigation, replace, ensureAuthenticated, getAccessToken} = vi.hoisted(() => ({
    navigation: {pathname: '/'},
    replace: vi.fn(),
    ensureAuthenticated: vi.fn(),
    getAccessToken: vi.fn(() => null as string | null),
}))

vi.mock('next/navigation', () => ({
    usePathname: () => navigation.pathname,
    useRouter: () => ({replace}),
}))
vi.mock('@/lib/auth/session', () => ({ensureAuthenticated}))
vi.mock('@/lib/auth/tokenStore', () => ({getAccessToken}))

import AuthBootstrap from './AuthBootstrap'

afterEach(() => {
    navigation.pathname = '/'
    replace.mockReset()
    ensureAuthenticated.mockReset()
    getAccessToken.mockReset()
    getAccessToken.mockReturnValue(null)
})

describe('AuthBootstrap', () => {
    it('allows imprint without authentication', async () => {
        navigation.pathname = '/imprint'
        render(
            <AuthBootstrap>
                <p>Imprint page</p>
            </AuthBootstrap>,
        )

        expect(screen.getByText('Imprint page')).toBeInTheDocument()
        await act(async () => {
            await Promise.resolve()
        })
        expect(replace).not.toHaveBeenCalled()
        expect(ensureAuthenticated).not.toHaveBeenCalled()
    })

    it('allows privacy without authentication', async () => {
        navigation.pathname = '/privacy'
        render(
            <AuthBootstrap>
                <p>Privacy page</p>
            </AuthBootstrap>,
        )

        expect(screen.getByText('Privacy page')).toBeInTheDocument()
        await act(async () => {
            await Promise.resolve()
        })
        expect(replace).not.toHaveBeenCalled()
        expect(ensureAuthenticated).not.toHaveBeenCalled()
    })

    it('redirects protected paths when unauthenticated', async () => {
        navigation.pathname = '/tenants'
        ensureAuthenticated.mockRejectedValue(new Error('AUTH_REQUIRED'))
        render(
            <AuthBootstrap>
                <p>Tenants</p>
            </AuthBootstrap>,
        )

        await act(async () => {
            await Promise.resolve()
        })
        expect(replace).toHaveBeenCalledWith('/login')
    })
})
