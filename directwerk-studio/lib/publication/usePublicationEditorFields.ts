'use client'

import {useCallback, useState} from 'react'

import type {AccessPolicy} from '@directwerk/api/types'
import {
    fromDatetimeLocalValue,
    toDatetimeLocalValue,
} from '@directwerk/api/datetime/publicationSchedule'

export interface PublicationEditorFieldsState {
    accessPolicy: AccessPolicy
    setAccessPolicy: (value: AccessPolicy) => void
    requiredLevelSortOrder: number | null
    setRequiredLevelSortOrder: (value: number | null) => void
    notifySubscribers: boolean
    setNotifySubscribers: (value: boolean) => void
    scheduledAt: string
    setScheduledAt: (value: string) => void
    applyPublicationSchedule: (scheduledAtIso: string | null | undefined) => void
    parseScheduledAt: () => string | null
    scheduleValidationError: string | null
    setScheduleValidationError: (message: string | null) => void
}

export function usePublicationEditorFields(): PublicationEditorFieldsState {
    const [accessPolicy, setAccessPolicy] = useState<AccessPolicy>('FREE')
    const [requiredLevelSortOrder, setRequiredLevelSortOrder] = useState<number | null>(
        null,
    )
    const [notifySubscribers, setNotifySubscribers] = useState(false)
    const [scheduledAt, setScheduledAt] = useState('')
    const [scheduleValidationError, setScheduleValidationError] = useState<string | null>(
        null,
    )

    const applyPublicationSchedule = useCallback(
        (scheduledAtIso: string | null | undefined) => {
            setScheduledAt(toDatetimeLocalValue(scheduledAtIso))
        },
        [],
    )

    const parseScheduledAt = useCallback((): string | null => {
        return fromDatetimeLocalValue(scheduledAt)
    }, [scheduledAt])

    return {
        accessPolicy,
        setAccessPolicy,
        requiredLevelSortOrder,
        setRequiredLevelSortOrder,
        notifySubscribers,
        setNotifySubscribers,
        scheduledAt,
        setScheduledAt,
        applyPublicationSchedule,
        parseScheduledAt,
        scheduleValidationError,
        setScheduleValidationError,
    }
}
