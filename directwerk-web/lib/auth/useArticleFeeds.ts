'use client'

import {useAuthedQuery} from '@directwerk/api/client/useAuthedQuery'
import type {ArticleFeedView} from '@directwerk/api/types'

import {listMyArticleFeeds} from '@/lib/api/client'
import {getWebClientTenantHost} from '@/lib/tenant/clientHost'
import {userFacingFeedsError} from '@/lib/billing/userFacingBillingError'
import {useDictionary} from '@/lib/i18n/LocaleProvider'

export interface ArticleFeedsState {
    feeds: ArticleFeedView[]
    error: string | null
    isLoading: boolean
    reload: () => void
    setFeeds: React.Dispatch<React.SetStateAction<ArticleFeedView[]>>
}

export function useArticleFeeds(isAuthenticated: boolean): ArticleFeedsState {
    const {errors} = useDictionary()
    const query = useAuthedQuery(() => listMyArticleFeeds(getWebClientTenantHost()), {
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
