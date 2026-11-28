import assert from 'node:assert/strict'
import {test} from 'node:test'

import {audioVisibility, day, parseFeedDate} from './feed-utils.mjs'

test('audio for a PAID show is uploaded private', () => {
    assert.equal(audioVisibility({accessPolicy: 'PAID'}), 'PRIVATE')
    assert.equal(audioVisibility({}), 'PRIVATE')
    assert.equal(audioVisibility({accessPolicy: 'FREE'}), 'PUBLIC')
})

test('day tolerates a missing publish date', () => {
    assert.equal(day('2026-11-28T10:00:00.000Z'), '2026-11-28')
    assert.equal(day(null), '')
    assert.equal(day(undefined), '')
})

test('parseFeedDate rejects missing and malformed dates', () => {
    assert.equal(parseFeedDate('Sat, 28 Nov 2026 10:00:00 GMT'), '2026-11-28T10:00:00.000Z')
    assert.equal(parseFeedDate(''), null)
    assert.equal(parseFeedDate(undefined), null)
    assert.equal(parseFeedDate('not a date'), null)
})
