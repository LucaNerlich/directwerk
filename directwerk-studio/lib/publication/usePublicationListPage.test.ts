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
                publishPartial: () => 'partially published',
                unpublishSuccess: () => 'unpublished',
                unpublishPartial: () => 'partially unpublished',
                deleteSuccess: () => 'deleted',
                publishError: 'publish failed',
                unpublishError: 'unpublish failed',
                deleteError: 'delete failed',
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
                    publishMany: (ids) => Promise.resolve({updated: ids.map(() => episode), failures: []}),
                    unpublishMany: (ids) => Promise.resolve({updated: ids.map(() => episode), failures: []}),
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
                publishPartial: () => 'partially published',
                unpublishSuccess: () => 'unpublished',
                unpublishPartial: () => 'partially unpublished',
                deleteSuccess: () => 'deleted',
                publishError: 'publish failed',
                unpublishError: 'unpublish failed',
                deleteError: 'delete failed',
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
                publishMany: (ids) => Promise.resolve({updated: ids.map(() => item), failures: []}),
                unpublishMany: (ids) => Promise.resolve({updated: ids.map(() => item), failures: []}),
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

    it('replaces a row-publish status message with a later bulk-publish message', async () => {
        type TestItem = {id: number; title: string; status: PublicationStatus}
        const draftA: TestItem = {id: 1, title: 'A', status: 'DRAFT'}
        const draftB: TestItem = {id: 2, title: 'B', status: 'DRAFT'}
        const draftC: TestItem = {id: 3, title: 'C', status: 'DRAFT'}
        const publishedA: TestItem = {...draftA, status: 'PUBLISHED'}
        const publishedB: TestItem = {...draftB, status: 'PUBLISHED'}
        const publishedC: TestItem = {...draftC, status: 'PUBLISHED'}

        const load = vi.fn().mockResolvedValue([draftA, draftB, draftC])
        const publish = vi.fn().mockResolvedValue(publishedA)
        const mutate = vi.fn().mockResolvedValue(draftA)
        const publishMany = vi.fn().mockResolvedValue({
            updated: [publishedB, publishedC],
            failures: [],
        })
        const labels = {
            loadError: 'load failed',
            publishSuccess: (title: string) => `${title} published`,
            unpublishSuccess: () => 'unpublished',
            cancelScheduleSuccess: () => 'schedule cancelled',
            unarchiveSuccess: () => 'unarchived',
            publishError: 'publish failed',
            unpublishError: 'unpublish failed',
            cancelScheduleError: 'cancel failed',
            unarchiveError: 'unarchive failed',
            bulk: {
                publishSuccess: (count: number) => `${count} bulk published`,
                publishPartial: () => 'partially published',
                unpublishSuccess: () => 'unpublished',
                unpublishPartial: () => 'partially unpublished',
                deleteSuccess: () => 'deleted',
                publishError: 'publish failed',
                unpublishError: 'unpublish failed',
                deleteError: 'delete failed',
                noPublishable: 'none to publish',
                noUnpublishable: 'none to unpublish',
            },
        }

        const {result} = renderHook(() =>
            usePublicationListPage<TestItem>({
                load,
                publish,
                unpublish: mutate,
                cancelSchedule: mutate,
                unarchive: mutate,
                publishMany,
                unpublishMany: (ids) =>
                    Promise.resolve({updated: ids.map((id) => ({id, title: String(id), status: 'DRAFT'})), failures: []}),
                labels,
            }),
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        await act(async () => {
            await result.current.handlePublish(draftA)
        })
        expect(result.current.statusMessage).toBe('A published')

        act(() => {
            result.current.toggleSelection(draftB.id)
            result.current.toggleSelection(draftC.id)
        })

        await act(async () => {
            await result.current.handleBulkPublish()
        })

        expect(publishMany).toHaveBeenCalledWith([2, 3])
        expect(result.current.statusMessage).toBe('2 bulk published')
        expect(result.current.displayError).toBeNull()
    })

    it('clears action errors when a new action starts', async () => {
        type TestItem = {id: number; title: string; status: PublicationStatus}
        const draftA: TestItem = {id: 1, title: 'A', status: 'DRAFT'}
        const draftB: TestItem = {id: 2, title: 'B', status: 'DRAFT'}
        const publishedB: TestItem = {...draftB, status: 'PUBLISHED'}

        const load = vi.fn().mockResolvedValue([draftA, draftB])
        const publish = vi
            .fn()
            .mockRejectedValueOnce(new Error('row boom'))
            .mockResolvedValue(publishedB)
        const mutate = vi.fn().mockResolvedValue(draftA)
        const labels = {
            loadError: 'load failed',
            publishSuccess: (title: string) => `${title} published`,
            unpublishSuccess: () => 'unpublished',
            cancelScheduleSuccess: () => 'schedule cancelled',
            unarchiveSuccess: () => 'unarchived',
            publishError: 'publish failed',
            unpublishError: 'unpublish failed',
            cancelScheduleError: 'cancel failed',
            unarchiveError: 'unarchive failed',
            bulk: {
                publishSuccess: (count: number) => `${count} bulk published`,
                publishPartial: () => 'partially published',
                unpublishSuccess: () => 'unpublished',
                unpublishPartial: () => 'partially unpublished',
                deleteSuccess: () => 'deleted',
                publishError: 'publish failed',
                unpublishError: 'unpublish failed',
                deleteError: 'delete failed',
                noPublishable: 'none to publish',
                noUnpublishable: 'none to unpublish',
            },
        }

        const {result} = renderHook(() =>
            usePublicationListPage<TestItem>({
                load,
                publish,
                unpublish: mutate,
                cancelSchedule: mutate,
                unarchive: mutate,
                publishMany: (ids) =>
                    Promise.resolve({
                        updated: ids.map((id) => ({id, title: String(id), status: 'PUBLISHED' as const})),
                        failures: [],
                    }),
                unpublishMany: vi.fn(),
                labels,
            }),
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        await act(async () => {
            await result.current.handlePublish(draftA)
        })
        expect(result.current.displayError).toBe('row boom')

        act(() => {
            result.current.toggleSelection(draftB.id)
        })

        await act(async () => {
            await result.current.handleBulkPublish()
        })

        expect(result.current.displayError).toBeNull()
        expect(result.current.statusMessage).toBe('1 bulk published')
    })

    it('ignores a late row-action completion after a newer bulk message', async () => {
        type TestItem = {id: number; title: string; status: PublicationStatus}
        const draftA: TestItem = {id: 1, title: 'A', status: 'DRAFT'}
        const draftB: TestItem = {id: 2, title: 'B', status: 'DRAFT'}
        const publishedA: TestItem = {...draftA, status: 'PUBLISHED'}
        const publishedB: TestItem = {...draftB, status: 'PUBLISHED'}

        let resolveRow: ((value: TestItem) => void) | undefined
        const publish = vi.fn().mockImplementation(
            () =>
                new Promise<TestItem>((resolve) => {
                    resolveRow = resolve
                }),
        )
        const publishMany = vi.fn().mockResolvedValue({
            updated: [publishedB],
            failures: [],
        })
        const mutate = vi.fn().mockResolvedValue(draftA)
        const load = vi.fn().mockResolvedValue([draftA, draftB])
        const labels = {
            loadError: 'load failed',
            publishSuccess: (title: string) => `${title} published`,
            unpublishSuccess: () => 'unpublished',
            cancelScheduleSuccess: () => 'schedule cancelled',
            unarchiveSuccess: () => 'unarchived',
            publishError: 'publish failed',
            unpublishError: 'unpublish failed',
            cancelScheduleError: 'cancel failed',
            unarchiveError: 'unarchive failed',
            bulk: {
                publishSuccess: (count: number) => `${count} bulk published`,
                publishPartial: () => 'partially published',
                unpublishSuccess: () => 'unpublished',
                unpublishPartial: () => 'partially unpublished',
                deleteSuccess: () => 'deleted',
                publishError: 'publish failed',
                unpublishError: 'unpublish failed',
                deleteError: 'delete failed',
                noPublishable: 'none to publish',
                noUnpublishable: 'none to unpublish',
            },
        }

        const {result} = renderHook(() =>
            usePublicationListPage<TestItem>({
                load,
                publish,
                unpublish: mutate,
                cancelSchedule: mutate,
                unarchive: mutate,
                publishMany,
                unpublishMany: vi.fn(),
                labels,
            }),
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        let rowPublish: Promise<void> | undefined
        act(() => {
            rowPublish = result.current.handlePublish(draftA)
        })
        await waitFor(() => expect(publish).toHaveBeenCalled())

        act(() => {
            result.current.toggleSelection(draftB.id)
        })
        await act(async () => {
            await result.current.handleBulkPublish()
        })
        expect(result.current.statusMessage).toBe('1 bulk published')

        await act(async () => {
            resolveRow?.(publishedA)
            await rowPublish
        })

        expect(result.current.statusMessage).toBe('1 bulk published')
        expect(result.current.items.find((item) => item.id === 1)?.status).toBe('PUBLISHED')
    })

    it('preserves action status messages across loadMore', async () => {
        type TestItem = {id: number; title: string; status: PublicationStatus}
        const page = Array.from({length: 100}, (_, index) => ({
            id: index + 1,
            title: `Item ${index + 1}`,
            status: 'DRAFT' as const,
        }))
        const extra: TestItem = {id: 101, title: 'Extra', status: 'DRAFT'}
        const publishedFirst: TestItem = {...page[0]!, status: 'PUBLISHED'}

        const load = vi
            .fn()
            .mockResolvedValueOnce(page)
            .mockResolvedValueOnce([extra])
        const publish = vi.fn().mockResolvedValue(publishedFirst)
        const mutate = vi.fn().mockResolvedValue(page[0]!)
        const labels = {
            loadError: 'load failed',
            publishSuccess: (title: string) => `${title} published`,
            unpublishSuccess: () => 'unpublished',
            cancelScheduleSuccess: () => 'schedule cancelled',
            unarchiveSuccess: () => 'unarchived',
            publishError: 'publish failed',
            unpublishError: 'unpublish failed',
            cancelScheduleError: 'cancel failed',
            unarchiveError: 'unarchive failed',
            bulk: {
                publishSuccess: () => 'published',
                publishPartial: () => 'partially published',
                unpublishSuccess: () => 'unpublished',
                unpublishPartial: () => 'partially unpublished',
                deleteSuccess: () => 'deleted',
                publishError: 'publish failed',
                unpublishError: 'unpublish failed',
                deleteError: 'delete failed',
                noPublishable: 'none to publish',
                noUnpublishable: 'none to unpublish',
            },
        }

        const {result} = renderHook(() =>
            usePublicationListPage<TestItem>({
                load,
                publish,
                unpublish: mutate,
                cancelSchedule: mutate,
                unarchive: mutate,
                publishMany: vi.fn(),
                unpublishMany: vi.fn(),
                labels,
            }),
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.hasMore).toBe(true)

        await act(async () => {
            await result.current.handlePublish(page[0]!)
        })
        expect(result.current.statusMessage).toBe('Item 1 published')

        await act(async () => {
            await result.current.loadMore()
        })

        expect(result.current.statusMessage).toBe('Item 1 published')
        expect(result.current.items).toHaveLength(101)
        expect(load).toHaveBeenLastCalledWith({limit: 100, offset: 100})
    })
})
