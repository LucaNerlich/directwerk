'use client'

import {useCallback, useEffect, useRef, useState} from 'react'

export type CopyState = 'idle' | 'copied' | 'failed'

/**
 * Copies text to the clipboard using the available browser clipboard mechanism.
 *
 * @param text - The text to copy
 * @returns `true` if the text was copied successfully, `false` otherwise
 */
async function copyToClipboard(text: string): Promise<boolean> {
    try {
        if (
            typeof navigator !== 'undefined' &&
            navigator.clipboard?.writeText !== undefined
        ) {
            await navigator.clipboard.writeText(text)
            return true
        }
    } catch {
        // Fall through to legacy fallback below.
    }
    let area: HTMLTextAreaElement | null = null
    try {
        if (typeof document === 'undefined') {
            return false
        }
        area = document.createElement('textarea')
        area.value = text
        area.setAttribute('readonly', '')
        area.style.position = 'fixed'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        return document.execCommand('copy')
    } catch {
        return false
    } finally {
        area?.remove()
    }
}

/**
 * Provides clipboard copy state and actions.
 *
 * @returns The current copy state, a function that copies text, and a function that resets the state
 */
export function useCopyToClipboard() {
    const [state, setState] = useState<CopyState>('idle')
    const resetTimerRef = useRef<number | null>(null)

    useEffect(() => () => {
        if (resetTimerRef.current !== null) {
            window.clearTimeout(resetTimerRef.current)
            resetTimerRef.current = null
        }
    }, [])

    const copy = useCallback(async (text: string) => {
        const ok = await copyToClipboard(text)
        setState(ok ? 'copied' : 'failed')
        if (ok) {
            if (resetTimerRef.current !== null) {
                window.clearTimeout(resetTimerRef.current)
            }
            resetTimerRef.current = window.setTimeout(() => {
                setState((current) => (current === 'copied' ? 'idle' : current))
                resetTimerRef.current = null
            }, 2000)
        }
    }, [])

    const reset = useCallback(() => {
        setState('idle')
    }, [])

    return {state, copy, reset}
}
