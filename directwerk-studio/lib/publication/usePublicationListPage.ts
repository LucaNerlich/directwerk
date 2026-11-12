'use client'

import {useCallback, useEffect, useMemo, useRef, useState} from 'react'

import type {PublicationSort, PublicationStatus} from '@directwerk/api/types'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

import {
    usePublicationBulkActions,
    type PublicationBulkActionLabels,
    type PublicationBulkSettledResult,
} from './usePublicationBulkActions'
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

const LIST_PAGE_SIZE = 100

export interface PublicationListPageConfig<T extends {
    id: number
    title: string
    status: PublicationStatus
}> {
    load: (page?: {limit?: number; offset?: number; sort?: PublicationSort}) => Promise<T[]>
    publish: (id: number) => Promise<T>
    unpublish: (id: number) => Promise<T>
    cancelSchedule: (id: number) => Promise<T>
    unarchive: (id: number) => Promise<T>
    remove?: (id: number) => Promise<void>
    publishMany: (ids: number[]) => Promise<PublicationBulkSettledResult<T>>
    unpublishMany: (ids: number[]) => Promise<PublicationBulkSettledResult<T>>
    removeMany?: (ids: number[]) => Promise<number[]>
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
    const [sort, setSort] = useState<PublicationSort>('CREATED')
    const [listError, setListError] = useState<string | null>(null)
    const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null)
    const [actionStatusMessage, setActionStatusMessage] = useState<string | null>(null)
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

    const itemsRef = useRef(items)
    itemsRef.current = items
    const sortRef = useRef(sort)
    sortRef.current = sort

    const selection = usePublicationListState(itemIds)

    const [hasMore, setHasMore] = useState(false)

    // Shared by row + bulk actions so a late completion cannot overwrite a newer message.
    const actionEpochRef = useRef(0)
    const beginActionEpoch = useCallback((): number => {
        actionEpochRef.current += 1
        return actionEpochRef.current
    }, [])
    const isActionEpoch = useCallback(
        (epoch: number): boolean => epoch === actionEpochRef.current,
        [],
    )

    const loadEpochRef = useRef(0)
    const loadedSortRef = useRef<PublicationSort>('CREATED')

    const load = useCallback(async (offset = 0): Promise<void> => {
        const epoch = ++loadEpochRef.current
        const current = configRef.current
        const requestSort = sortRef.current
        // Keep loaded rows visible while a sort change refetches; only an empty list blocks the page.
        setIsLoading(offset === 0 && itemsRef.current.length === 0)
        setListError(null)
        // loadMore must not wipe in-flight or completed action messages (#729 review).
        if (offset === 0) {
            setActionErrorMessage(null)
            setActionStatusMessage(null)
        }
        try {
            const loaded = await current.load({
                limit: LIST_PAGE_SIZE,
                offset,
                sort: requestSort,
            })
            // Latest request wins so a slow sort response cannot overwrite a newer one.
            if (epoch !== loadEpochRef.current) {
                return
            }
            loadedSortRef.current = requestSort
            setItems((existing) =>
                offset === 0
                    ? loaded
                    : [
                          ...existing,
                          ...loaded.filter(
                              (item) => !existing.some((known) => known.id === item.id),
                          ),
                      ],
            )
            setHasMore(loaded.length === LIST_PAGE_SIZE)
        } catch (error) {
            if (epoch !== loadEpochRef.current || authRedirect(error)) {
                return
            }
            setListError(
                error instanceof Error ? error.message : current.labels.loadError,
            )
        } finally {
            if (epoch === loadEpochRef.current) {
                setIsLoading(false)
            }
        }
    }, [authRedirect])

    const loadMore = useCallback(async (): Promise<void> => {
        // A sort refetch is in flight; its page-0 response will replace these rows.
        if (loadedSortRef.current !== sortRef.current) {
            return
        }
        await load(itemsRef.current.length)
    }, [load])

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
        errorMessage: actionErrorMessage,
        setErrorMessage: setActionErrorMessage,
        statusMessage: actionStatusMessage,
        setStatusMessage: setActionStatusMessage,
        beginActionEpoch,
        isActionEpoch,
    })

    const bulkActions = usePublicationBulkActions({
        items,
        selectedIds: selection.selectedIds,
        publishMany: (ids) => configRef.current.publishMany(ids),
        unpublishMany: (ids) => configRef.current.unpublishMany(ids),
        removeMany: config.removeMany === undefined
            ? undefined
            : (ids) => {
                const removeMany = configRef.current.removeMany
                return removeMany === undefined ? Promise.resolve([]) : removeMany(ids)
            },
        setItems,
        clearSelection: selection.clearSelection,
        retainSelection: selection.retainSelection,
        labels: config.labels.bulk,
        authRedirect,
        errorMessage: actionErrorMessage,
        setErrorMessage: setActionErrorMessage,
        statusMessage: actionStatusMessage,
        setStatusMessage: setActionStatusMessage,
        beginActionEpoch,
        isActionEpoch,
    })

    useEffect(() => {
        void load()
    }, [load, sort])

    const displayError = listError ?? actionErrorMessage

    return {
        items,
        setItems,
        isLoading,
        hasMore,
        loadMore,
        sort,
        setSort,
        listError,
        displayError,
        statusMessage: actionStatusMessage,
        reload: load,
        // Disable bulk + other rows while any row action is in flight (shared message channel).
        isBulkBusy: bulkActions.isBulkBusy || listActions.busyItemId !== null,
        publishableCount: bulkActions.publishableCount,
        unpublishableCount: bulkActions.unpublishableCount,
        handleBulkPublish: bulkActions.handleBulkPublish,
        handleBulkUnpublish: bulkActions.handleBulkUnpublish,
        handleBulkDelete: bulkActions.handleBulkDelete,
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
