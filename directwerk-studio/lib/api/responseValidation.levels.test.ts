import {describe, expect, it} from 'vitest'

import {parseLevelListEnvelope} from '@/lib/api/responseValidation'

describe('level parsers', () => {
    it('parses a level list envelope', () => {
        const parsed = parseLevelListEnvelope({
            statusCode: 200,
            statusMessage: 'OK',
            data: [
                {id: 1, slug: 'fan', title: 'Fan', sortOrder: 10},
                {id: 2, slug: 'supporter', title: 'Supporter', sortOrder: 20},
            ],
            errors: [],
            metadata: {},
        })

        expect(parsed?.data).toHaveLength(2)
        expect(parsed?.data[0]).toEqual({id: 1, slug: 'fan', title: 'Fan', sortOrder: 10})
        expect(parsed?.data[1]).toEqual({
            id: 2,
            slug: 'supporter',
            title: 'Supporter',
            sortOrder: 20,
        })
    })

    it('rejects a level with a negative sortOrder', () => {
        const parsed = parseLevelListEnvelope({
            statusCode: 200,
            statusMessage: 'OK',
            data: [{id: 1, slug: 'fan', title: 'Fan', sortOrder: -1}],
            errors: [],
            metadata: {},
        })

        expect(parsed).toBeNull()
    })

    it('rejects a non-array data payload', () => {
        expect(
            parseLevelListEnvelope({
                statusCode: 200,
                statusMessage: 'OK',
                data: {},
                errors: [],
                metadata: {},
            }),
        ).toBeNull()
    })
})
