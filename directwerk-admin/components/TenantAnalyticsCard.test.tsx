import {act, cleanup, render, screen, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import TenantAnalyticsCard from './TenantAnalyticsCard'
import {getPlatformData} from '@/lib/api/client'

vi.mock('@/lib/api/client', () => ({
    getPlatformData: vi.fn(),
}))

const getPlatformDataMock = vi.mocked(getPlatformData)

function deferred<T>(): {
    promise: Promise<T>
    resolve: (value: T) => void
    reject: (reason?: unknown) => void
} {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((promiseResolve, promiseReject) => {
        resolve = promiseResolve
        reject = promiseReject
    })
    return {promise, resolve, reject}
}

describe('TenantAnalyticsCard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        cleanup()
    })

    it('resets loading and clears errors when switching tenants', async () => {
        type Branding = {
            umamiWebsiteId: string | null
            umamiHostUrl: string | null
        }
        const firstBranding = deferred<Branding>()
        const failedBranding = deferred<Branding>()
        const nextBranding = deferred<Branding>()
        getPlatformDataMock
            .mockReturnValueOnce(firstBranding.promise)
            .mockReturnValueOnce(failedBranding.promise)
            .mockReturnValueOnce(nextBranding.promise)

        const {rerender} = render(<TenantAnalyticsCard tenantId="tenant-a" />)

        await act(async () => {
            firstBranding.resolve({
                umamiWebsiteId: 'website-a',
                umamiHostUrl: null,
            })
        })
        expect(await screen.findByText('website-a')).toBeInTheDocument()

        rerender(<TenantAnalyticsCard tenantId="tenant-b" />)

        expect(screen.getByText('Loading…')).toBeInTheDocument()
        expect(screen.queryByText('website-a')).not.toBeInTheDocument()

        await act(async () => {
            failedBranding.reject(new Error('unavailable'))
        })
        expect(await screen.findByText('Analytics config unavailable.')).toBeInTheDocument()

        rerender(<TenantAnalyticsCard tenantId="tenant-c" />)

        expect(screen.getByText('Loading…')).toBeInTheDocument()
        expect(screen.queryByText('Analytics config unavailable.')).not.toBeInTheDocument()

        await act(async () => {
            nextBranding.resolve({
                umamiWebsiteId: 'website-123',
                umamiHostUrl: 'https://umami.example.test',
            })
        })

        await waitFor(() => {
            expect(screen.getByText('website-123')).toBeInTheDocument()
        })
        expect(screen.queryByText('Analytics config unavailable.')).not.toBeInTheDocument()
        expect(getPlatformDataMock).toHaveBeenNthCalledWith(3, 'tenants/tenant-c/branding')
    })

    it('retries loading the branding after a failure', async () => {
        getPlatformDataMock
            .mockRejectedValueOnce(new Error('unavailable'))
            .mockResolvedValueOnce({
                umamiWebsiteId: 'website-123',
                umamiHostUrl: null,
            })

        render(<TenantAnalyticsCard tenantId="tenant-a" />)

        expect(
            await screen.findByText('Analytics config unavailable.')
        ).toBeInTheDocument()

        await act(async () => {
            screen.getByRole('button', {name: 'Retry'}).click()
        })

        await waitFor(() => {
            expect(screen.getByText('website-123')).toBeInTheDocument()
        })
        expect(
            screen.queryByText('Analytics config unavailable.')
        ).not.toBeInTheDocument()
        expect(getPlatformDataMock).toHaveBeenCalledTimes(2)
    })
})
