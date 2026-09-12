'use client'

import {useId, useState} from 'react'

import {Button, buttonVariants} from '@directwerk/ui/components/button'
import {cn} from '@directwerk/ui/lib/utils'
import {isAllowedFeedUrl} from '@directwerk/api/validation/primitives'

import CopyUrlButton from '@/components/CopyUrlButton'

const COLLAPSE_THRESHOLD = 80

function isTokenUrl(url: string): boolean {
    return url.includes('/u/') || url.includes('token=')
}

/**
 * Only https (or loopback http) and same-origin relative URLs are safe as
 * link targets. Anything else (e.g. `javascript:` from a compromised record
 * that bypassed parser validation) renders as text only — no clickable XSS.
 */
function isSafeHref(url: string): boolean {
    if (url.startsWith('/') && !url.startsWith('//')) {
        return true
    }
    return isAllowedFeedUrl(url)
}

function maskedUrl(url: string): string {
    try {
        const parsed = new URL(url)
        return `${parsed.protocol}//${parsed.host}/… (verborgen — kopieren zum Verwenden)`
    } catch {
        return 'URL verborgen — kopieren zum Verwenden.'
    }
}

/**
 * Displays a feed URL with optional metadata, copying, safe opening, and privacy masking.
 *
 * @param url - The feed URL to display.
 * @param title - Optional title shown above the URL.
 * @param description - Optional description shown below the title.
 * @param className - Optional CSS class applied to the component container.
 * @returns The rendered feed URL display.
 */
export default function FeedUrlDisplay({
    url,
    title,
    description,
    className,
}: {
    url: string
    title?: string
    description?: string
    className?: string
}): React.JSX.Element {
    const [visible, setVisible] = useState(
        !isTokenUrl(url) && url.length <= COLLAPSE_THRESHOLD,
    )
    const safeHref = isSafeHref(url)
    const urlId = useId()
    const collapsible = url.length > COLLAPSE_THRESHOLD || isTokenUrl(url)

    return (
        <div className={cn('flex flex-col gap-3', className)}>
            <div className="min-w-0 flex-1">
                {title !== undefined ? <p className="font-medium">{title}</p> : null}
                {description !== undefined ? (
                    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
                <CopyUrlButton context={title} url={url} />
                {safeHref ? (
                    <a
                        aria-label={
                            title === undefined ? undefined : `Öffnen — ${title}`
                        }
                        className={buttonVariants({size: 'sm', variant: 'outline'})}
                        href={url}
                        rel="noreferrer"
                        target="_blank"
                    >
                        Öffnen
                    </a>
                ) : null}
                {collapsible ? (
                    <Button
                        aria-controls={urlId}
                        aria-expanded={visible}
                        onClick={() => setVisible((current) => !current)}
                        size="sm"
                        type="button"
                        variant="ghost"
                    >
                        {visible ? 'Verbergen' : 'Anzeigen'}
                    </Button>
                ) : null}
            </div>
            <p
                className="break-all rounded-md bg-muted/50 px-3 py-2 font-mono text-xs leading-5 text-muted-foreground"
                id={urlId}
            >
                {visible ? url : maskedUrl(url)}
            </p>
        </div>
    )
}
