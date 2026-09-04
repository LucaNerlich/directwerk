import {cleanup, render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {afterEach, describe, expect, it, vi} from 'vitest'

import TenantUserActions from '@/components/TenantUserActions'

const changeTenantUserRoleAction = vi.fn()
vi.mock('@/app/tenants/actions', () => ({
    INITIAL_ROLE_CHANGE_STATE: {error: null},
    changeTenantUserRoleAction: (...args: unknown[]) =>
        changeTenantUserRoleAction(...args),
}))

const postPlatformData = vi.fn().mockResolvedValue({})
vi.mock('@/lib/api/client', () => ({
    postPlatformData: (...args: unknown[]) => postPlatformData(...args),
}))

afterEach(cleanup)

describe('TenantUserActions', () => {
    it('submits a role change through the server action', async () => {
        const user = userEvent.setup()
        const onChanged = vi.fn()
        changeTenantUserRoleAction.mockResolvedValue({error: null})
        render(
            <TenantUserActions
                onChanged={onChanged}
                tenantId="1"
                user={{
                    userId: 2,
                    email: 'editor@example.com',
                    name: null,
                    roles: ['EDITOR'],
                    status: 'ACTIVE',
                    invitedAt: '2026-01-01T00:00:00Z',
                    lastLoginAt: '2026-01-02T00:00:00Z',
                }}
            />,
        )

        await user.selectOptions(screen.getByRole('combobox', {name: 'Role for editor@example.com'}), 'TENANT_ADMIN')
        await user.click(screen.getByRole('button', {name: /Change role/}))

        await waitFor(() => expect(changeTenantUserRoleAction).toHaveBeenCalled())
        expect(changeTenantUserRoleAction.mock.calls[0][0]).toBe('1')
        expect(changeTenantUserRoleAction.mock.calls[0][1]).toBe(2)
        const formData = changeTenantUserRoleAction.mock.calls[0][3] as FormData
        expect(formData.get('role')).toBe('TENANT_ADMIN')

        await waitFor(() => expect(onChanged).toHaveBeenCalled())
    })

    it('deactivates an active user', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true)
        const user = userEvent.setup()
        const onChanged = vi.fn()
        render(
            <TenantUserActions
                onChanged={onChanged}
                tenantId="1"
                user={{
                    userId: 2,
                    email: 'editor@example.com',
                    name: null,
                    roles: ['EDITOR'],
                    status: 'ACTIVE',
                    invitedAt: '2026-01-01T00:00:00Z',
                    lastLoginAt: '2026-01-02T00:00:00Z',
                }}
            />,
        )

        await user.click(screen.getByRole('button', {name: 'Deactivate'}))

        await waitFor(() =>
            expect(postPlatformData).toHaveBeenCalledWith('tenants/1/users/2/deactivate', {}),
        )
        expect(onChanged).toHaveBeenCalled()
    })
})
