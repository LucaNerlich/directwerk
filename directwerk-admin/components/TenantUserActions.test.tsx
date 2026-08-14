import {cleanup, render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {afterEach, describe, expect, it, vi} from 'vitest'

import TenantUserActions from '@/components/TenantUserActions'

const patchPlatformData = vi.fn().mockResolvedValue({})
const postPlatformData = vi.fn().mockResolvedValue({})
vi.mock('@/lib/api/client', () => ({
    patchPlatformData: (...args: unknown[]) => patchPlatformData(...args),
    postPlatformData: (...args: unknown[]) => postPlatformData(...args),
}))

afterEach(cleanup)

describe('TenantUserActions', () => {
    it('submits a role change', async () => {
        const user = userEvent.setup()
        const onChanged = vi.fn()
        render(
            <TenantUserActions
                onChanged={onChanged}
                tenantId="1"
                user={{userId: 2, email: 'editor@example.com', name: null, roles: ['EDITOR'], status: 'ACTIVE'}}
            />,
        )

        await user.selectOptions(screen.getByRole('combobox'), 'TENANT_ADMIN')
        await user.click(screen.getByRole('button', {name: /Change role/}))

        await waitFor(() =>
            expect(patchPlatformData).toHaveBeenCalledWith('tenants/1/users/2', {role: 'TENANT_ADMIN'}),
        )
        expect(onChanged).toHaveBeenCalled()
    })

    it('deactivates an active user', async () => {
        const user = userEvent.setup()
        const onChanged = vi.fn()
        render(
            <TenantUserActions
                onChanged={onChanged}
                tenantId="1"
                user={{userId: 2, email: 'editor@example.com', name: null, roles: ['EDITOR'], status: 'ACTIVE'}}
            />,
        )

        await user.click(screen.getByRole('button', {name: 'Deactivate'}))

        await waitFor(() =>
            expect(postPlatformData).toHaveBeenCalledWith('tenants/1/users/2/deactivate', {}),
        )
        expect(onChanged).toHaveBeenCalled()
    })
})
