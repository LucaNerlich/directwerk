'use client'

import {useEffect, useState} from 'react'

import {listPublicLevels} from '@/lib/api/subscriptionApi'
import type {LevelSummary} from '@directwerk/api/types'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

const PUBLIC_VALUE = ''

const levelCache = new Map<string, Promise<LevelSummary[]>>()

function loadLevels(host: string): Promise<LevelSummary[]> {
    const cached = levelCache.get(host)
    if (cached !== undefined) {
        return cached
    }

    const pending = listPublicLevels(host).catch((error: unknown) => {
        levelCache.delete(host)
        throw error
    })
    levelCache.set(host, pending)
    return pending
}

interface LevelSelectProps {
    value: number | null
    onChange: (value: number | null) => void
    id?: string
    disabled?: boolean
}

/**
 * Selects a minimum access level from the tenant's active LEVEL products.
 *
 * The value is the level's `sortOrder`; `null` means "no floor" (public).
 */
export default function LevelSelect({
    value,
    onChange,
    id,
    disabled,
}: LevelSelectProps): React.JSX.Element {
    const [levels, setLevels] = useState<LevelSummary[]>([])
    const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

    useEffect(() => {
        let active = true
        setState('loading')
        loadLevels(getClientTenantHost())
            .then((loaded) => {
                if (active) {
                    setLevels(loaded)
                    setState('ready')
                }
            })
            .catch(() => {
                if (active) {
                    setState('error')
                }
            })

        return () => {
            active = false
        }
    }, [])

    const selectedValue = value === null ? PUBLIC_VALUE : String(value)
    const hasMissingValue =
        state === 'ready' &&
        value !== null &&
        !levels.some((level) => level.sortOrder === value)

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
                    {levels.map((level) => (
                        <option key={level.id} value={level.sortOrder}>
                            {level.title} ({level.sortOrder})
                        </option>
                    ))}
                </>
            )}
        </select>
    )
}
