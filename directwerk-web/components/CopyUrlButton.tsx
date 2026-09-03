'use client'

import {useState} from 'react'

import {Button} from '@directwerk/ui/components/button'

type CopyState = 'idle' | 'copied' | 'failed'

async function copyText(text: string): Promise<boolean> {
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
    try {
        if (typeof document === 'undefined') {
            return false
        }
        const area = document.createElement('textarea')
        area.value = text
        area.setAttribute('readonly', '')
        area.style.position = 'fixed'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(area)
        return ok
    } catch {
        return false
    }
}

export default function CopyUrlButton({
    url,
    className,
    size = 'sm',
    context,
}: {
    url: string
    className?: string
    size?: 'default' | 'sm' | 'lg' | 'icon'
    context?: string
}): React.JSX.Element {
    const [state, setState] = useState<CopyState>('idle')

    async function handleCopy(): Promise<void> {
        const ok = await copyText(url)
        setState(ok ? 'copied' : 'failed')
        if (ok) {
            window.setTimeout(() => {
                setState((current) => (current === 'copied' ? 'idle' : current))
            }, 2000)
        }
    }

    return (
        <span className="inline-flex flex-col gap-1">
            <Button
                aria-label={
                    context === undefined
                        ? undefined
                        : `${state === 'copied' ? 'Kopiert' : 'Kopieren'} — ${context}`
                }
                className={className}
                onClick={() => {
                    void handleCopy()
                }}
                size={size}
                type="button"
                variant="outline"
            >
                {state === 'copied' ? 'Kopiert!' : 'Kopieren'}
            </Button>
            <span aria-live="polite" role="status" className="sr-only">
                {state === 'copied' ? 'URL in die Zwischenablage kopiert.' : null}
            </span>
            {state === 'failed' ? (
                <span className="max-w-55 text-xs leading-5 text-muted-foreground" role="status">
                    Kopieren fehlgeschlagen — URL unten markieren und manuell
                    kopieren (Strg/Cmd + C).
                </span>
            ) : null}
        </span>
    )
}
