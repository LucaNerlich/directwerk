import {describe, expect, it} from 'vitest'

import {articlePublishBlockReason} from '@/lib/write/articlePreflight'

describe('articlePublishBlockReason', () => {
    it('blocks empty title', () => {
        expect(
            articlePublishBlockReason({title: '  ', body: '<p>Text</p>'}),
        ).toBe('Titel fehlt.')
    })

    it('blocks empty body', () => {
        expect(
            articlePublishBlockReason({title: 'Titel', body: '<p></p>'}),
        ).toBe('Beitragstext fehlt.')
    })

    it('allows valid draft', () => {
        expect(
            articlePublishBlockReason({title: 'Titel', body: '<p>Inhalt</p>'}),
        ).toBeNull()
    })
})
