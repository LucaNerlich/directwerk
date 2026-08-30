'use client'

import {useCallback, useEffect, useMemo, useRef, useState} from 'react'

import type {SeriesSummary} from '@directwerk/api/types'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

import {createPublicationBulkLabels} from './publicationBulkLabels'
import {usePublicationBulkActions} from './usePublicationBulkActions'
import {usePublicationListActions} from './usePublicationListActions'
import {usePublicationListState} from './usePublicationListState'

type SeriesListItem = SeriesSummary & {publishedAt: null}

function toListItem(series: SeriesSummary): SeriesListItem {
    return {...series, publishedAt: null}
}

export function useSeriesListPage({
    load,
    publish,
    unpublish,
}: {
    load: () => Promise<SeriesSummary[]>
    publish: (id: number) => Promise<SeriesSummary>
    unpublish: (id: number) => Promise<SeriesSummary>
}) {
    const authRedirect = useAuthRequired()
    const actionsRef = useRef({load, publish, unpublish})
    actionsRef.current = {load, publish, unpublish}

    const [items, setItems] = useState<SeriesListItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [listError, setListError] = useState<string | null>(null)

    const itemIds = useMemo(() => items.map((item) => item.id), [items])
    const selection = usePublicationListState(itemIds)

    const setSeriesItems = useCallback(
        (updater: React.SetStateAction<SeriesListItem[]>) => {
            setItems(updater)
        },
        [],
    )

    const listActions = usePublicationListActions({
        setItems: setSeriesItems,
        publish: async (id) => toListItem(await actionsRef.current.publish(id)),
        unpublish: async (id) => toListItem(await actionsRef.current.unpublish(id)),
        cancelSchedule: async () => {
            throw new Error('Sendungen unterstützen keine Planung.')
        },
        unarchive: async () => {
            throw new Error('Sendungen unterstützen kein Archiv.')
        },
        labels: {
            publishSuccess: (title) => `Sendung „${title}“ wurde veröffentlicht.`,
            unpublishSuccess: (title) =>
                `Sendung „${title}“ wurde zurückgezogen (Entwurf).`,
            cancelScheduleSuccess: () => '',
            unarchiveSuccess: () => '',
            publishError: 'Sendung konnte nicht veröffentlicht werden.',
            unpublishError: 'Sendung konnte nicht zurückgezogen werden.',
            cancelScheduleError: '',
            unarchiveError: '',
        },
        authRedirect,
    })

    const bulkActions = usePublicationBulkActions({
        items,
        selectedIds: selection.selectedIds,
        publish: async (id) => toListItem(await actionsRef.current.publish(id)),
        unpublish: async (id) => toListItem(await actionsRef.current.unpublish(id)),
        setItems: setSeriesItems,
        clearSelection: selection.clearSelection,
        labels: createPublicationBulkLabels('Sendung', 'Sendungen'),
        authRedirect,
    })

    const loadItems = useCallback(async (): Promise<void> => {
        try {
            const loaded = await actionsRef.current.load()
            setItems(loaded.map(toListItem))
        } catch (error) {
            if (authRedirect(error)) {
                return
            }
            setListError(
                error instanceof Error
                    ? error.message
                    : 'Sendungen konnten nicht geladen werden.',
            )
        } finally {
            setIsLoading(false)
        }
    }, [authRedirect])

    useEffect(() => {
        void loadItems()
    }, [loadItems])

    return {
        items,
        isLoading,
        displayError:
            listError ?? listActions.errorMessage ?? bulkActions.bulkErrorMessage,
        statusMessage: listActions.statusMessage ?? bulkActions.bulkStatusMessage,
        isBulkBusy: bulkActions.isBulkBusy,
        publishableCount: bulkActions.publishableCount,
        unpublishableCount: bulkActions.unpublishableCount,
        handleBulkPublish: bulkActions.handleBulkPublish,
        handleBulkUnpublish: bulkActions.handleBulkUnpublish,
        ...selection,
        busyItemId: listActions.busyItemId,
        handlePublish: listActions.handlePublish,
        handleUnpublish: listActions.handleUnpublish,
    }
}
