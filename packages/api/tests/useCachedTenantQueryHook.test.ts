// @vitest-environment jsdom

import {cleanup, renderHook, waitFor} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

import {
    clearAllCachedTenantData,
    useCachedTenantQuery,
} from '../src/client/useCachedTenantQuery'

vi.mock('../src/auth/useAuthRequired', () => {
    const authRedirect = () => false
    return {useAuthRequired: () => authRedirect}
})

afterEach(() => {
    cleanup()
    clearAllCachedTenantData()
})

describe('useCachedTenantQuery option forwarding', () => {
    // #335: the hook declared the full option set but only forwarded fallbackError, so
    // `enabled: false` still issued the request and mapError was discarded.
    it('honours enabled: false instead of fetching', async () => {
        const fetcher = vi.fn(async () => ['item'])

        const {result} = renderHook(() => useCachedTenantQuery(fetcher, {
            namespace: 'enabled-flag',
            tenantHost: 'tenant.test',
            enabled: false,
        }))

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(fetcher).not.toHaveBeenCalled()
    })

    it('forwards mapError', async () => {
        const fetcher = vi.fn(async () => {
            throw new Error('internal detail')
        })

        const {result} = renderHook(() => useCachedTenantQuery(fetcher, {
            namespace: 'map-error',
            tenantHost: 'tenant.test',
            fallbackError: 'Public fallback',
            mapError: () => null,
        }))

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.error).toBe('Public fallback')
    })
})
