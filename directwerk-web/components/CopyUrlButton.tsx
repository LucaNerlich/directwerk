'use client'

import {Button} from '@directwerk/ui/components/button'
import {useCopyToClipboard} from '@directwerk/ui/hooks/use-copy-to-clipboard'

/**
 * Renders a button that copies a URL to the clipboard and reports the copy status.
 *
 * @param url - The URL to copy
 * @param context - Optional context appended to the button's accessible label
 * @returns A copy button with status feedback
 */
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
    const {state, copy} = useCopyToClipboard()

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
                    void copy(url)
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
