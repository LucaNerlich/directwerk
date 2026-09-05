import {act, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

const {navigation, replace, ensureAuthenticated} = vi.hoisted(() => ({
    navigation: {pathname: '/'},
    replace: vi.fn(),
    ensureAuthenticated: vi.fn(),
}))

vi.mock('next/navigation', () => ({
    usePathname: () => navigation.pathname,
    useRouter: () => ({replace}),
}))
vi.mock('@/lib/auth/session', () => ({ensureAuthenticated}))
vi.mock('@/lib/auth/tokenStore', () => ({getAccessToken: () => 'token'}))

import AuthBootstrap from './AuthBootstrap'

afterEach(() => {
    navigation.pathname = '/'
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
            <AuthBootstrap><p>Page shell</p></AuthBootstrap>,
        )
        expect(screen.getByText('Page shell')).toBeInTheDocument()

        navigation.pathname = '/account'
        rerender(<AuthBootstrap><p>Page shell</p></AuthBootstrap>)

        expect(screen.getByText('Wird geladen…')).toBeInTheDocument()
        expect(screen.queryByText('Page shell')).not.toBeInTheDocument()

        await act(async () => finishAuthentication())
        expect(await screen.findByText('Page shell')).toBeInTheDocument()
    })
})
