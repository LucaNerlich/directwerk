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
    const labels = {
        publishSuccess: (count: number) => `${count} published`,
        unpublishSuccess: (count: number) => `${count} unpublished`,
        deleteSuccess: (count: number) => `${count} deleted`,
        publishError: 'publish failed',
        unpublishError: 'unpublish failed',
        deleteError: 'delete failed',
        noPublishable: 'none to publish',
        noUnpublishable: 'none to unpublish',
    }

    it('bulk publishes drafts with a single request', async () => {
        const publishMany = vi.fn().mockResolvedValue([
            {id: 1, title: 'Draft One', status: 'PUBLISHED'},
            {id: 3, title: 'Draft Two', status: 'PUBLISHED'},
        ])
        const setItems = vi.fn()
        const clearSelection = vi.fn()

        const {result} = renderHook(() =>
            usePublicationBulkActions({
                items,
                selectedIds: new Set([1, 2, 3]),
                publishMany,
                unpublishMany: vi.fn(),
                setItems,
                clearSelection,
                labels,
                authRedirect: () => false,
            }),
        )

        await act(async () => {
            await result.current.handleBulkPublish()
        })

        expect(publishMany).toHaveBeenCalledTimes(1)
        expect(publishMany).toHaveBeenCalledWith([1, 3])
        expect(setItems).toHaveBeenCalledWith(expect.any(Function))
        expect(result.current.bulkStatusMessage).toBe('2 published')
        expect(clearSelection).toHaveBeenCalled()
        expect(result.current.isBulkBusy).toBe(false)
    })

    it('bulk unpublishes published items with a single request', async () => {
        const unpublishMany = vi.fn().mockResolvedValue([
            {id: 2, title: 'Published', status: 'DRAFT'},
        ])
        const setItems = vi.fn()
        const clearSelection = vi.fn()

        const {result} = renderHook(() =>
            usePublicationBulkActions({
                items,
                selectedIds: new Set([1, 2]),
                publishMany: vi.fn(),
                unpublishMany,
                setItems,
                clearSelection,
                labels,
                authRedirect: () => false,
            }),
        )

        await act(async () => {
            await result.current.handleBulkUnpublish()
        })

        expect(unpublishMany).toHaveBeenCalledTimes(1)
        expect(unpublishMany).toHaveBeenCalledWith([2])
        expect(result.current.bulkStatusMessage).toBe('1 unpublished')
        expect(clearSelection).toHaveBeenCalled()
    })

    it('surfaces bulk publish failures without clearing the selection', async () => {
        const publishMany = vi.fn().mockRejectedValue(new Error('boom'))
        const setItems = vi.fn()
        const clearSelection = vi.fn()

        const {result} = renderHook(() =>
            usePublicationBulkActions({
                items,
                selectedIds: new Set([1, 3]),
                publishMany,
                unpublishMany: vi.fn(),
                setItems,
                clearSelection,
                labels,
                authRedirect: () => false,
            }),
        )

        await act(async () => {
            await result.current.handleBulkPublish()
        })

        expect(result.current.bulkErrorMessage).toBe('boom')
        expect(result.current.bulkStatusMessage).toBeNull()
        expect(setItems).not.toHaveBeenCalled()
        expect(clearSelection).not.toHaveBeenCalled()
        expect(result.current.isBulkBusy).toBe(false)
    })

    it('bulk deletes the selection with a single request', async () => {
        const removeMany = vi.fn().mockResolvedValue([1, 2])
        const setItems = vi.fn()
        const clearSelection = vi.fn()

        const {result} = renderHook(() =>
            usePublicationBulkActions({
                items,
                selectedIds: new Set([1, 2]),
                publishMany: vi.fn(),
                unpublishMany: vi.fn(),
                removeMany,
                setItems,
                clearSelection,
                labels,
                authRedirect: () => false,
            }),
        )

        expect(result.current.handleBulkDelete).not.toBeNull()
        await act(async () => {
            await result.current.handleBulkDelete!()
        })

        expect(removeMany).toHaveBeenCalledTimes(1)
        expect(removeMany).toHaveBeenCalledWith([1, 2])
        expect(setItems).toHaveBeenCalledWith(expect.any(Function))
        expect(result.current.bulkStatusMessage).toBe('2 deleted')
        expect(clearSelection).toHaveBeenCalled()
    })

    it('exposes no bulk delete handler without removeMany', () => {
        const {result} = renderHook(() =>
            usePublicationBulkActions({
                items,
                selectedIds: new Set([1]),
                publishMany: vi.fn(),
                unpublishMany: vi.fn(),
                setItems: vi.fn(),
                clearSelection: vi.fn(),
                labels,
                authRedirect: () => false,
            }),
        )

        expect(result.current.handleBulkDelete).toBeNull()
    })

    it('resets the busy state when authentication redirects during an action', async () => {
        const publishMany = vi.fn().mockRejectedValue(new Error('unauthorized'))
        const authRedirect = vi.fn().mockReturnValue(true)

        const {result} = renderHook(() =>
            usePublicationBulkActions({
                items,
                selectedIds: new Set([1]),
                publishMany,
                unpublishMany: vi.fn(),
                setItems: vi.fn(),
                clearSelection: vi.fn(),
                labels,
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
                publishMany: vi.fn(),
                unpublishMany: vi.fn(),
                setItems,
                clearSelection,
                labels,
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
                publishMany: vi.fn(),
                unpublishMany: vi.fn(),
                setItems,
                clearSelection,
                labels,
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
