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

function parseComparison(value: unknown): UmamiStatsSummary['comparison'] {
    if (typeof value !== 'object' || value === null) {
        return null
    }
    const {pageviews, visitors, visits, bounces, totaltime} = value as Record<string, unknown>
    if (
        typeof pageviews !== 'number' ||
        typeof visitors !== 'number' ||
        typeof visits !== 'number' ||
        typeof bounces !== 'number' ||
        typeof totaltime !== 'number'
    ) {
        return null
    }
    return {pageviews, visitors, visits, bounces, totaltime}
}

function parseSummary(value: unknown): UmamiStatsSummary | null {
    if (typeof value !== 'object' || value === null) {
        return null
    }
    const {pageviews, visitors, visits, bounces, totaltime, comparison} = value as Record<string, unknown>
    if (
        typeof pageviews !== 'number' ||
        typeof visitors !== 'number' ||
        typeof visits !== 'number' ||
        typeof bounces !== 'number'
    ) {
        return null
    }
    return {
        pageviews,
        visitors,
        visits,
        bounces,
        totaltime: typeof totaltime === 'number' ? totaltime : null,
        comparison: parseComparison(comparison),
    }
}

function parseSeries(value: unknown): UmamiSeriesPoint[] | null {
    if (!Array.isArray(value)) {
        return null
    }
    const points: UmamiSeriesPoint[] = []
    for (const entry of value) {
        if (typeof entry !== 'object' || entry === null) {
            return null
        }
        // Umami's own field name is `x`, not `t` — this is the sole place that
        // reads the raw upstream field name.
        const {x, y} = entry as Record<string, unknown>
        if (typeof x !== 'string' || typeof y !== 'number') {
            return null
        }
        points.push({t: x, y})
    }
    return points
}

export function parseUmamiStats(value: unknown): UmamiStats | null {
    if (typeof value !== 'object' || value === null) {
        return null
    }
    const data = (value as Record<string, unknown>).data
    if (typeof data !== 'object' || data === null) {
        return null
    }
    const {range, stats: rawStats, pageviews: rawPageviews} = data as Record<string, unknown>
    if (range !== '7d' && range !== '30d' && range !== '12m') {
        return null
    }
    const stats = parseSummary(rawStats)
    if (stats === null || typeof rawPageviews !== 'object' || rawPageviews === null) {
        return null
    }
    const {pageviews: rawPageviewSeries, sessions: rawSessionSeries} = rawPageviews as Record<string, unknown>
    const pageviews = parseSeries(rawPageviewSeries)
    const sessions = parseSeries(rawSessionSeries)
    if (pageviews === null || sessions === null) {
        return null
    }
    return {range, stats, pageviews, sessions}
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
