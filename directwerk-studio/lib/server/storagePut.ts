import 'server-only'

import {request as httpRequest} from 'node:http'
import {request as httpsRequest} from 'node:https'

export interface StoragePutResult {
    status: number
}

/**
 * PUTs a web ReadableStream to an object-storage URL, applying backpressure so
 * the source is only read as fast as the storage socket drains. This keeps the
 * upload fully streaming (no full-body buffering) and couples the browser
 * upload to the actual object-storage throughput.
 */
export async function putStreamToStorage(
    uploadUrl: string,
    headers: Record<string, string>,
    body: ReadableStream<Uint8Array>,
    timeoutMs: number,
): Promise<StoragePutResult> {
    const targetUrl = new URL(uploadUrl)
    const request = targetUrl.protocol === 'https:' ? httpsRequest : httpRequest

    return new Promise<StoragePutResult>((resolve, reject) => {
        let settled = false
        const settle = (fn: () => void): void => {
            if (!settled) {
                settled = true
                fn()
            }
        }

        const upstreamRequest = request(
            targetUrl,
            {method: 'PUT', headers},
            (response) => {
                response.resume()
                settle(() => resolve({status: response.statusCode ?? 0}))
            },
        )

        const timeout = setTimeout(() => {
            const error = new Error('Upstream request timed out')
            error.name = 'TimeoutError'
            upstreamRequest.destroy(error)
        }, timeoutMs)

        upstreamRequest.on('error', (error) => {
            clearTimeout(timeout)
            settle(() => reject(error))
        })
        upstreamRequest.on('close', () => {
            clearTimeout(timeout)
        })

        const reader = body.getReader()

        const pump = async (): Promise<void> => {
            try {
                while (true) {
                    const {done, value} = await reader.read()
                    if (done) {
                        break
                    }
                    if (!upstreamRequest.write(value)) {
                        await new Promise<void>((resume) => {
                            upstreamRequest.once('drain', resume)
                            upstreamRequest.once('close', resume)
                        })
                    }
                }
                upstreamRequest.end()
            } catch (error) {
                upstreamRequest.destroy(
                    error instanceof Error ? error : new Error('Upload stream failed'),
                )
            }
        }

        void pump()
    })
}
