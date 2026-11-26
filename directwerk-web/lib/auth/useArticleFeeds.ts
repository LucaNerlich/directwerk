'use client'

import type {ArticleFeedView} from '@directwerk/api/types'

import {listMyArticleFeeds} from '@/lib/api/client'
import {useOwnedFeeds, type OwnedFeedsState} from '@/lib/auth/useOwnedFeeds'

export interface ArticleFeedsState {
    feeds: ArticleFeedView[]
    error: string | null
    isLoading: boolean
    reload: () => void
    setFeeds: React.Dispatch<React.SetStateAction<ArticleFeedView[]>>
}

export function useArticleFeeds(isAuthenticated: boolean): OwnedFeedsState<ArticleFeedView> {
    return useOwnedFeeds(() => listMyArticleFeeds(), isAuthenticated)
}
