import {cleanup, render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import RevokeAdminButton from '@/components/RevokeAdminButton'

const deletePlatformData = vi.fn().mockResolvedValue({})
vi.mock('@/lib/api/client', () => ({
    deletePlatformData: (...args: unknown[]) => deletePlatformData(...args),
}))

afterEach(() => {
    cleanup()
})

beforeEach(() => {
    deletePlatformData.mockClear()
})

describe('RevokeAdminButton', () => {
    it('revokes the admin and calls onRevoked', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
        const user = userEvent.setup()
        const onRevoked = vi.fn()
        render(<RevokeAdminButton onRevoked={onRevoked} userId={2} />)

        await user.click(screen.getByRole('button', {name: /Revoke/}))

        await waitFor(() => expect(deletePlatformData).toHaveBeenCalledWith('admins/2'))
        expect(onRevoked).toHaveBeenCalled()
        expect(confirmSpy).toHaveBeenCalled()
    })

    it('does not revoke when the confirmation is dismissed', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(false)
        const user = userEvent.setup()
        const onRevoked = vi.fn()
        render(<RevokeAdminButton onRevoked={onRevoked} userId={2} />)

        await user.click(screen.getByRole('button', {name: /Revoke/}))

        expect(deletePlatformData).not.toHaveBeenCalled()
        expect(onRevoked).not.toHaveBeenCalled()
    })
})
