'use client'

import {useCallback, useState} from 'react'

import type {PublicationStatus} from '@directwerk/api/types'

export interface PublicationBulkActionLabels {
    publishSuccess: (count: number) => string
    unpublishSuccess: (count: number) => string
    deleteSuccess: (count: number) => string
    publishError: string
    unpublishError: string
    deleteError: string
    noPublishable: string
    noUnpublishable: string
}

export function usePublicationBulkActions<T extends {
    id: number
    title: string
    status: PublicationStatus
}>({
    items,
    selectedIds,
    publishMany,
    unpublishMany,
    removeMany,
    setItems,
    clearSelection,
    labels,
    authRedirect,
}: {
    items: T[]
    selectedIds: Set<number>
    publishMany: (ids: number[]) => Promise<T[]>
    unpublishMany: (ids: number[]) => Promise<T[]>
    removeMany?: (ids: number[]) => Promise<number[]>
    setItems: React.Dispatch<React.SetStateAction<T[]>>
    clearSelection: () => void
    labels: PublicationBulkActionLabels
    authRedirect: (error: unknown) => boolean
}) {
    const [isBulkBusy, setIsBulkBusy] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [statusMessage, setStatusMessage] = useState<string | null>(null)

    const selectedItems = items.filter((item) => selectedIds.has(item.id))
    const publishableCount = selectedItems.filter((item) => item.status === 'DRAFT').length
    const unpublishableCount = selectedItems.filter((item) => item.status === 'PUBLISHED').length

    const runBulkAction = useCallback(
        async (
            eligible: T[],
            action: (id: number) => Promise<T>,
            successMessage: (count: number) => string,
            partialMessage: (successCount: number, failureCount: number) => string,
            errorMessageText: string,
        ) => {
            if (eligible.length === 0) {
                return
            }

            setIsBulkBusy(true)
            setErrorMessage(null)
            setStatusMessage(null)

            try {
                const updates = new Map<number, T>()
                let successCount = 0
                let failureCount = 0
                let lastError: string | null = null

                for (const item of eligible) {
                    try {
                        const updated = await action(item.id)
                        updates.set(item.id, updated)
                        successCount += 1
                    } catch (error) {
                        if (authRedirect(error)) {
                            return
                        }
                        failureCount += 1
                        lastError =
                            error instanceof Error ? error.message : errorMessageText
                    }
                }

                if (updates.size > 0) {
                    setItems((current) =>
                        current.map((entry) => updates.get(entry.id) ?? entry),
                    )
                }

                if (successCount > 0 && failureCount === 0) {
                    setStatusMessage(successMessage(successCount))
                    clearSelection()
                } else if (successCount > 0 && failureCount > 0) {
                    setStatusMessage(partialMessage(successCount, failureCount))
                } else if (lastError !== null) {
                    setErrorMessage(lastError)
                }
            } finally {
                setIsBulkBusy(false)
            }
        },
        [authRedirect, clearSelection, setItems],
    )

    const runBulkRequest = useCallback(
        async (
            ids: number[],
            request: (ids: number[]) => Promise<T[]>,
            successMessage: (count: number) => string,
            errorMessageText: string,
        ) => {
            setIsBulkBusy(true)
            setErrorMessage(null)
            setStatusMessage(null)

            try {
                const updated = await request(ids)
                const updates = new Map(updated.map((item) => [item.id, item] as const))
                setItems((current) =>
                    current.map((entry) => updates.get(entry.id) ?? entry),
                )
                setStatusMessage(successMessage(updated.length))
                clearSelection()
            } catch (error) {
                if (authRedirect(error)) {
                    return
                }
                setErrorMessage(
                    error instanceof Error ? error.message : errorMessageText,
                )
            } finally {
                setIsBulkBusy(false)
            }
        },
        [authRedirect, clearSelection, setItems],
    )

    const handleBulkPublish = useCallback(async () => {
        const eligible = selectedItems.filter((item) => item.status === 'DRAFT')
        if (eligible.length === 0) {
            setErrorMessage(labels.noPublishable)
            return
        }
        await runBulkRequest(
            eligible.map((item) => item.id),
            publishMany,
            labels.publishSuccess,
            labels.publishError,
        )
    }, [labels, publishMany, runBulkRequest, selectedItems])

    const handleBulkUnpublish = useCallback(async () => {
        const eligible = selectedItems.filter((item) => item.status === 'PUBLISHED')
        if (eligible.length === 0) {
            setErrorMessage(labels.noUnpublishable)
            return
        }
        await runBulkRequest(
            eligible.map((item) => item.id),
            unpublishMany,
            labels.unpublishSuccess,
            labels.unpublishError,
        )
    }, [labels, runBulkRequest, selectedItems, unpublishMany])

    const handleBulkDelete = useCallback(async () => {
        if (removeMany === undefined || selectedItems.length === 0) {
            return
        }
        setIsBulkBusy(true)
        setErrorMessage(null)
        setStatusMessage(null)

        try {
            const deletedIds = await removeMany(selectedItems.map((item) => item.id))
            const deleted = new Set(deletedIds)
            setItems((current) => current.filter((entry) => !deleted.has(entry.id)))
            setStatusMessage(labels.deleteSuccess(deletedIds.length))
            clearSelection()
        } catch (error) {
            if (authRedirect(error)) {
                return
            }
            setErrorMessage(
                error instanceof Error ? error.message : labels.deleteError,
            )
        } finally {
            setIsBulkBusy(false)
        }
    }, [authRedirect, clearSelection, labels, removeMany, selectedItems, setItems])

    return {
        isBulkBusy,
        bulkErrorMessage: errorMessage,
        bulkStatusMessage: statusMessage,
        publishableCount,
        unpublishableCount,
        runBulkEdit: runBulkAction,
        handleBulkPublish,
        handleBulkUnpublish,
        handleBulkDelete: removeMany === undefined ? null : handleBulkDelete,
    }
}
