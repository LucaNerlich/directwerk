'use client'

import {useCallback, useState} from 'react'

import type {PublicationStatus} from '@directwerk/api/types'

export interface PublicationListActionLabels {
    publishSuccess: (title: string) => string
    unpublishSuccess: (title: string) => string
    cancelScheduleSuccess: (title: string) => string
    unarchiveSuccess: (title: string) => string
    publishError: string
    unpublishError: string
    cancelScheduleError: string
    unarchiveError: string
    deleteSuccess?: (title: string) => string
    deleteError?: string
}

export interface PublicationListActionsState<T extends {id: number; title: string}> {
    busyItemId: number | null
    errorMessage: string | null
    statusMessage: string | null
    handlePublish: (item: T) => Promise<void>
    handleUnpublish: (item: T) => Promise<void>
    handleCancelSchedule: (item: T) => Promise<void>
    handleUnarchive: (item: T) => Promise<void>
    handleDelete: ((item: T) => Promise<void>) | null
}

export function usePublicationListActions<T extends {
    id: number
    title: string
    status: PublicationStatus
}>({
    setItems,
    publish,
    unpublish,
    cancelSchedule,
    unarchive,
    remove,
    labels,
    authRedirect,
}: {
    setItems: React.Dispatch<React.SetStateAction<T[]>>
    publish: (id: number) => Promise<T>
    unpublish: (id: number) => Promise<T>
    cancelSchedule: (id: number) => Promise<T>
    unarchive: (id: number) => Promise<T>
    remove?: (id: number) => Promise<void>
    labels: PublicationListActionLabels
    authRedirect: (error: unknown) => boolean
}): PublicationListActionsState<T> {
    const [busyItemId, setBusyItemId] = useState<number | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [statusMessage, setStatusMessage] = useState<string | null>(null)

    const runAction = useCallback(
        async (
            item: T,
            action: (id: number) => Promise<T>,
            successMessage: string,
            errorMessageText: string,
        ) => {
            setBusyItemId(item.id)
            setErrorMessage(null)
            setStatusMessage(null)
            try {
                const updated = await action(item.id)
                setItems((current) =>
                    current.map((entry) => (entry.id === item.id ? updated : entry)),
                )
                setStatusMessage(successMessage)
            } catch (error) {
                if (authRedirect(error)) {
                    return
                }
                setErrorMessage(
                    error instanceof Error ? error.message : errorMessageText,
                )
            } finally {
                setBusyItemId(null)
            }
        },
        [authRedirect, setItems],
    )

    const handlePublish = useCallback(
        async (item: T) => {
            await runAction(
                item,
                publish,
                labels.publishSuccess(item.title),
                labels.publishError,
            )
        },
        [labels, publish, runAction],
    )

    const handleUnpublish = useCallback(
        async (item: T) => {
            await runAction(
                item,
                unpublish,
                labels.unpublishSuccess(item.title),
                labels.unpublishError,
            )
        },
        [labels, runAction, unpublish],
    )

    const handleCancelSchedule = useCallback(
        async (item: T) => {
            await runAction(
                item,
                cancelSchedule,
                labels.cancelScheduleSuccess(item.title),
                labels.cancelScheduleError,
            )
        },
        [cancelSchedule, labels, runAction],
    )

    const handleUnarchive = useCallback(
        async (item: T) => {
            await runAction(
                item,
                unarchive,
                labels.unarchiveSuccess(item.title),
                labels.unarchiveError,
            )
        },
        [labels, runAction, unarchive],
    )

    const handleDelete = useCallback(
        async (item: T) => {
            if (remove === undefined) {
                return
            }
            setBusyItemId(item.id)
            setErrorMessage(null)
            setStatusMessage(null)
            try {
                await remove(item.id)
                setItems((current) => current.filter((entry) => entry.id !== item.id))
                setStatusMessage(
                    labels.deleteSuccess !== undefined
                        ? labels.deleteSuccess(item.title)
                        : `„${item.title}“ wurde gelöscht.`,
                )
            } catch (error) {
                if (authRedirect(error)) {
                    return
                }
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : (labels.deleteError ?? 'Löschen fehlgeschlagen.'),
                )
            } finally {
                setBusyItemId(null)
            }
        },
        [authRedirect, labels, remove, setItems],
    )

    return {
        busyItemId,
        errorMessage,
        statusMessage,
        handlePublish,
        handleUnpublish,
        handleCancelSchedule,
        handleUnarchive,
        handleDelete: remove === undefined ? null : handleDelete,
    }
}
