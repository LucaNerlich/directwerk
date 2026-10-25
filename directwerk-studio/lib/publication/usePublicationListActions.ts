'use client'

import {useCallback, useState, type Dispatch, type SetStateAction} from 'react'

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
    errorMessage,
    setErrorMessage,
    statusMessage,
    setStatusMessage,
    beginActionEpoch,
    isActionEpoch,
}: {
    setItems: Dispatch<SetStateAction<T[]>>
    publish: (id: number) => Promise<T>
    unpublish: (id: number) => Promise<T>
    cancelSchedule: (id: number) => Promise<T>
    unarchive: (id: number) => Promise<T>
    remove?: (id: number) => Promise<void>
    labels: PublicationListActionLabels
    authRedirect: (error: unknown) => boolean
    errorMessage: string | null
    setErrorMessage: Dispatch<SetStateAction<string | null>>
    statusMessage: string | null
    setStatusMessage: Dispatch<SetStateAction<string | null>>
    beginActionEpoch: () => number
    isActionEpoch: (epoch: number) => boolean
}): PublicationListActionsState<T> {
    const [busyItemId, setBusyItemId] = useState<number | null>(null)

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

    const runAction = useCallback(
        async (
            item: T,
            action: (id: number) => Promise<T>,
            successMessage: string,
            errorMessageText: string,
        ) => {
            const epoch = beginActionEpoch()
            setBusyItemId(item.id)
            clearActionMessages()
            try {
                const updated = await action(item.id)
                setItems((current) =>
                    current.map((entry) => (entry.id === item.id ? updated : entry)),
                )
                if (!isActionEpoch(epoch)) {
                    return
                }
                setStatusMessage(successMessage)
            } catch (error) {
                if (authRedirect(error)) {
                    return
                }
                if (!isActionEpoch(epoch)) {
                    return
                }
                setActionError(
                    error instanceof Error ? error.message : errorMessageText,
                )
            } finally {
                setBusyItemId(null)
            }
        },
        [
            authRedirect,
            beginActionEpoch,
            clearActionMessages,
            isActionEpoch,
            setActionError,
            setItems,
            setStatusMessage,
        ],
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
            const epoch = beginActionEpoch()
            setBusyItemId(item.id)
            clearActionMessages()
            try {
                await remove(item.id)
                setItems((current) => current.filter((entry) => entry.id !== item.id))
                if (!isActionEpoch(epoch)) {
                    return
                }
                setStatusMessage(
                    labels.deleteSuccess !== undefined
                        ? labels.deleteSuccess(item.title)
                        : `„${item.title}“ wurde gelöscht.`,
                )
            } catch (error) {
                if (authRedirect(error)) {
                    return
                }
                if (!isActionEpoch(epoch)) {
                    return
                }
                setActionError(
                    error instanceof Error
                        ? error.message
                        : (labels.deleteError ?? 'Löschen fehlgeschlagen.'),
                )
            } finally {
                setBusyItemId(null)
            }
        },
        [
            authRedirect,
            beginActionEpoch,
            clearActionMessages,
            isActionEpoch,
            labels,
            remove,
            setActionError,
            setItems,
            setStatusMessage,
        ],
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
