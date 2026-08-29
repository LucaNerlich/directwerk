'use client'

import {useCallback, useEffect, useRef, useState} from 'react'

import type {PublicationStatus} from '@directwerk/api/types'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

import {usePublicationListActions} from './usePublicationListActions'

interface PublicationListPageLabels {
    loadError: string
    unpublishSuccess: (title: string) => string
    cancelScheduleSuccess: (title: string) => string
    unarchiveSuccess: (title: string) => string
    unpublishError: string
    cancelScheduleError: string
    unarchiveError: string
}

export interface PublicationListPageConfig<T extends {
    id: number
    title: string
    status: PublicationStatus
}> {
    load: () => Promise<T[]>
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
        unpublish: (id) => configRef.current.unpublish(id),
        cancelSchedule: (id) => configRef.current.cancelSchedule(id),
        unarchive: (id) => configRef.current.unarchive(id),
        labels: config.labels,
        authRedirect,
    })

    useEffect(() => {
        void load()
    }, [load])

    return {
        items,
        setItems,
        isLoading,
        listError,
        displayError: listError ?? listActions.errorMessage,
        ...listActions,
    }
}
