import {cleanup, render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {afterEach, describe, expect, it, vi} from 'vitest'

import TenantEditForm from '@/components/TenantEditForm'

const patchPlatformData = vi.fn().mockResolvedValue({
    id: 1, slug: 'renamed-slug', name: 'Renamed', status: 'ACTIVE',
})
vi.mock('@/lib/api/client', () => ({
    patchPlatformData: (...args: unknown[]) => patchPlatformData(...args),
}))

describe('TenantEditForm', () => {
    afterEach(() => {
        cleanup()
        vi.clearAllMocks()
    })
    it('submits name/slug changes and reports success', async () => {
        const user = userEvent.setup()
        const onUpdated = vi.fn()
        render(
            <TenantEditForm
                onUpdated={onUpdated}
                tenant={{id: 1, slug: 'original-slug', name: 'Original', status: 'ACTIVE'}}
                tenantId="1"
            />,
        )

        await user.clear(screen.getByLabelText('Name'))
        await user.type(screen.getByLabelText('Name'), 'Renamed')
        await user.clear(screen.getByLabelText('Slug'))
        await user.click(screen.getByRole('button', {name: /Save changes/}))

        await waitFor(() =>
            expect(patchPlatformData).toHaveBeenCalledWith('tenants/1', {
                name: 'Renamed',
                slug: undefined,
            }),
        )
        await waitFor(() => expect(onUpdated).toHaveBeenCalledWith({
            id: 1, slug: 'renamed-slug', name: 'Renamed', status: 'ACTIVE',
        }))
        expect(screen.getByRole('status')).toHaveTextContent('Tenant updated.')
    })

    it('rejects an uppercase slug', async () => {
        const user = userEvent.setup()
        const onUpdated = vi.fn()
        render(
            <TenantEditForm
                onUpdated={onUpdated}
                tenant={{id: 1, slug: 'original-slug', name: 'Original', status: 'ACTIVE'}}
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
        expect(patchPlatformData).not.toHaveBeenCalled()
        expect(onUpdated).not.toHaveBeenCalled()
    })
})
