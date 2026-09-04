import {act, renderHook, waitFor} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

import {usePublicationListPage} from '@/lib/publication/usePublicationListPage'
import type {PublicationStatus} from '@directwerk/api/types'

vi.mock('@directwerk/api/auth/useAuthRequired', () => {
    const authRedirect = () => false
    return {useAuthRequired: () => authRedirect}
})

describe('usePublicationListPage', () => {
    it('updates bulk eligibility when an already-loaded episode series becomes published', async () => {
        type TestEpisode = {
            id: number
            title: string
            status: PublicationStatus
            seriesId: number
        }
        const episode: TestEpisode = {
            id: 1,
            title: 'Episode',
            status: 'DRAFT' as const,
            seriesId: 10,
        }
        const load = vi.fn().mockResolvedValue([episode])
        const mutate = vi.fn().mockResolvedValue(episode)
        const labels = {
            loadError: 'load failed',
            publishSuccess: () => 'published',
            unpublishSuccess: () => 'unpublished',
            cancelScheduleSuccess: () => 'schedule cancelled',
            unarchiveSuccess: () => 'unarchived',
            publishError: 'publish failed',
            unpublishError: 'unpublish failed',
            cancelScheduleError: 'cancel failed',
            unarchiveError: 'unarchive failed',
            bulk: {
                publishSuccess: () => 'published',
                unpublishSuccess: () => 'unpublished',
                publishPartial: () => 'partially published',
                unpublishPartial: () => 'partially unpublished',
                publishError: 'publish failed',
                unpublishError: 'unpublish failed',
                noPublishable: 'none to publish',
                noUnpublishable: 'none to unpublish',
            },
        }

        const {result, rerender} = renderHook(
            ({seriesStatus}: {seriesStatus: 'DRAFT' | 'PUBLISHED'}) =>
                usePublicationListPage<TestEpisode>({
                    load,
                    publish: mutate,
                    unpublish: mutate,
                    cancelSchedule: mutate,
                    unarchive: mutate,
                    isBulkPublishEligible: (item) =>
                        item.seriesId === 10 && seriesStatus === 'PUBLISHED',
                    labels,
                }),
            {
                initialProps: {
                    seriesStatus: 'DRAFT',
                } as {seriesStatus: 'DRAFT' | 'PUBLISHED'},
            },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        rerender({seriesStatus: 'PUBLISHED'})
        act(() => result.current.toggleSelectAll())

        await waitFor(() => expect(result.current.selectedIds).toContain(episode.id))
        expect(load).toHaveBeenCalledTimes(1)
    })

    it('retries a failed load and clears the error on success', async () => {
        type TestItem = {id: number; title: string; status: PublicationStatus}
        const item: TestItem = {id: 1, title: 'Beitrag', status: 'DRAFT' as const}
        const load = vi
            .fn()
            .mockRejectedValueOnce(new Error('Netzwerkfehler'))
            .mockResolvedValueOnce([item])
        const mutate = vi.fn().mockResolvedValue(item)
        const labels = {
            loadError: 'load failed',
            publishSuccess: () => 'published',
            unpublishSuccess: () => 'unpublished',
            cancelScheduleSuccess: () => 'schedule cancelled',
            unarchiveSuccess: () => 'unarchived',
            publishError: 'publish failed',
            unpublishError: 'unpublish failed',
            cancelScheduleError: 'cancel failed',
            unarchiveError: 'unarchive failed',
            bulk: {
                publishSuccess: () => 'published',
                unpublishSuccess: () => 'unpublished',
                publishPartial: () => 'partially published',
                unpublishPartial: () => 'partially unpublished',
                publishError: 'publish failed',
                unpublishError: 'unpublish failed',
                noPublishable: 'none to publish',
                noUnpublishable: 'none to unpublish',
            },
        }

        const {result} = renderHook(() =>
            usePublicationListPage<TestItem>({
                load,
                publish: mutate,
                unpublish: mutate,
                cancelSchedule: mutate,
                unarchive: mutate,
                labels,
            }),
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.displayError).toBe('Netzwerkfehler')

        await act(async () => {
            await result.current.reload()
        })

        expect(load).toHaveBeenCalledTimes(2)
        expect(result.current.displayError).toBeNull()
        expect(result.current.items).toEqual([item])
    })
})
