import {cleanup, render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {afterEach, describe, expect, it, vi} from 'vitest'

import DomainForceVerifyForm from '@/components/DomainForceVerifyForm'

const forceVerifyDomainAction = vi.fn()
vi.mock('@/app/tenants/actions', () => ({
    INITIAL_DOMAIN_VERIFY_STATE: {error: null, success: null},
    forceVerifyDomainAction: (...args: unknown[]) =>
        forceVerifyDomainAction(...args),
}))

afterEach(cleanup)

describe('DomainForceVerifyForm', () => {
    it('submits the host to the server action and reports success', async () => {
        const user = userEvent.setup()
        forceVerifyDomainAction.mockResolvedValue({
            error: null,
            success: 'tenant.example.com force-verified.',
        })
        render(<DomainForceVerifyForm tenantId="1" />)

        await user.type(screen.getByLabelText('Host'), 'tenant.example.com')
        await user.click(screen.getByRole('button', {name: /Force verify/}))

        await waitFor(() => expect(forceVerifyDomainAction).toHaveBeenCalled())
        expect(forceVerifyDomainAction.mock.calls[0][0]).toBe('1')
        const formData = forceVerifyDomainAction.mock.calls[0][2] as FormData
        expect(formData.get('host')).toBe('tenant.example.com')

        expect(screen.getByRole('status')).toHaveTextContent(
            'tenant.example.com force-verified.'
        )
    })

    it('renders errors returned by the server action', async () => {
        const user = userEvent.setup()
        forceVerifyDomainAction.mockResolvedValue({
            error: 'Enter a valid domain host.',
            success: null,
        })
        render(<DomainForceVerifyForm tenantId="1" />)

        await user.type(screen.getByLabelText('Host'), '..')
        await user.click(screen.getByRole('button', {name: /Force verify/}))

        await waitFor(() =>
            expect(screen.getByRole('alert')).toHaveTextContent(
                'Enter a valid domain host.'
            ),
        )
    })
})
