'use client'

import {Input} from '@directwerk/ui/components/input'

import type {AccessPolicy} from '@/lib/api/types'

export default function AccessPolicySelect({
    value,
    onChange,
    disabled = false,
}: {
    value: AccessPolicy
    onChange: (policy: AccessPolicy) => void
    disabled?: boolean
}) {
    return (
        <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0" disabled={disabled}>
            <legend className="sr-only">Zugriff</legend>
            <label className="mt-2 flex items-center gap-2 text-sm">
                <Input
                    className="size-4 shrink-0" type="radio"
                    name="accessPolicy"
                    checked={value === 'FREE'}
                    onChange={() => onChange('FREE')}
                />
                Frei
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
                <Input
                    className="size-4 shrink-0" type="radio"
                    name="accessPolicy"
                    checked={value === 'PAID'}
                    onChange={() => onChange('PAID')}
                />
                Bezahlt
            </label>
        </fieldset>
    )
}
