import {cleanup, render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {afterEach, describe, expect, it, vi} from 'vitest'

import TenantEditForm from '@/components/TenantEditForm'

const updateTenantAction = vi.fn()
vi.mock('@/app/tenants/actions', () => ({
    INITIAL_TENANT_EDIT_STATE: {error: null, success: null, tenant: null},
    updateTenantAction: (...args: unknown[]) => updateTenantAction(...args),
}))

const UPDATED_TENANT = {id: 1, slug: 'renamed-slug', name: 'Renamed', status: 'ACTIVE'}

describe('TenantEditForm', () => {
    afterEach(() => {
        cleanup()
        vi.clearAllMocks()
    })
    it('submits name/slug changes to the server action and reports success', async () => {
        const user = userEvent.setup()
        const onUpdated = vi.fn()
        updateTenantAction.mockResolvedValue({
            error: null,
            success: 'Tenant updated.',
            tenant: UPDATED_TENANT,
        })
        render(
            <TenantEditForm
                onUpdated={onUpdated}
                tenant={{
                    id: 1,
                    slug: 'original-slug',
                    name: 'Original',
                    status: 'ACTIVE',
                    createdAt: '2026-01-01T00:00:00Z',
                    primaryDomain: 'original.example.com',
                    domains: [],
                }}
                tenantId="1"
            />,
        )

        await user.clear(screen.getByLabelText('Name'))
        await user.type(screen.getByLabelText('Name'), 'Renamed')
        await user.clear(screen.getByLabelText('Slug'))
        await user.click(screen.getByRole('button', {name: /Save changes/}))

        await waitFor(() => expect(updateTenantAction).toHaveBeenCalled())
        expect(updateTenantAction.mock.calls[0][0]).toBe('1')
        const formData = updateTenantAction.mock.calls[0][2] as FormData
        expect(formData.get('name')).toBe('Renamed')

        await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(UPDATED_TENANT))
        expect(screen.getByRole('status')).toHaveTextContent('Tenant updated.')
    })

    it('renders errors returned by the server action', async () => {
        const user = userEvent.setup()
        const onUpdated = vi.fn()
        updateTenantAction.mockResolvedValue({
            error: 'Slug must be lowercase letters, numbers, and hyphens.',
            success: null,
            tenant: null,
        })
        render(
            <TenantEditForm
                onUpdated={onUpdated}
                tenant={{
                    id: 1,
                    slug: 'original-slug',
                    name: 'Original',
                    status: 'ACTIVE',
                    createdAt: '2026-01-01T00:00:00Z',
                    primaryDomain: 'original.example.com',
                    domains: [],
                }}
                tenantId="1"
            />,
        )

        await user.clear(screen.getByLabelText('Slug'))
        await user.type(screen.getByLabelText('Slug'), 'Invalid-Slug')
        await user.click(screen.getByRole('button', {name: /Save changes/}))

        await waitFor(() =>
            expect(screen.getByRole('alert')).toHaveTextContent(
                'Slug must be lowercase letters, numbers, and hyphens.'
            )
        )
        expect(onUpdated).not.toHaveBeenCalled()
    })
})
