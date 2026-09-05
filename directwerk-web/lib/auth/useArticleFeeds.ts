'use client'

import {useRouter} from 'next/navigation'
import {useCallback, useEffect, useState} from 'react'

import {listMyArticleFeeds} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@directwerk/api/constants'
import type {ArticleFeedView} from '@directwerk/api/types'
import {getWebClientTenantHost} from '@/lib/tenant/clientHost'
import {userFacingFeedsError} from '@/lib/billing/userFacingBillingError'

export interface ArticleFeedsState {
    feeds: ArticleFeedView[]
    error: string | null
    isLoading: boolean
    reload: () => void
    setFeeds: React.Dispatch<React.SetStateAction<ArticleFeedView[]>>
}

export function useArticleFeeds(isAuthenticated: boolean): ArticleFeedsState {
    const router = useRouter()
    const [feeds, setFeeds] = useState<ArticleFeedView[]>([])
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [reloadToken, setReloadToken] = useState(0)

    const reload = useCallback(() => {
        setReloadToken((current) => current + 1)
    }, [])

    useEffect(() => {
        let active = true
        if (!isAuthenticated) {
            setFeeds([])
            setError(null)
            setIsLoading(false)
            return
        }

        setIsLoading(true)
        setError(null)

        listMyArticleFeeds(getWebClientTenantHost())
            .then((feedList) => {
                if (!active) {
                    return
                }
                setFeeds(feedList)
            })
            .catch((requestError: unknown) => {
                if (!active) {
                    return
                }
                setFeeds([])
                if (requestError instanceof Error && requestError.message === AUTH_REQUIRED) {
                    router.replace('/login')
                    return
                }
                setError(userFacingFeedsError(requestError))
            })
            .finally(() => {
                if (active) {
                    setIsLoading(false)
                }
            })

        return () => {
            active = false
        }
    }, [isAuthenticated, reloadToken, router])

    return {feeds, error, isLoading, reload, setFeeds}
}
