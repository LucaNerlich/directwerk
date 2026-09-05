import {afterEach, describe, expect, it, vi} from 'vitest'

import {invitePlatformAdminAction} from './actions'
import {INITIAL_INVITE_PLATFORM_ADMIN_STATE} from './actionState'

vi.mock('@/lib/server/platform', () => ({
    callPlatformApi: vi.fn(),
    statusToFormError: vi.fn(),
}))

import {callPlatformApi} from '@/lib/server/platform'

afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
})

describe('platform-admin server actions', () => {
    it('does not return invite tokens in production', async () => {
        vi.stubEnv('NODE_ENV', 'production')
        vi.mocked(callPlatformApi).mockResolvedValue({
            ok: true,
            data: {email: 'admin@example.com', inviteToken: 'secret-admin-token'},
        })
        const formData = new FormData()
        formData.set('email', 'admin@example.com')
        formData.set('name', 'Admin')

        const result = await invitePlatformAdminAction(
            INITIAL_INVITE_PLATFORM_ADMIN_STATE,
            formData,
        )

        expect(result.inviteToken).toBeNull()
    })
})
