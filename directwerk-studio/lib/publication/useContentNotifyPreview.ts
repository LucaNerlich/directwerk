'use client'

import {getArticleNotifyPreview, notifyArticleSubscribers} from '@/lib/api/writeApi'
import {getEpisodeNotifyPreview, notifyEpisodeSubscribers} from '@/lib/api/podcastApi'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'
import type {ContentNotifyPreview} from '@directwerk/api/types'
import {useCallback, useEffect, useState} from 'react'

type NotifyKind = 'article' | 'episode'

/**
 * Loads EMAIL_NOTIFY preview (audience, last send, job status) for a saved publication.
 * Drafts without an id skip the request — callers keep a local audience hint.
 */
export function useContentNotifyPreview(
    kind: NotifyKind,
    contentId: number | null,
    enabled: boolean,
    /** Bumps when publish/notify mutates last-send state so preview reloads. */
    revision: string | null = null,
): {
    preview: ContentNotifyPreview | null
    refresh: () => void
    retry: () => Promise<void>
    isRetrying: boolean
} {
    const authRedirect = useAuthRequired()
    const [preview, setPreview] = useState<ContentNotifyPreview | null>(null)
    const [isRetrying, setIsRetrying] = useState(false)
    const [refreshToken, setRefreshToken] = useState(0)

    const refresh = useCallback(() => {
        setRefreshToken((value) => value + 1)
    }, [])

    useEffect(() => {
        if (!enabled || contentId === null) {
            setPreview(null)
            return
        }

        let active = true
        const load = kind === 'episode' ? getEpisodeNotifyPreview : getArticleNotifyPreview
        load(contentId)
            .then((next) => {
                if (active) {
                    setPreview(next)
                }
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                setPreview(null)
                authRedirect(error)
            })

        return () => {
            active = false
        }
    }, [authRedirect, contentId, enabled, kind, refreshToken, revision])

    const retry = useCallback(async () => {
        if (contentId === null) {
            return
        }
        setIsRetrying(true)
        try {
            if (kind === 'episode') {
                await notifyEpisodeSubscribers(contentId)
            } else {
                await notifyArticleSubscribers(contentId)
            }
            refresh()
        } catch (error: unknown) {
            authRedirect(error)
            throw error
        } finally {
            setIsRetrying(false)
        }
    }, [authRedirect, contentId, kind, refresh])

    return {preview, refresh, retry, isRetrying}
}
