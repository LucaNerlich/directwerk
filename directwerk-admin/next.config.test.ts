import {describe, expect, it} from 'vitest'

import nextConfig from './next.config'
import {MAX_UPLOAD_BYTES} from './lib/uploadLimits'

function toMegabytes(limit: string | number | undefined): number {
    if (typeof limit === 'number') {
        return limit / (1024 * 1024)
    }
    return Number.parseFloat(limit ?? '0')
}

describe('admin next config (#1016)', () => {
    it('keeps both body limits above the 10 MB upload cap', () => {
        const experimental = nextConfig.experimental
        expect(toMegabytes(experimental?.serverActions?.bodySizeLimit)).toBeGreaterThan(
            MAX_UPLOAD_BYTES / (1024 * 1024),
        )
        expect(toMegabytes(experimental?.proxyClientMaxBodySize)).toBeGreaterThan(
            MAX_UPLOAD_BYTES / (1024 * 1024),
        )
    })
})
