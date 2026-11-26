'use client'

import type {SubscriberFeedView} from '@directwerk/api/types'

import {listMyFeeds} from '@/lib/api/client'
import {useOwnedFeeds, type OwnedFeedsState} from '@/lib/auth/useOwnedFeeds'

export interface SubscriberFeedsState {
    feeds: SubscriberFeedView[]
    error: string | null
    isLoading: boolean
    reload: () => void
    setFeeds: React.Dispatch<React.SetStateAction<SubscriberFeedView[]>>
}

export function useSubscriberFeeds(isAuthenticated: boolean): OwnedFeedsState<SubscriberFeedView> {
    return useOwnedFeeds(() => listMyFeeds(), isAuthenticated)
}
