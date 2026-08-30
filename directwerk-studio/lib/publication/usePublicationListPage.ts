'use client'

import {useCallback, useEffect, useMemo, useRef, useState} from 'react'

import type {PublicationStatus} from '@directwerk/api/types'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

import {usePublicationBulkActions, type PublicationBulkActionLabels} from './usePublicationBulkActions'
import {usePublicationListActions} from './usePublicationListActions'
import {usePublicationListSelection} from './usePublicationListSelection'

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
    labels: PublicationListPageLabels
    loadingMessage?: string
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

    const itemIds = useMemo(() => items.map((item) => item.id), [items])

    const selection = usePublicationListSelection(itemIds)

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
        ...selection,
        busyItemId: listActions.busyItemId,
        handlePublish: listActions.handlePublish,
        handleUnpublish: listActions.handleUnpublish,
        handleCancelSchedule: listActions.handleCancelSchedule,
        handleUnarchive: listActions.handleUnarchive,
    }
}
