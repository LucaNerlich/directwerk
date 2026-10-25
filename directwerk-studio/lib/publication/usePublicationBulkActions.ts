'use client'

import {useCallback, useState, type Dispatch, type SetStateAction} from 'react'

import type {PublicationStatus} from '@directwerk/api/types'

export interface PublicationBulkActionLabels {
    publishSuccess: (count: number) => string
    publishPartial: (successCount: number, failureCount: number) => string
    unpublishSuccess: (count: number) => string
    unpublishPartial: (successCount: number, failureCount: number) => string
    deleteSuccess: (count: number) => string
    publishError: string
    unpublishError: string
    deleteError: string
    noPublishable: string
    noUnpublishable: string
}

export interface PublicationBulkSettledResult<T> {
    updated: T[]
    failures: Array<{id: number; reason: unknown}>
}

/**
 * Wraps an atomic bulk endpoint (which returns every updated row or throws) in the
 * one settled shape the hook speaks. Endpoints that can partially fail already
 * return this shape.
 */
export async function settledBulkResult<T>(
    request: Promise<T[]>,
): Promise<PublicationBulkSettledResult<T>> {
    const updated = await request
    return {updated, failures: []}
}

export async function runSequentialPublicationBulkAction<T>(
    ids: number[],
    action: (id: number) => Promise<T>,
): Promise<PublicationBulkSettledResult<T>> {
    const updated: T[] = []
    const failures: PublicationBulkSettledResult<T>['failures'] = []

    for (const id of ids) {
        try {
            updated.push(await action(id))
        } catch (reason) {
            failures.push({id, reason})
        }
    }

    return {updated, failures}
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
    retainSelection,
    labels,
    authRedirect,
    errorMessage,
    setErrorMessage,
    statusMessage,
    setStatusMessage,
}: {
    items: T[]
    selectedIds: Set<number>
    publishMany: (ids: number[]) => Promise<PublicationBulkSettledResult<T>>
    unpublishMany: (ids: number[]) => Promise<PublicationBulkSettledResult<T>>
    removeMany?: (ids: number[]) => Promise<number[]>
    setItems: Dispatch<SetStateAction<T[]>>
    clearSelection: () => void
    retainSelection?: (ids: number[]) => void
    labels: PublicationBulkActionLabels
    authRedirect: (error: unknown) => boolean
    errorMessage: string | null
    setErrorMessage: Dispatch<SetStateAction<string | null>>
    statusMessage: string | null
    setStatusMessage: Dispatch<SetStateAction<string | null>>
}) {
    const [isBulkBusy, setIsBulkBusy] = useState(false)

    const clearActionMessages = useCallback(() => {
        setErrorMessage(null)
        setStatusMessage(null)
    }, [setErrorMessage, setStatusMessage])

    const setActionError = useCallback(
        (message: string) => {
            setStatusMessage(null)
            setErrorMessage(message)
        },
        [setErrorMessage, setStatusMessage],
    )

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
            clearActionMessages()

            try {
                const updates = new Map<number, T>()
                let successCount = 0
                let failureCount = 0
                let lastError: string | null = null
                const failedIds: number[] = []

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
                        failedIds.push(item.id)
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
                    // Issue #429: mirror the parallel path, which narrows the selection to the
                    // failures so the user does not have to re-find which rows failed.
                    retainSelection?.(failedIds)
                    setStatusMessage(partialMessage(successCount, failureCount))
                } else if (lastError !== null) {
                    setActionError(lastError)
                }
            } finally {
                setIsBulkBusy(false)
            }
        },
        [
            authRedirect,
            clearActionMessages,
            clearSelection,
            retainSelection,
            setActionError,
            setItems,
            setStatusMessage,
        ],
    )

    const runBulkRequest = useCallback(
        async (
            ids: number[],
            request: (ids: number[]) => Promise<PublicationBulkSettledResult<T>>,
            successMessage: (count: number) => string,
            partialMessage: (successCount: number, failureCount: number) => string,
            errorMessageText: string,
        ) => {
            setIsBulkBusy(true)
            clearActionMessages()

            try {
                const {updated, failures} = await request(ids)
                const updates = new Map(updated.map((item) => [item.id, item] as const))
                if (updates.size > 0) {
                    setItems((current) =>
                        current.map((entry) => updates.get(entry.id) ?? entry),
                    )
                }
                if (failures.length > 0) {
                    retainSelection?.(failures.map(({id}) => id))
                }

                if (failures.some(({reason}) => authRedirect(reason))) {
                    return
                }
                if (failures.length === 0) {
                    setStatusMessage(successMessage(updated.length))
                    clearSelection()
                } else if (updated.length > 0) {
                    setStatusMessage(partialMessage(updated.length, failures.length))
                } else {
                    const reason = failures[failures.length - 1]?.reason
                    setActionError(
                        reason instanceof Error ? reason.message : errorMessageText,
                    )
                }
            } catch (error) {
                if (authRedirect(error)) {
                    return
                }
                setActionError(
                    error instanceof Error ? error.message : errorMessageText,
                )
            } finally {
                setIsBulkBusy(false)
            }
        },
        [
            authRedirect,
            clearActionMessages,
            clearSelection,
            retainSelection,
            setActionError,
            setItems,
            setStatusMessage,
        ],
    )

    const handleBulkPublish = useCallback(async () => {
        const eligible = selectedItems.filter((item) => item.status === 'DRAFT')
        if (eligible.length === 0) {
            setActionError(labels.noPublishable)
            return
        }
        await runBulkRequest(
            eligible.map((item) => item.id),
            publishMany,
            labels.publishSuccess,
            labels.publishPartial,
            labels.publishError,
        )
    }, [labels, publishMany, runBulkRequest, selectedItems, setActionError])

    const handleBulkUnpublish = useCallback(async () => {
        const eligible = selectedItems.filter((item) => item.status === 'PUBLISHED')
        if (eligible.length === 0) {
            setActionError(labels.noUnpublishable)
            return
        }
        await runBulkRequest(
            eligible.map((item) => item.id),
            unpublishMany,
            labels.unpublishSuccess,
            labels.unpublishPartial,
            labels.unpublishError,
        )
    }, [labels, runBulkRequest, selectedItems, setActionError, unpublishMany])

    const handleBulkDelete = useCallback(async () => {
        if (removeMany === undefined || selectedItems.length === 0) {
            return
        }
        setIsBulkBusy(true)
        clearActionMessages()

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
            setActionError(
                error instanceof Error ? error.message : labels.deleteError,
            )
        } finally {
            setIsBulkBusy(false)
        }
    }, [
        authRedirect,
        clearActionMessages,
        clearSelection,
        labels,
        removeMany,
        selectedItems,
        setActionError,
        setItems,
        setStatusMessage,
    ])

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
