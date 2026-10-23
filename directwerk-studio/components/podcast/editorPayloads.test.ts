import {describe, expect, it} from 'vitest'

import {formatFields} from '@/components/podcast/FormatEditor'
import {seriesUpdatePayload} from '@/components/podcast/SeriesEditor'

describe('editor payloads keep cleared text fields', () => {
    it('sends an emptied format description as an empty string', () => {
        const payload = formatFields({
            name: 'Interview',
            description: '   ',
            requiredLevelSortOrder: undefined,
            sortOrder: '',
            coverAssetId: undefined,
        } as never)

        expect(payload.description).toBe('')
    })

    it('sends emptied series description and iTunes category as empty strings', () => {
        const payload = seriesUpdatePayload(
            {
                title: 'Sendung',
                slug: 'sendung',
                description: '  ',
                language: 'de',
                itunesCategory: '',
                itunesExplicit: false,
                coverAssetId: null,
                defaultRequiredLevelSortOrder: undefined,
            } as never,
            'DRAFT' as never,
        )

        expect(payload.description).toBe('')
        expect(payload.itunesCategory).toBe('')
    })
})
