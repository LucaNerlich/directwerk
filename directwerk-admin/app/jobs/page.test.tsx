import {cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import JobsPage from '@/app/jobs/page'
import {getPlatformJobList} from '@/lib/api/client'

vi.mock('next/navigation', () => ({
    useRouter: () => ({replace: vi.fn()}),
}))

vi.mock('@/lib/api/client', () => ({
    getPlatformJobList: vi.fn(),
}))

const getPlatformJobListMock = vi.mocked(getPlatformJobList)

beforeEach(() => {
    getPlatformJobListMock.mockResolvedValue({
        items: [],
        total: 0,
        offset: 0,
        limit: 20,
    })
})

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

describe('JobsPage', () => {
    it('loads all queues by default and exposes every application queue', async () => {
        render(<JobsPage />)

        const queueSelect = screen.getByRole('combobox', {name: 'Queue'})
        const queueOptions = within(queueSelect)
            .getAllByRole('option')
            .map((option) => ({label: option.textContent, value: option.getAttribute('value')}))

        expect(queueSelect).toHaveValue('')
        expect(queueOptions).toEqual([
            {label: 'All queues', value: ''},
            {label: 'email', value: 'email'},
            {label: 'content-notify', value: 'content-notify'},
            {label: 'stripe-webhook', value: 'stripe-webhook'},
            {label: 'rss-feed-refresh', value: 'rss-feed-refresh'},
            {
                label: 'article-rss-feed-refresh',
                value: 'article-rss-feed-refresh',
            },
            {label: 'remote-asset-ingest', value: 'remote-asset-ingest'},
            {label: 'media-s3-delete', value: 'media-s3-delete'},
            {label: 'media-cdn-purge', value: 'media-cdn-purge'},
            {label: 'media-staging-cleanup', value: 'media-staging-cleanup'},
        ])

        await waitFor(() => {
            expect(getPlatformJobListMock).toHaveBeenCalledWith({
                offset: 0,
                limit: 20,
            })
        })
    })

    it('can filter the list by a non-email queue', async () => {
        render(<JobsPage />)

        fireEvent.change(screen.getByRole('combobox', {name: 'Queue'}), {
            target: {value: 'stripe-webhook'},
        })
        fireEvent.click(screen.getByRole('button', {name: 'Apply filters'}))

        await waitFor(() => {
            expect(getPlatformJobListMock).toHaveBeenLastCalledWith({
                queue: 'stripe-webhook',
                offset: 0,
                limit: 20,
            })
        })
    })
})
