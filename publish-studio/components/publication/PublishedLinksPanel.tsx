'use client'

import {Button} from '@publish/ui/components/button'

import {useState} from 'react'


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

/**
 * Shows copyable public URLs after a publication is live.
 */
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
        <div className="grid gap-2 rounded-lg border bg-muted/20 p-3">
            <p className="text-sm font-semibold">{title}</p>
            {links.map((link) => (
                <div className="flex flex-wrap items-end gap-2" key={link.url}>
                    <p className="text-xs text-muted-foreground">{link.label}</p>
                    <p className="break-all text-xs">
                        <code>{link.url}</code>
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        <a href={link.url} rel="noreferrer" target="_blank">
                            Öffnen
                        </a>
                        <Button
                            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
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
                            type="button"
                        >
                            {copiedUrl === link.url ? 'Kopiert!' : 'Kopieren'}
                        </Button>
                    </div>
                </div>
            ))}
            {hint !== undefined ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
            {errorMessage !== null ? (
                <p className="text-xs text-muted-foreground" role="alert">
                    {errorMessage}
                </p>
            ) : null}
        </div>
    )
}
