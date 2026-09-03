'use client'

import {useState} from 'react'

import {Button, buttonVariants} from '@directwerk/ui/components/button'
import {cn} from '@directwerk/ui/lib/utils'

import CopyUrlButton from '@/components/CopyUrlButton'

const COLLAPSE_THRESHOLD = 80

function isTokenUrl(url: string): boolean {
    return url.includes('/u/') || url.includes('token=')
}

function maskedUrl(url: string): string {
    try {
        const parsed = new URL(url)
        return `${parsed.protocol}//${parsed.host}/… (verborgen — kopieren zum Verwenden)`
    } catch {
        return 'URL verborgen — kopieren zum Verwenden.'
    }
}

export default function FeedUrlDisplay({
    url,
    title,
    description,
    className,
    defaultVisible,
}: {
    url: string
    title?: string
    description?: string
    className?: string
    defaultVisible?: boolean
}): React.JSX.Element {
    const shouldCollapse =
        defaultVisible ?? (!isTokenUrl(url) && url.length <= COLLAPSE_THRESHOLD)
    const [visible, setVisible] = useState(shouldCollapse)

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
                {url.length > COLLAPSE_THRESHOLD || isTokenUrl(url) ? (
                    <Button
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
                aria-label={visible ? undefined : 'Private Feed-URL verborgen'}
                className="break-all rounded-md bg-muted/50 px-3 py-2 font-mono text-xs leading-5 text-muted-foreground"
            >
                {visible ? url : maskedUrl(url)}
            </p>
        </div>
    )
}
