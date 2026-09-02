import {describe, expect, it, vi} from 'vitest'

import {usePublicationBulkActions} from '@/lib/publication/usePublicationBulkActions'
import type {PublicationStatus} from '@directwerk/api/types'
import {renderHook, act, waitFor} from '@testing-library/react'

describe('usePublicationBulkActions', () => {
    const items = [
        {id: 1, title: 'Draft One', status: 'DRAFT' as const},
        {id: 2, title: 'Published', status: 'PUBLISHED' as const},
        {id: 3, title: 'Draft Two', status: 'DRAFT' as const},
    ]

    it('bulk publishes only draft items from the selection', async () => {
        const publish = vi.fn()
            .mockResolvedValueOnce({id: 1, title: 'Draft One', status: 'PUBLISHED'})
            .mockResolvedValueOnce({id: 3, title: 'Draft Two', status: 'PUBLISHED'})
        const setItems = vi.fn()
        const clearSelection = vi.fn()

        const {result} = renderHook(() =>
            usePublicationBulkActions({
                items,
                selectedIds: new Set([1, 2, 3]),
                publish,
                unpublish: vi.fn(),
                setItems,
                clearSelection,
                labels: {
                    publishSuccess: (count) => `${count} published`,
                    unpublishSuccess: (count) => `${count} unpublished`,
                    publishPartial: (s, f) => `${s} ok, ${f} failed`,
                    unpublishPartial: (s, f) => `${s} ok, ${f} failed`,
                    publishError: 'publish failed',
                    unpublishError: 'unpublish failed',
                    noPublishable: 'none to publish',
                    noUnpublishable: 'none to unpublish',
                },
                authRedirect: () => false,
            }),
        )

        await act(async () => {
            await result.current.handleBulkPublish()
        })

        expect(publish).toHaveBeenCalledTimes(2)
        expect(publish).toHaveBeenCalledWith(1)
        expect(publish).toHaveBeenCalledWith(3)
        expect(clearSelection).toHaveBeenCalled()
    })

    it('bulk unpublishes only published items from the selection', async () => {
        const unpublish = vi.fn().mockResolvedValue({
            id: 2,
            title: 'Published',
            status: 'DRAFT',
        })
        const setItems = vi.fn()
        const clearSelection = vi.fn()

        const {result} = renderHook(() =>
            usePublicationBulkActions({
                items,
                selectedIds: new Set([1, 2]),
                publish: vi.fn(),
                unpublish,
                setItems,
                clearSelection,
                labels: {
                    publishSuccess: (count) => `${count} published`,
                    unpublishSuccess: (count) => `${count} unpublished`,
                    publishPartial: (s, f) => `${s} ok, ${f} failed`,
                    unpublishPartial: (s, f) => `${s} ok, ${f} failed`,
                    publishError: 'publish failed',
                    unpublishError: 'unpublish failed',
                    noPublishable: 'none to publish',
                    noUnpublishable: 'none to unpublish',
                },
                authRedirect: () => false,
            }),
        )

        await act(async () => {
            await result.current.handleBulkUnpublish()
        })

        expect(unpublish).toHaveBeenCalledTimes(1)
        expect(unpublish).toHaveBeenCalledWith(2)
        expect(clearSelection).toHaveBeenCalled()
    })

    it('resets the busy state when authentication redirects during an action', async () => {
        const publish = vi.fn().mockRejectedValue(new Error('unauthorized'))
        const authRedirect = vi.fn().mockReturnValue(true)

        const {result} = renderHook(() =>
            usePublicationBulkActions({
                items,
                selectedIds: new Set([1]),
                publish,
                unpublish: vi.fn(),
                setItems: vi.fn(),
                clearSelection: vi.fn(),
                labels: {
                    publishSuccess: (count) => `${count} published`,
                    unpublishSuccess: (count) => `${count} unpublished`,
                    publishPartial: (s, f) => `${s} ok, ${f} failed`,
                    unpublishPartial: (s, f) => `${s} ok, ${f} failed`,
                    publishError: 'publish failed',
                    unpublishError: 'unpublish failed',
                    noPublishable: 'none to publish',
                    noUnpublishable: 'none to unpublish',
                },
                authRedirect,
            }),
        )

        await act(async () => {
            await result.current.handleBulkPublish()
        })

        expect(authRedirect).toHaveBeenCalledWith(expect.any(Error))
        expect(result.current.isBulkBusy).toBe(false)
    })

    it('runs a generic bulk edit with partial-success messaging', async () => {
        const apply = vi
            .fn<(id: number) => Promise<{id: number; title: string; status: Extract<PublicationStatus, "DRAFT" | "PUBLISHED">}>>()
            .mockResolvedValueOnce({id: 1, title: 'Draft One', status: 'DRAFT'})
            .mockRejectedValueOnce(new Error('boom'))
        const setItems = vi.fn()
        const clearSelection = vi.fn()

        const {result} = renderHook(() =>
            usePublicationBulkActions({
                items,
                selectedIds: new Set([1, 3]),
                publish: vi.fn(),
                unpublish: vi.fn(),
                setItems,
                clearSelection,
                labels: {
                    publishSuccess: (count) => `${count} published`,
                    unpublishSuccess: (count) => `${count} unpublished`,
                    publishPartial: (s, f) => `${s} ok, ${f} failed`,
                    unpublishPartial: (s, f) => `${s} ok, ${f} failed`,
                    publishError: 'publish failed',
                    unpublishError: 'unpublish failed',
                    noPublishable: 'none to publish',
                    noUnpublishable: 'none to unpublish',
                },
                authRedirect: () => false,
            }),
        )

        await act(async () => {
            await result.current.runBulkEdit(
                [items[0], items[2]],
                apply,
                (count) => `${count} aktualisiert`,
                (successCount, failureCount) =>
                    `${successCount} von ${successCount + failureCount} aktualisiert`,
                'aktualisieren fehlgeschlagen',
            )
        })

        expect(apply).toHaveBeenCalledTimes(2)
        expect(apply).toHaveBeenCalledWith(1)
        expect(apply).toHaveBeenCalledWith(3)
        expect(setItems).toHaveBeenCalledWith(expect.any(Function))
        expect(result.current.bulkStatusMessage).toBe('1 von 2 aktualisiert')
        expect(result.current.bulkErrorMessage).toBeNull()
        expect(clearSelection).not.toHaveBeenCalled()
        expect(result.current.isBulkBusy).toBe(false)
    })

    it('clears the selection after a fully successful bulk edit', async () => {
        const apply = vi
            .fn<(id: number) => Promise<{id: number; title: string; status: Extract<PublicationStatus, "DRAFT" | "PUBLISHED">}>>()
            .mockResolvedValue({id: 1, title: 'Draft One', status: 'DRAFT'})
        const setItems = vi.fn()
        const clearSelection = vi.fn()

        const {result} = renderHook(() =>
            usePublicationBulkActions({
                items,
                selectedIds: new Set([1]),
                publish: vi.fn(),
                unpublish: vi.fn(),
                setItems,
                clearSelection,
                labels: {
                    publishSuccess: (count) => `${count} published`,
                    unpublishSuccess: (count) => `${count} unpublished`,
                    publishPartial: (s, f) => `${s} ok, ${f} failed`,
                    unpublishPartial: (s, f) => `${s} ok, ${f} failed`,
                    publishError: 'publish failed',
                    unpublishError: 'unpublish failed',
                    noPublishable: 'none to publish',
                    noUnpublishable: 'none to unpublish',
                },
                authRedirect: () => false,
            }),
        )

        await act(async () => {
            await result.current.runBulkEdit(
                [items[0]],
                apply,
                (count) => `${count} aktualisiert`,
                (successCount, failureCount) =>
                    `${successCount} von ${successCount + failureCount} aktualisiert`,
                'aktualisieren fehlgeschlagen',
            )
        })

        expect(result.current.bulkStatusMessage).toBe('1 aktualisiert')
        expect(clearSelection).toHaveBeenCalled()
    })
})
