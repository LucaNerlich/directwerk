import {cleanup, renderHook, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {useAccountDashboard} from '@/lib/account/useAccountDashboard'

const router = {replace: vi.fn()}
const getAccess = vi.fn()
const getMe = vi.fn()
const getNotificationPreferences = vi.fn()
const getSiteConfig = vi.fn()
const listMySubscriptions = vi.fn()

vi.mock('next/navigation', () => ({useRouter: () => router}))
vi.mock('@/lib/tenant/clientHost', () => ({
    getWebClientTenantHost: () => 'tenant.example',
}))
vi.mock('@/lib/api/client', () => ({
    createPortalSession: vi.fn(),
    getAccess: (...args: unknown[]) => getAccess(...args),
    getMe: (...args: unknown[]) => getMe(...args),
    getNotificationPreferences: (...args: unknown[]) =>
        getNotificationPreferences(...args),
    getSiteConfig: (...args: unknown[]) => getSiteConfig(...args),
    listMySubscriptions: (...args: unknown[]) => listMySubscriptions(...args),
    updateNotificationPreferences: vi.fn(),
}))

beforeEach(() => {
    getMe.mockResolvedValue({
        data: {
            email: 'reader@example.com',
            name: 'Reader',
            roles: ['SUBSCRIBER'],
            tenantId: 1,
        },
    })
    getAccess.mockResolvedValue({
        data: {
            activeLevels: [],
            maxLevelSortOrder: null,
            activePackages: [],
            roles: ['SUBSCRIBER'],
            tenantId: 1,
        },
    })
    getNotificationPreferences.mockResolvedValue({
        emailNotificationsEnabled: true,
        emailNotifyAvailable: true,
    })
    listMySubscriptions.mockResolvedValue([])
})

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

describe('useAccountDashboard', () => {
    it('loads account data when subscription module is enabled', async () => {
        getSiteConfig.mockResolvedValue({
            data: {
                enabledModules: ['PODCAST_RSS', 'ARTICLE_RSS', 'SUBSCRIPTION'],
            },
        })

        const {result} = renderHook(() => useAccountDashboard())

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(listMySubscriptions).toHaveBeenCalledWith('tenant.example')
        expect(result.current.me?.email).toBe('reader@example.com')
        expect(result.current.subscriptions).toEqual([])
        expect(result.current.error).toBeNull()
    })

    it('skips subscriptions without failing when the module is disabled', async () => {
        getSiteConfig.mockResolvedValue({
            data: {
                enabledModules: ['PODCAST_RSS', 'ARTICLE_RSS'],
            },
        })

        const {result} = renderHook(() => useAccountDashboard())

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(listMySubscriptions).not.toHaveBeenCalled()
        expect(result.current.me?.email).toBe('reader@example.com')
        expect(result.current.subscriptions).toEqual([])
        expect(result.current.error).toBeNull()
    })
})
