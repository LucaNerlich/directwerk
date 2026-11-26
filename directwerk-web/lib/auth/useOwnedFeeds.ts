'use client'

import {useAuthedQuery} from '@directwerk/api/client/useAuthedQuery'

import {userFacingFeedsError} from '@/lib/billing/userFacingBillingError'
import {useDictionary} from '@/lib/i18n/LocaleProvider'

export interface OwnedFeedsState<T> {
    feeds: T[]
    error: string | null
    isLoading: boolean
    reload: () => void
    setFeeds: React.Dispatch<React.SetStateAction<T[]>>
}

/** Shared state for the subscriber and article feed panels on `/feeds`. */
export function useOwnedFeeds<T>(
    load: () => Promise<T[]>,
    isAuthenticated: boolean,
): OwnedFeedsState<T> {
    const {errors} = useDictionary()
    const query = useAuthedQuery(load, {
        enabled: isAuthenticated,
        fallbackError: errors.billingFeeds,
        mapError: (error) => userFacingFeedsError(error, errors),
    })

    return {
        feeds: query.data ?? [],
        error: query.error,
        isLoading: query.isLoading,
        reload: query.reload,
        setFeeds: (action) =>
            query.setData((current) => {
                const base = current ?? []
                return typeof action === 'function' ? action(base) : action
            }),
    }
}
