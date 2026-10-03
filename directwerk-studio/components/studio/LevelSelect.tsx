'use client'

import {listPublicLevels} from '@/lib/api/subscriptionApi'
import type {LevelSummary} from '@directwerk/api/types'
import {useCachedTenantQuery} from '@directwerk/api/client/useCachedTenantQuery'
import {getClientTenantHost} from '@directwerk/api/tenant'

import {useDictionary} from '@/components/i18n/LocaleProvider'
import {t} from '@/lib/i18n/dictionary'

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
    const dict = useDictionary()
    const levelsDict = dict.common.levels
    const tenantHost = getClientTenantHost()
    const {data: levels, error, isLoading} = useCachedTenantQuery<LevelSummary[]>(
        (host) => listPublicLevels(host),
        {
            namespace: 'public-levels',
            tenantHost,
            fallbackError: levelsDict.stufenKonntenGeladen,
        },
    )

    const resolvedLevels = levels ?? []
    const state = isLoading ? 'loading' : error !== null ? 'error' : 'ready'
    const selectedValue = value === null ? PUBLIC_VALUE : String(value)
    const hasMissingValue =
        state === 'ready' &&
        value !== null &&
        !resolvedLevels.some((level) => level.sortOrder === value)
    const selectedLevelLabel = t(levelsDict.stufeSelectedvalue, {selectedValue})

    return (
        <span className="grid gap-1.5">
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
                <option value="">{levelsDict.stufenGeladen}</option>
            ) : state === 'error' ? (
                <>
                    {value !== null ? (
                        <option value={selectedValue}>{selectedLevelLabel}</option>
                    ) : (
                        <option value="">{levelsDict.stufenKonntenGeladen}</option>
                    )}
                </>
            ) : (
                <>
                    <option value="">{levelsDict.oeffentlichKeineMindeststufe}</option>
                    {hasMissingValue ? (
                        <option value={selectedValue}>{selectedLevelLabel}</option>
                    ) : null}
                    {resolvedLevels.map((level) => (
                        <option key={level.id} value={level.sortOrder}>
                            {level.title} ({level.sortOrder})
                        </option>
                    ))}
                </>
            )}
        </select>
        {state === 'error' ? (
            <span className="text-xs text-destructive" role="alert">
                {levelsDict.keepSelection}
            </span>
        ) : null}
        </span>
    )
}
