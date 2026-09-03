'use client'

import {useEffect, useRef, useState} from 'react'

import {AUTH_REQUIRED} from '@directwerk/api/constants'

export type EntitledDetailStatus = 'loading' | 'ready' | 'not-found' | 'error'

export interface EntitledDetailMessages {
    emptySlug: string
    loadFailed: string
    authRequired: string
}

export interface EntitledDetailResult<T> {
    item: T | null
    status: EntitledDetailStatus
    errorMessage: string | null
    retry: () => void
}

/**
 * Shared detail loader for the episode and article clients.
 *
 * - Skips the fetch when a server-rendered `initial` item exists and the
 *   viewer is anonymous.
 * - Uses the entitled source for subscribers, the public source otherwise.
 * - Single-by-slug fetchers where the API allows them (articles), list scan
 *   otherwise (episodes) — both are just `() => Promise<T | null>` loaders.
 * - Misses resolve to `not-found` (paid-gate EmptyState), transport failures
 *   to `error` (destructive alert + retry).
 */
export function useEntitledDetail<T>({
    slug,
    initial,
    isAuthenticated,
    tenantHost,
    loadPublic,
    loadEntitled,
    messages,
}: {
    slug: string
    initial: T | null
    isAuthenticated: boolean
    tenantHost: string
    loadPublic: () => Promise<T | null>
    loadEntitled: () => Promise<T | null>
    messages: EntitledDetailMessages
}): EntitledDetailResult<T> {
    const loadersRef = useRef({loadPublic, loadEntitled, messages})
    loadersRef.current = {loadPublic, loadEntitled, messages}
    const [item, setItem] = useState<T | null>(initial)
    const [status, setStatus] = useState<EntitledDetailStatus>(
        initial === null || isAuthenticated ? 'loading' : 'ready',
    )
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        let active = true
        if (slug.length === 0) {
            setItem(null)
            setErrorMessage(null)
            setStatus('not-found')
            return
        }
        if (initial !== null && !isAuthenticated) {
            setItem(initial)
            setErrorMessage(null)
            setStatus('ready')
            return
        }

        setStatus('loading')
        setErrorMessage(null)

        const load = isAuthenticated
            ? loadersRef.current.loadEntitled
            : loadersRef.current.loadPublic

        load()
            .then((match) => {
                if (!active) {
                    return
                }
                setItem(match)
                setStatus(match === null ? 'not-found' : 'ready')
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                setItem(null)
                if (error instanceof Error && error.message === AUTH_REQUIRED) {
                    setErrorMessage(loadersRef.current.messages.authRequired)
                } else {
                    setErrorMessage(
                        error instanceof Error
                            ? error.message
                            : loadersRef.current.messages.loadFailed,
                    )
                }
                setStatus('error')
            })

        return () => {
            active = false
        }
    }, [slug, initial, isAuthenticated, tenantHost, attempt])

    return {
        item,
        status,
        errorMessage,
        retry: () => setAttempt((current) => current + 1),
    }
}
