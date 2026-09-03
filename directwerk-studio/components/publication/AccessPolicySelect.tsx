'use client'

import {Input} from '@directwerk/ui/components/input'

import {useId} from 'react'

import type {AccessPolicy} from '@directwerk/api/types'

export default function AccessPolicySelect({
    value,
    onChange,
    disabled = false,
}: {
    value: AccessPolicy
    onChange: (policy: AccessPolicy) => void
    disabled?: boolean
}) {
    const groupId = useId()
    const hintId = `${groupId}-hint`
    const freeHintId = `${groupId}-free-hint`
    const paidHintId = `${groupId}-paid-hint`
    return (
        <fieldset
            aria-describedby={hintId}
            className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0"
            disabled={disabled}
        >
            <legend className="text-sm font-semibold">Zugriff</legend>
            <p className="text-xs font-normal text-muted-foreground" id={hintId}>
                Frei ist öffentlich. Bezahlt blendet den Inhalt für alle ohne
                passende Stufe aus.
            </p>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Input
                    aria-describedby={freeHintId}
                    className="size-4 shrink-0" type="radio"
                    name={`accessPolicy-${groupId}`}
                    checked={value === 'FREE'}
                    onChange={() => onChange('FREE')}
                />
                Frei
            </label>
            <p className="pl-6 text-xs font-normal text-muted-foreground" id={freeHintId}>
                Für alle sichtbar, auch ohne Abo.
            </p>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Input
                    aria-describedby={paidHintId}
                    className="size-4 shrink-0" type="radio"
                    name={`accessPolicy-${groupId}`}
                    checked={value === 'PAID'}
                    onChange={() => onChange('PAID')}
                />
                Bezahlt
            </label>
            <p className="pl-6 text-xs font-normal text-muted-foreground" id={paidHintId}>
                Nur mit passender Stufe. Mindest-Stufe unten wählen.
            </p>
        </fieldset>
    )
}
