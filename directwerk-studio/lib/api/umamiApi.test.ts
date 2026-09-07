import {afterEach, describe, expect, it, vi} from 'vitest'

import {deltaPercent, parseUmamiStats} from '@/lib/api/umamiApi'

afterEach(() => {
    vi.clearAllMocks()
})

describe('parseUmamiStats', () => {
    it('parses a stats + pageviews payload', () => {
        const stats = parseUmamiStats({
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
                    pageviews: [{t: '2026-08-01T00:00:00Z', y: 5}],
                    sessions: [{t: '2026-08-01T00:00:00Z', y: 2}],
                },
            },
        })

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
                    pageviews: {pageviews: [{t: 'x'}], sessions: []},
                },
            }),
        ).toBeNull()
        expect(parseUmamiStats(null)).toBeNull()
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
