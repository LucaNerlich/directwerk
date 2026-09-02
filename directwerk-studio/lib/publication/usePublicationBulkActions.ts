'use client'

import {useCallback, useState} from 'react'

import type {PublicationStatus} from '@directwerk/api/types'

export interface PublicationBulkActionLabels {
    publishSuccess: (count: number) => string
    unpublishSuccess: (count: number) => string
    publishPartial: (successCount: number, failureCount: number) => string
    unpublishPartial: (successCount: number, failureCount: number) => string
    publishError: string
    unpublishError: string
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
    publish,
    unpublish,
    setItems,
    clearSelection,
    labels,
    authRedirect,
}: {
    items: T[]
    selectedIds: Set<number>
    publish: (id: number) => Promise<T>
    unpublish: (id: number) => Promise<T>
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

    const handleBulkPublish = useCallback(async () => {
        const eligible = selectedItems.filter((item) => item.status === 'DRAFT')
        if (eligible.length === 0) {
            setErrorMessage(labels.noPublishable)
            return
        }
        await runBulkAction(
            eligible,
            publish,
            labels.publishSuccess,
            labels.publishPartial,
            labels.publishError,
        )
    }, [labels, publish, runBulkAction, selectedItems])

    const handleBulkUnpublish = useCallback(async () => {
        const eligible = selectedItems.filter((item) => item.status === 'PUBLISHED')
        if (eligible.length === 0) {
            setErrorMessage(labels.noUnpublishable)
            return
        }
        await runBulkAction(
            eligible,
            unpublish,
            labels.unpublishSuccess,
            labels.unpublishPartial,
            labels.unpublishError,
        )
    }, [labels, runBulkAction, selectedItems, unpublish])

    return {
        isBulkBusy,
        bulkErrorMessage: errorMessage,
        bulkStatusMessage: statusMessage,
        publishableCount,
        unpublishableCount,
        runBulkEdit: runBulkAction,
        handleBulkPublish,
        handleBulkUnpublish,
    }
}
