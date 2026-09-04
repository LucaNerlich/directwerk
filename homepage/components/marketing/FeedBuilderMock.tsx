'use client'

import {useState} from 'react'

const FORMATS = ['Hauptfolge', 'Interview', 'Bonus'] as const

function buildFeedUrl(selected: ReadonlySet<string>): string {
    const params = [...selected]
        .map((format) => `format=${encodeURIComponent(format)}`)
        .join('&')
    return `https://deine-show.directwerk.de/feeds/deine-show/u/dein-token.xml${params.length > 0 ? `?${params}` : ''}`
}

export default function FeedBuilderMock(): React.JSX.Element {
    const [selected, setSelected] = useState<ReadonlySet<string>>(
        () => new Set<string>(['Hauptfolge']),
    )
    const [copied, setCopied] = useState(false)

    function toggle(format: string): void {
        setSelected((previous) => {
            const next = new Set(previous)
            if (next.has(format)) {
                next.delete(format)
            } else {
                next.add(format)
            }
            return next
        })
        setCopied(false)
    }

    async function copy(): Promise<void> {
        try {
            await navigator.clipboard.writeText(buildFeedUrl(selected))
            setCopied(true)
        } catch {
            setCopied(false)
        }
    }

    return (
        <div className="glass-panel rounded-3xl p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Feed-Builder · Demo
            </p>
            <p className="mt-3 text-xl font-semibold tracking-tight">
                Jeder Hörer baut seinen eigenen Feed
            </p>
            <fieldset className="mt-6">
                <legend className="text-sm font-medium">
                    Formate wählen — probier es aus:
                </legend>
                <div className="mt-3 flex flex-wrap gap-2">
                    {FORMATS.map((format) => {
                        const active = selected.has(format)
                        return (
                            <button
                                aria-pressed={active}
                                className={
                                    active
                                        ? 'rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground'
                                        : 'glass-chip rounded-full px-4 py-2 text-sm font-medium'
                                }
                                key={format}
                                onClick={() => toggle(format)}
                                type="button"
                            >
                                {format}
                            </button>
                        )
                    })}
                </div>
            </fieldset>
            <div className="mt-6 rounded-xl border border-foreground/10 bg-background/60 p-4">
                <p className="text-xs font-medium text-muted-foreground">
                    Persönliche Feed-URL {selected.size === 0 ? '(alle Formate)' : `(${selected.size} von ${FORMATS.length} Formaten)`}:
                </p>
                <p className="mt-2 break-all font-mono text-xs leading-5" role="status">
                    {buildFeedUrl(selected)}
                </p>
                <button
                    className="mt-3 rounded-full border border-foreground/15 px-4 py-1.5 text-sm font-medium hover:bg-accent"
                    onClick={() => void copy()}
                    type="button"
                >
                    {copied ? 'Kopiert!' : 'URL kopieren'}
                </button>
            </div>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
                Bis zu 5 Feeds pro Abonnent · nur freigeschaltete Inhalte · Token jederzeit widerrufbar.
            </p>
        </div>
    )
}
