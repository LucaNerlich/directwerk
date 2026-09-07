import {afterEach, describe, expect, it, vi} from 'vitest'

import {deltaPercent, parseUmamiStats} from '@/lib/api/umamiApi'

afterEach(() => {
    vi.clearAllMocks()
})

function umamiPayload() {
    return {
        data: {
            range: '30d',
            startAt: 1,
            endAt: 2,
            stats: {
                pageviews: 100,
                visitors: 40,
                visits: 50,
                bounces: 10,
                totaltime: 3600,
                comparison: {
                    pageviews: 80,
                    visitors: 30,
                    visits: 40,
                    bounces: 8,
                    totaltime: 3000,
                },
            },
            pageviews: {
                pageviews: [{x: '2026-08-01T00:00:00Z', y: 5}],
                sessions: [{x: '2026-08-01T00:00:00Z', y: 2}],
            },
        },
    }
}

describe('parseUmamiStats', () => {
    it('parses a stats + pageviews payload', () => {
        const stats = parseUmamiStats(umamiPayload())

        expect(stats?.range).toBe('30d')
        expect(stats?.stats.visitors).toBe(40)
        expect(stats?.stats.comparison?.pageviews).toBe(80)
        expect(stats?.pageviews).toEqual([{t: '2026-08-01T00:00:00Z', y: 5}])
    })

    it('rejects unknown ranges and malformed series', () => {
        expect(parseUmamiStats({data: {range: '1h'}})).toBeNull()
        expect(
            parseUmamiStats({
                data: {
                    range: '7d',
                    stats: {pageviews: 1, visitors: 1, visits: 1, bounces: 0},
                    pageviews: {pageviews: [{x: 'x'}], sessions: []},
                },
            }),
        ).toBeNull()
        expect(parseUmamiStats(null)).toBeNull()
    })

    it('rejects overflowing metrics that JSON parses as Infinity', () => {
        const overflow = JSON.parse('1e309') as number
        expect(overflow).toBe(Number.POSITIVE_INFINITY)

        const summary = umamiPayload()
        summary.data.stats.pageviews = overflow
        expect(parseUmamiStats(summary)).toBeNull()

        const totalTime = umamiPayload()
        totalTime.data.stats.totaltime = overflow
        expect(parseUmamiStats(totalTime)).toBeNull()

        const comparison = umamiPayload()
        comparison.data.stats.comparison.visits = overflow
        expect(parseUmamiStats(comparison)).toBeNull()

        const series = umamiPayload()
        series.data.pageviews.sessions[0]!.y = overflow
        expect(parseUmamiStats(series)).toBeNull()
    })
})

describe('deltaPercent', () => {
    it('computes rounded change and guards division by zero', () => {
        expect(deltaPercent(150, 100)).toBe(50)
        expect(deltaPercent(50, 100)).toBe(-50)
        expect(deltaPercent(10, 0)).toBeNull()
        expect(deltaPercent(Number.NaN, 100)).toBeNull()
    })
})
