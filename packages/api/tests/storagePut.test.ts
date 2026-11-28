import {createServer} from 'node:http'
import {Readable} from 'node:stream'
import {afterEach, describe, expect, it} from 'vitest'

import {spoolStreamToTempFile} from '../src/media/storagePut'

function bytesStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
    return Readable.toWeb(
        Readable.from(chunks.map((chunk) => Buffer.from(chunk))),
    ) as ReadableStream<Uint8Array>
}

describe('spoolStreamToTempFile', () => {
    const servers: Array<ReturnType<typeof createServer>> = []

    afterEach(async () => {
        await Promise.all(
            servers.splice(0).map(
                (server) =>
                    new Promise<void>((resolve, reject) => {
                        server.close((error) => (error ? reject(error) : resolve()))
                    }),
            ),
        )
    })

    it('spools the inbound body without requiring a storage drain', async () => {
        const payload = new Uint8Array([9, 8, 7, 6])
        const spool = await spoolStreamToTempFile(bytesStream([payload]), {
            idleTimeoutMs: 5_000,
            absoluteTimeoutMs: 5_000,
        })
        try {
            expect(spool.sizeBytes).toBe(4)
            expect(spool.path.length).toBeGreaterThan(0)
        } finally {
            await spool.cleanup()
        }
    })
})
