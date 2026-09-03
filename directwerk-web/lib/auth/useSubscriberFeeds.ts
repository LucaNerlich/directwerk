'use client'

import {useRouter} from 'next/navigation'
import {useCallback, useEffect, useState} from 'react'

import {listMyFeeds} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@directwerk/api/constants'
import type {SubscriberFeedView} from '@directwerk/api/types'
import {getClientTenantHost} from '@/lib/tenant/clientHost'
import {userFacingFeedsError} from '@/lib/billing/userFacingBillingError'

export interface SubscriberFeedsState {
    feeds: SubscriberFeedView[]
    error: string | null
    isLoading: boolean
    reload: () => void
    setFeeds: React.Dispatch<React.SetStateAction<SubscriberFeedView[]>>
}

export function useSubscriberFeeds(isAuthenticated: boolean): SubscriberFeedsState {
    const router = useRouter()
    const [feeds, setFeeds] = useState<SubscriberFeedView[]>([])
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

        listMyFeeds(getClientTenantHost())
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
