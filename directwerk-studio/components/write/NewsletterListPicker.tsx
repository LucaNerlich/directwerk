'use client'

import Link from 'next/link'

import {Input} from '@directwerk/ui/components/input'

import type {NewsletterListSummary} from '@directwerk/api/types'

interface NewsletterListPickerProps {
    lists: NewsletterListSummary[]
    selectedListIds: Set<number>
    onChange: (ids: Set<number>) => void
    disabled?: boolean
    /** When notify-on-publish is on but nothing is attached. */
    warnMissingAttachment?: boolean
}

/**
 * Multi-select for attaching newsletter lists to an article (Write desk).
 */
export default function NewsletterListPicker({
    lists,
    selectedListIds,
    onChange,
    disabled = false,
    warnMissingAttachment = false,
}: NewsletterListPickerProps): React.JSX.Element {
    const selectedCount = selectedListIds.size
    const selectedRecipients = lists
        .filter((list) => selectedListIds.has(list.id))
        .reduce((sum, list) => sum + list.activeCount, 0)

    return (
        <fieldset className="m-0 grid gap-2 border-0 p-0" disabled={disabled}>
            <legend className="text-sm font-semibold">Newsletter-Listen</legend>
            <p className="text-xs font-normal text-muted-foreground">
                Mehrfachauswahl. Beim Veröffentlichen mit „Benachrichtigen“ geht die
                E-Mail an aktive Abonnenten der gewählten Listen.
            </p>
            {lists.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                    Keine Listen angelegt.{' '}
                    <Link className="underline underline-offset-2" href="/write/lists">
                        Liste anlegen
                    </Link>
                </p>
            ) : (
                <>
                    <ul className="grid gap-2">
                        {lists.map((list) => (
                            <li key={list.id}>
                                <label className="flex items-start gap-2 text-sm">
                                    <Input
                                        checked={selectedListIds.has(list.id)}
                                        className="mt-0.5 size-4 shrink-0"
                                        disabled={disabled}
                                        onChange={(event) => {
                                            const next = new Set(selectedListIds)
                                            if (event.target.checked) {
                                                next.add(list.id)
                                            } else {
                                                next.delete(list.id)
                                            }
                                            onChange(next)
                                        }}
                                        type="checkbox"
                                    />
                                    <span className="min-w-0">
                                        <span className="font-medium">{list.name}</span>
                                        <span className="block text-xs font-normal text-muted-foreground">
                                            {list.slug}
                                            {' · '}
                                            {list.activeCount} aktiv
                                            {list.pendingCount > 0
                                                ? ` · ${list.pendingCount} ausstehend`
                                                : ''}
                                        </span>
                                    </span>
                                </label>
                            </li>
                        ))}
                    </ul>
                    {selectedCount > 0 ? (
                        <p className="text-xs text-muted-foreground" role="status">
                            {selectedCount === 1
                                ? '1 Liste'
                                : `${selectedCount} Listen`}
                            {' · ca. '}
                            {selectedRecipients} Empfänger
                        </p>
                    ) : null}
                    {warnMissingAttachment ? (
                        <p className="text-xs text-amber-700 dark:text-amber-400" role="status">
                            Benachrichtigen ist an, aber keine Liste angehängt — es wird
                            keine Newsletter-Mail gesendet.
                        </p>
                    ) : null}
                </>
            )}
        </fieldset>
    )
}
