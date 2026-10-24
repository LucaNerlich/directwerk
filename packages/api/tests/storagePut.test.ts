import {createServer} from 'node:http'
import {Readable} from 'node:stream'
import {afterEach, describe, expect, it} from 'vitest'

import {putStreamToStorage, spoolStreamToTempFile} from '../src/media/storagePut'

function bytesStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
    return Readable.toWeb(
        Readable.from(chunks.map((chunk) => Buffer.from(chunk))),
    ) as ReadableStream<Uint8Array>
}

describe('spoolStreamToTempFile + putStreamToStorage', () => {
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

    it('PUTS the spooled body to object storage after ingest completes', async () => {
        const received: Buffer[] = []
        const server = createServer((req, res) => {
            req.on('data', (chunk: Buffer) => received.push(Buffer.from(chunk)))
            req.on('end', () => {
                res.statusCode = 200
                res.end()
            })
        })
        servers.push(server)
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
        const address = server.address()
        if (address === null || typeof address === 'string') {
            throw new Error('expected TCP address')
        }

        const payload = new Uint8Array([1, 2, 3, 4, 5])
        const result = await putStreamToStorage(
            `http://127.0.0.1:${address.port}/object`,
            {'Content-Type': 'application/octet-stream'},
            bytesStream([payload]),
            {idleTimeoutMs: 5_000, absoluteTimeoutMs: 5_000},
        )

        expect(result.status).toBe(200)
        expect(Buffer.concat(received).equals(Buffer.from(payload))).toBe(true)
    })
})
