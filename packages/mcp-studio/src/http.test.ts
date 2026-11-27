import assert from 'node:assert/strict'
import {test} from 'node:test'

import {loopbackTransportOptions} from './http.js'

test('loopback transport rejects a rebinding Host or Origin', () => {
    const options = loopbackTransportOptions(3100)

    // Without these the SDK answers any Host, so a DNS-rebound page could drive the tenant key.
    assert.equal(options.enableDnsRebindingProtection, true)
    assert.deepEqual(options.allowedHosts, [
        '127.0.0.1:3100',
        'localhost:3100',
        '[::1]:3100',
    ])
    assert.deepEqual(options.allowedOrigins, [
        'http://127.0.0.1:3100',
        'http://localhost:3100',
        'http://[::1]:3100',
    ])
})
