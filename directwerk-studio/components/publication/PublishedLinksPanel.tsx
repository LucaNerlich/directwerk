'use client'

import {Button} from '@directwerk/ui/components/button'

import {useState} from 'react'

import {safeLinkHref} from '@/lib/url/safeUrl'


interface PublishedLink {
    label: string
    url: string
}

interface PublishedLinksPanelProps {
    title: string
    links: PublishedLink[]
    hint?: string
}

async function copyUrl(url: string): Promise<void> {
    await navigator.clipboard.writeText(url)
}

export default function PublishedLinksPanel({
    title,
    links,
    hint,
}: PublishedLinksPanelProps): React.JSX.Element | null {
    const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    if (links.length === 0 && hint === undefined) {
        return null
    }

    return (
        <section
            aria-label={title}
            className="grid gap-3 rounded-xl border bg-muted/20 p-4"
        >
            <p className="text-sm font-semibold">{title}</p>
            {links.map((link) => (
                <div className="grid gap-1.5" key={link.url}>
                    <p className="text-xs font-medium text-muted-foreground">{link.label}</p>
                    <p className="break-all text-xs">
                        <code>{link.url}</code>
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        {safeLinkHref(link.url) !== null ? (
                            <a
                                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                                href={link.url}
                                rel="noreferrer"
                                target="_blank"
                            >
                                Öffnen
                            </a>
                        ) : null}
                        <Button
                            onClick={() => {
                                setErrorMessage(null)
                                void copyUrl(link.url)
                                    .then(() => {
                                        setCopiedUrl(link.url)
                                    })
                                    .catch(() => {
                                        setErrorMessage('Kopieren fehlgeschlagen.')
                                    })
                            }}
                            size="sm"
                            type="button"
                            variant="outline"
                        >
                            {copiedUrl === link.url ? 'Kopiert!' : 'Kopieren'}
                        </Button>
                    </div>
                    {copiedUrl === link.url ? (
                        <p className="text-xs text-muted-foreground" role="status">
                            Link kopiert.
                        </p>
                    ) : null}
                </div>
            ))}
            {hint !== undefined ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
            {errorMessage !== null ? (
                <p className="text-xs text-destructive" role="alert">
                    {errorMessage}
                </p>
            ) : null}
        </section>
    )
}
