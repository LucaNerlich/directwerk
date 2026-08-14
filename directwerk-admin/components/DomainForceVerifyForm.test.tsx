import {cleanup, render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {afterEach, describe, expect, it, vi} from 'vitest'

import DomainForceVerifyForm from '@/components/DomainForceVerifyForm'

const postPlatformData = vi.fn().mockResolvedValue({host: 'tenant.example.com', primary: false, verified: true})
vi.mock('@/lib/api/client', () => ({
    postPlatformData: (...args: unknown[]) => postPlatformData(...args),
}))

afterEach(cleanup)

describe('DomainForceVerifyForm', () => {
    it('submits the host and reports success', async () => {
        const user = userEvent.setup()
        render(<DomainForceVerifyForm tenantId="1" />)

        await user.type(screen.getByLabelText('Host'), 'tenant.example.com')
        await user.click(screen.getByRole('button', {name: /Force verify/}))

        await waitFor(() =>
            expect(postPlatformData).toHaveBeenCalledWith(
                'tenants/1/domains/tenant.example.com/verify',
                {},
            ),
        )
        expect(screen.getByRole('status')).toHaveTextContent('tenant.example.com force-verified.')
    })

    it('rejects a ".." host client-side without calling postPlatformData', async () => {
        postPlatformData.mockClear()
        const user = userEvent.setup()
        render(<DomainForceVerifyForm tenantId="1" />)

        await user.type(screen.getByLabelText('Host'), '..')
        await user.click(screen.getByRole('button', {name: /Force verify/}))

        await waitFor(() =>
            expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid domain host.'),
        )
        expect(postPlatformData).not.toHaveBeenCalled()
    })
})
