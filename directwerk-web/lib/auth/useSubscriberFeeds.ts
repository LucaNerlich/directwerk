'use client'

import {useAuthedQuery} from '@directwerk/api/client/useAuthedQuery'
import type {SubscriberFeedView} from '@directwerk/api/types'

import {listMyFeeds} from '@/lib/api/client'
import {getWebClientTenantHost} from '@/lib/tenant/clientHost'
import {userFacingFeedsError} from '@/lib/billing/userFacingBillingError'

export interface SubscriberFeedsState {
    feeds: SubscriberFeedView[]
    error: string | null
    isLoading: boolean
    reload: () => void
    setFeeds: React.Dispatch<React.SetStateAction<SubscriberFeedView[]>>
}

export function useSubscriberFeeds(isAuthenticated: boolean): SubscriberFeedsState {
    const query = useAuthedQuery(() => listMyFeeds(getWebClientTenantHost()), {
        enabled: isAuthenticated,
        fallbackError: 'Feeds konnten nicht geladen werden.',
        mapError: userFacingFeedsError,
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
