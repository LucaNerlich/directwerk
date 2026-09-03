'use client'

import {useCallback, useEffect, useMemo, useRef, useState} from 'react'

import type {PublicationStatus} from '@directwerk/api/types'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

import {usePublicationBulkActions, type PublicationBulkActionLabels} from './usePublicationBulkActions'
import {usePublicationListActions} from './usePublicationListActions'
import {usePublicationListState} from './usePublicationListState'
import {isBulkPublicationStatus} from './publicationBulkEligibility'

interface PublicationListPageLabels {
    loadError: string
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
    bulk: PublicationBulkActionLabels
}

export interface PublicationListPageConfig<T extends {
    id: number
    title: string
    status: PublicationStatus
}> {
    load: () => Promise<T[]>
    publish: (id: number) => Promise<T>
    unpublish: (id: number) => Promise<T>
    cancelSchedule: (id: number) => Promise<T>
    unarchive: (id: number) => Promise<T>
    remove?: (id: number) => Promise<void>
    labels: PublicationListPageLabels
    loadingMessage?: string
    /** Excludes drafts from bulk publishing even when their status would allow it. */
    isBulkPublishEligible?: (item: T) => boolean
    /** Excludes published items from bulk unpublishing even when their status would allow it. */
    isBulkUnpublishEligible?: (item: T) => boolean
}

export function usePublicationListPage<T extends {
    id: number
    title: string
    status: PublicationStatus
}>(config: PublicationListPageConfig<T>) {
    const authRedirect = useAuthRequired()
    const configRef = useRef(config)
    configRef.current = config

    const [items, setItems] = useState<T[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [listError, setListError] = useState<string | null>(null)
    const {isBulkPublishEligible, isBulkUnpublishEligible} = config

    const itemIds = useMemo(
        () =>
            items
                .filter((item) => isBulkPublicationStatus(item.status))
                .filter((item) =>
                    item.status === 'DRAFT'
                        ? (isBulkPublishEligible?.(item) ?? true)
                        : (isBulkUnpublishEligible?.(item) ?? true),
                )
                .map((item) => item.id),
        [isBulkPublishEligible, isBulkUnpublishEligible, items],
    )

    const selection = usePublicationListState(itemIds)

    const load = useCallback(async (): Promise<void> => {
        const current = configRef.current
        try {
            const loaded = await current.load()
            setItems(loaded)
        } catch (error) {
            if (authRedirect(error)) {
                return
            }
            setListError(
                error instanceof Error ? error.message : current.labels.loadError,
            )
        } finally {
            setIsLoading(false)
        }
    }, [authRedirect])

    const listActions = usePublicationListActions({
        setItems,
        publish: (id) => configRef.current.publish(id),
        unpublish: (id) => configRef.current.unpublish(id),
        cancelSchedule: (id) => configRef.current.cancelSchedule(id),
        unarchive: (id) => configRef.current.unarchive(id),
        remove: config.remove === undefined
            ? undefined
            : (id) => {
                const remove = configRef.current.remove
                return remove === undefined ? Promise.resolve() : remove(id)
            },
        labels: config.labels,
        authRedirect,
    })

    const bulkActions = usePublicationBulkActions({
        items,
        selectedIds: selection.selectedIds,
        publish: (id) => configRef.current.publish(id),
        unpublish: (id) => configRef.current.unpublish(id),
        setItems,
        clearSelection: selection.clearSelection,
        labels: config.labels.bulk,
        authRedirect,
    })

    useEffect(() => {
        void load()
    }, [load])

    const displayError =
        listError ??
        listActions.errorMessage ??
        bulkActions.bulkErrorMessage
    const statusMessage =
        listActions.statusMessage ?? bulkActions.bulkStatusMessage

    return {
        items,
        setItems,
        isLoading,
        listError,
        displayError,
        statusMessage,
        isBulkBusy: bulkActions.isBulkBusy,
        publishableCount: bulkActions.publishableCount,
        unpublishableCount: bulkActions.unpublishableCount,
        handleBulkPublish: bulkActions.handleBulkPublish,
        handleBulkUnpublish: bulkActions.handleBulkUnpublish,
        runBulkEdit: bulkActions.runBulkEdit,
        ...selection,
        busyItemId: listActions.busyItemId,
        handlePublish: listActions.handlePublish,
        handleUnpublish: listActions.handleUnpublish,
        handleCancelSchedule: listActions.handleCancelSchedule,
        handleUnarchive: listActions.handleUnarchive,
        handleDelete: listActions.handleDelete,
    }
}
