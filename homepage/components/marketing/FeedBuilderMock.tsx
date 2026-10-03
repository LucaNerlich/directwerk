'use client'

import {useState} from 'react'

import {useCopyToClipboard} from '@directwerk/ui/hooks/use-copy-to-clipboard'

import type {Dictionary} from '@/lib/i18n/get-dictionary'

/** Builds a feed URL containing the selected formats as query parameters. */
function buildFeedUrl(selected: ReadonlySet<string>): string {
    const params = [...selected]
        .map((format) => `format=${encodeURIComponent(format)}`)
        .join('&')
    return `https://deine-show.directwerk.org/feeds/deine-show/u/dein-token.xml${params.length > 0 ? `?${params}` : ''}`
}

export default function FeedBuilderMock({
    copy,
}: {
    copy: Dictionary['feedBuilder']
}): React.JSX.Element {
    const formats = copy.formats
    const [selected, setSelected] = useState<ReadonlySet<string>>(
        () => new Set<string>(formats[0] ? [formats[0]] : []),
    )
    const {state, copy: copyToClipboard, reset} = useCopyToClipboard()

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
        reset()
    }

    const formatCountLabel =
        selected.size === 0
            ? copy.urlAllFormats
            : copy.urlSelectedFormats
                  .replace('{selected}', String(selected.size))
                  .replace('{total}', String(formats.length))

    return (
        <div className="glass-panel rounded-3xl p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {copy.eyebrow}
            </p>
            <p className="mt-3 text-xl font-semibold tracking-tight">{copy.title}</p>
            <fieldset className="mt-6">
                <legend className="text-sm font-medium">{copy.legend}</legend>
                <div className="mt-3 flex flex-wrap gap-2">
                    {formats.map((format) => {
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
                    {copy.urlLabel} {formatCountLabel}:
                </p>
                <p className="mt-2 break-all font-mono text-xs leading-5" role="status">
                    {buildFeedUrl(selected)}
                </p>
                <button
                    className="mt-3 rounded-full border border-foreground/15 px-4 py-1.5 text-sm font-medium hover:bg-accent"
                    onClick={() => void copyToClipboard(buildFeedUrl(selected))}
                    type="button"
                >
                    {state === 'copied' ? copy.copied : copy.copyUrl}
                </button>
            </div>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">{copy.footnote}</p>
        </div>
    )
}
