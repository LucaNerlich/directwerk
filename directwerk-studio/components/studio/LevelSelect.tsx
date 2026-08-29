'use client'

import {listPublicLevels} from '@/lib/api/subscriptionApi'
import type {LevelSummary} from '@directwerk/api/types'
import {useCachedTenantQuery} from '@directwerk/api/client/useCachedTenantQuery'
import {getClientTenantHost} from '@directwerk/api/tenant'

const PUBLIC_VALUE = ''

interface LevelSelectProps {
    value: number | null
    onChange: (value: number | null) => void
    id?: string
    disabled?: boolean
}

/** `sortOrder` value; `null` = no floor (public). */
export default function LevelSelect({
    value,
    onChange,
    id,
    disabled,
}: LevelSelectProps): React.JSX.Element {
    const tenantHost = getClientTenantHost()
    const {data: levels, error, isLoading} = useCachedTenantQuery<LevelSummary[]>(
        (host) => listPublicLevels(host),
        {
            namespace: 'public-levels',
            tenantHost,
            fallbackError: 'Stufen konnten nicht geladen werden.',
        },
    )

    const resolvedLevels = levels ?? []
    const state = isLoading ? 'loading' : error !== null ? 'error' : 'ready'
    const selectedValue = value === null ? PUBLIC_VALUE : String(value)
    const hasMissingValue =
        state === 'ready' &&
        value !== null &&
        !resolvedLevels.some((level) => level.sortOrder === value)

    return (
        <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled || state === 'loading' || state === 'error'}
            id={id}
            onChange={(event) => {
                const raw = event.target.value
                onChange(raw === PUBLIC_VALUE ? null : Number.parseInt(raw, 10))
            }}
            value={selectedValue}
        >
            {state === 'loading' ? (
                <option value="">Stufen werden geladen…</option>
            ) : state === 'error' ? (
                <option value="">Stufen konnten nicht geladen werden.</option>
            ) : (
                <>
                    <option value="">Öffentlich / Keine Mindeststufe</option>
                    {hasMissingValue ? (
                        <option value={selectedValue}>Stufe {selectedValue}</option>
                    ) : null}
                    {resolvedLevels.map((level) => (
                        <option key={level.id} value={level.sortOrder}>
                            {level.title} ({level.sortOrder})
                        </option>
                    ))}
                </>
            )}
        </select>
    )
}
