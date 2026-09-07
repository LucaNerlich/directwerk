'use client'

import {authenticatedRequest} from './studioApiCore'

export type UmamiRange = '7d' | '30d' | '12m'

export const UMAMI_RANGES: {value: UmamiRange; label: string}[] = [
    {value: '7d', label: '7 Tage'},
    {value: '30d', label: '30 Tage'},
    {value: '12m', label: '12 Monate'},
]

export interface UmamiStatsSummary {
    pageviews: number
    visitors: number
    visits: number
    bounces: number
    totaltime: number | null
    comparison: {
        pageviews: number
        visitors: number
        visits: number
        bounces: number
        totaltime: number
    } | null
}

export interface UmamiSeriesPoint {
    t: string
    y: number
}

export interface UmamiStats {
    range: UmamiRange
    stats: UmamiStatsSummary
    pageviews: UmamiSeriesPoint[]
    sessions: UmamiSeriesPoint[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

function isNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value)
}

function parseComparison(value: unknown): UmamiStatsSummary['comparison'] {
    if (!isRecord(value)) {
        return null
    }
    if (
        !isNumber(value.pageviews) ||
        !isNumber(value.visitors) ||
        !isNumber(value.visits) ||
        !isNumber(value.bounces) ||
        !isNumber(value.totaltime)
    ) {
        return null
    }
    return {
        pageviews: value.pageviews,
        visitors: value.visitors,
        visits: value.visits,
        bounces: value.bounces,
        totaltime: value.totaltime,
    }
}

function parseSummary(value: unknown): UmamiStatsSummary | null {
    if (!isRecord(value)) {
        return null
    }
    if (
        !isNumber(value.pageviews) ||
        !isNumber(value.visitors) ||
        !isNumber(value.visits) ||
        !isNumber(value.bounces)
    ) {
        return null
    }
    return {
        pageviews: value.pageviews,
        visitors: value.visitors,
        visits: value.visits,
        bounces: value.bounces,
        totaltime: isNumber(value.totaltime) ? value.totaltime : null,
        comparison: parseComparison(value.comparison),
    }
}

function parseSeries(value: unknown): UmamiSeriesPoint[] | null {
    if (!Array.isArray(value)) {
        return null
    }
    const points: UmamiSeriesPoint[] = []
    for (const entry of value) {
        if (!isRecord(entry) || typeof entry.t !== 'string' || !isNumber(entry.y)) {
            return null
        }
        points.push({t: entry.t, y: entry.y})
    }
    return points
}

export function parseUmamiStats(value: unknown): UmamiStats | null {
    if (!isRecord(value) || !isRecord(value.data)) {
        return null
    }
    const data = value.data
    if (data.range !== '7d' && data.range !== '30d' && data.range !== '12m') {
        return null
    }
    const stats = parseSummary(data.stats)
    if (stats === null || !isRecord(data.pageviews)) {
        return null
    }
    const pageviews = parseSeries(data.pageviews.pageviews)
    const sessions = parseSeries(data.pageviews.sessions)
    if (pageviews === null || sessions === null) {
        return null
    }
    return {range: data.range, stats, pageviews, sessions}
}

/** Percent change of current vs previous period; null when not computable. */
export function deltaPercent(current: number, previous: number): number | null {
    if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) {
        return null
    }
    return Math.round(((current - previous) / previous) * 100)
}

const invalidStatsMessage = 'Der Server hat ungültige Umami-Kennzahlen gesendet.'

export async function getUmamiStats(
    tenantHost: string,
    range: UmamiRange,
): Promise<UmamiStats> {
    const payload = await authenticatedRequest(
        `/api/umami/stats?range=${range}`,
        tenantHost,
    )
    const stats = parseUmamiStats(payload)
    if (stats === null) {
        throw new Error(invalidStatsMessage)
    }
    return stats
}
