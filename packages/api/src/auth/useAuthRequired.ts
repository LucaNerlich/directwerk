'use client'

import {useCallback} from 'react'
import {useRouter} from 'next/navigation'

import {AUTH_REQUIRED} from '../constants'

/**
 * Returns a handler that recognizes `AUTH_REQUIRED` errors and redirects to
 * the login page.
 *
 * Replaces the boilerplate that was duplicated in ~70 components:
 *
 * ```ts
 * const handleAuthError = useAuthRequired()
 * try {
 *     await listArticles(host)
 * } catch (error) {
 *     if (handleAuthError(error)) return
 *     // ...regular error handling
 * }
 * ```
 */
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
