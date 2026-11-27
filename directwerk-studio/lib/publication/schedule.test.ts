import {describe, expect, it} from 'vitest'

import {scheduleValidationMessage} from './schedule'

describe('scheduleValidationMessage', () => {
    it('rejects an unparsable instant', () => {
        expect(scheduleValidationMessage(null)).toMatch(/gültigen Zeitpunkt/)
    })

    it('rejects a past instant and accepts a future one', () => {
        expect(scheduleValidationMessage('2020-01-01T00:00:00.000Z')).toMatch(/Zukunft/)
        expect(scheduleValidationMessage(new Date(Date.now() + 60_000).toISOString())).toBeNull()
    })
})
