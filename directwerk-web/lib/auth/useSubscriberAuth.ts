'use client'

import {useSyncExternalStore} from 'react'

import {
    getAccessToken,
    subscribeToTokenStore,
} from '@/lib/auth/tokenStore'

function readTokenClient(): string | null {
    return getAccessToken()
}

function readTokenServer(): string | null {
    return null
}

export interface SubscriberAuthState {
    accessToken: string | null
    isAuthenticated: boolean
}

export function useSubscriberAuth(): SubscriberAuthState {
    const accessToken = useSyncExternalStore(
        subscribeToTokenStore,
        readTokenClient,
        readTokenServer,
    )

    return {
        accessToken,
        isAuthenticated: accessToken !== null,
    }
}
