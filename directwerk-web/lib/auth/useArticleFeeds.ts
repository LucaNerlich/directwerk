'use client'

import type {ArticleFeedView} from '@directwerk/api/types'

import {listMyArticleFeeds} from '@/lib/api/client'
import {useOwnedFeeds, type OwnedFeedsState} from '@/lib/auth/useOwnedFeeds'

export function useArticleFeeds(isAuthenticated: boolean): OwnedFeedsState<ArticleFeedView> {
    return useOwnedFeeds(() => listMyArticleFeeds(), isAuthenticated)
}
