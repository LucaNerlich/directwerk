import 'server-only'

import {request as httpRequest} from 'node:http'
import {request as httpsRequest} from 'node:https'

export interface StoragePutResult {
    status: number
}

export interface StoragePutTimeouts {
    /**
     * Maximum inactivity window: if nothing happens on the storage socket for
     * this long, the upload is treated as stalled and aborted. Activity
     * (progress on a large transfer) keeps resetting it, so legitimate
     * multi-minute uploads are not cut off mid-flight.
     */
    idleTimeoutMs: number
    /**
     * Absolute ceiling regardless of progress — protects against a trickle
     * stream that never stalls for long enough to trip the idle timeout.
     */
    absoluteTimeoutMs: number
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
    timeouts: StoragePutTimeouts,
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
        const clearTimers = (): void => {
            clearTimeout(absoluteTimer)
        }

        const upstreamRequest = request(
            targetUrl,
            {method: 'PUT', headers},
            (response) => {
                response.resume()
                clearTimers()
                settle(() => resolve({status: response.statusCode ?? 0}))
            },
        )

        // Idle watchdog: Node's socket timeout only fires when the socket has
        // been inactive for the full window, so steady progress on a large
        // upload never triggers it.
        upstreamRequest.on('socket', (socket) => {
            socket.setTimeout(timeouts.idleTimeoutMs)
            socket.on('timeout', () => {
                const error = new Error('Upstream request stalled (idle timeout)')
                error.name = 'TimeoutError'
                upstreamRequest.destroy(error)
            })
        })

        const absoluteTimer = setTimeout(() => {
            const error = new Error('Upstream request timed out')
            error.name = 'TimeoutError'
            upstreamRequest.destroy(error)
        }, timeouts.absoluteTimeoutMs)

        upstreamRequest.on('error', (error) => {
            clearTimers()
            settle(() => reject(error))
        })
        upstreamRequest.on('close', () => {
            clearTimers()
            settle(() =>
                reject(new Error('Upstream connection closed before completing the upload')),
            )
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
