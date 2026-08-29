'use client'

import {useCallback} from 'react'
import {useRouter} from 'next/navigation'

import {AUTH_REQUIRED} from '../constants'

/** Redirects to `/login` when `error` is `AUTH_REQUIRED`. */
export function useAuthRequired(): (error: unknown) => boolean {
    const router = useRouter()

    return useCallback(
        (error: unknown) => {
            if (error instanceof Error && error.message === AUTH_REQUIRED) {
                router.replace('/login')
                return true
            }
            return false
        },
        [router],
    )
}
