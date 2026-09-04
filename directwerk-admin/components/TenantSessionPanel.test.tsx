import {cleanup, render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {afterEach, describe, expect, it, vi} from 'vitest'

import TenantSessionPanel from '@/components/TenantSessionPanel'
import {tenantTokenStore} from '@/lib/auth/tenantTokenStore'

const loginTenantSession = vi.fn()

vi.mock('@/lib/auth/tenantSession', () => ({
    loginTenantSession: (...args: unknown[]) => loginTenantSession(...args),
}))

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    tenantTokenStore.clearTokens()
})

describe('TenantSessionPanel', () => {
    it('hydrates without a stored session and signs in', async () => {
        const user = userEvent.setup()
        const onSessionChange = vi.fn()
        loginTenantSession.mockResolvedValue(undefined)

        render(<TenantSessionPanel onSessionChange={onSessionChange} />)

        expect(screen.getByText('No tenant session.')).toBeInTheDocument()

        await user.type(
            screen.getByLabelText('Tenant host'),
            'alpha-a.localhost'
        )
        await user.type(screen.getByLabelText('Email'), 'admin@alpha.test')
        await user.type(screen.getByLabelText('Password'), 'secret')
        await user.click(screen.getByRole('button', {name: 'Sign in to tenant'}))

        await waitFor(() =>
            expect(loginTenantSession).toHaveBeenCalledWith({
                email: 'admin@alpha.test',
                password: 'secret',
                tenantHost: 'alpha-a.localhost',
            })
        )
        expect(
            screen.getByText('Connected as tenant admin on alpha-a.localhost.')
        ).toBeInTheDocument()
        expect(onSessionChange).toHaveBeenCalledTimes(1)
    })

    it('rejects an invalid tenant host without calling the session API', async () => {
        const user = userEvent.setup()
        render(<TenantSessionPanel />)

        await user.type(screen.getByLabelText('Tenant host'), 'not a host!!')
        await user.type(screen.getByLabelText('Email'), 'admin@alpha.test')
        await user.type(screen.getByLabelText('Password'), 'secret')
        await user.click(screen.getByRole('button', {name: 'Sign in to tenant'}))

        expect(
            screen.getByText('Enter a valid tenant host (e.g. alpha-a.localhost).')
        ).toBeInTheDocument()
        expect(loginTenantSession).not.toHaveBeenCalled()
    })

    it('reflects a session cleared elsewhere via the token store', async () => {
        tenantTokenStore.setTokens(
            {access_token: 'tenant-access', expires_in: 900},
            'alpha-a.localhost'
        )

        render(<TenantSessionPanel />)

        expect(await screen.findByText('alpha-a.localhost')).toBeInTheDocument()

        // Simulate another panel (e.g. products) clearing expired credentials.
        tenantTokenStore.clearTokens()

        await waitFor(() =>
            expect(screen.getByText('No tenant session.')).toBeInTheDocument()
        )
    })
})
