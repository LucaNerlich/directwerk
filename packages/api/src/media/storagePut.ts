import 'server-only'

import {request as httpRequest} from 'node:http'
import {request as httpsRequest} from 'node:https'

import {logUploadDebug, uploadDebugHost, uploadDebugEnabled, UPLOAD_PROGRESS_LOG_BYTES} from './uploadDebug'

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
 *
 * The presigned target is signed without `Content-Length` (see the API's
 * `UploadService`), so chunked streaming is the supported wire shape.
 */
export async function putStreamToStorage(
    uploadUrl: string,
    headers: Record<string, string>,
    body: ReadableStream<Uint8Array>,
    timeouts: StoragePutTimeouts,
): Promise<StoragePutResult> {
    const targetUrl = new URL(uploadUrl)
    const request = targetUrl.protocol === 'https:' ? httpsRequest : httpRequest

    // Debug-gated leg instrumentation: which socket/major checkpoint stopped
    // moving is exactly what a cloud-only upload stall hides (no runtime logs).
    const debug = uploadDebugEnabled()
    const debugHost = debug ? uploadDebugHost(uploadUrl) : ''
    if (debug) {
        logUploadDebug(`PUT to ${debugHost} started`)
    }

    return new Promise<StoragePutResult>((resolve, reject) => {
        let settled = false
        const reader = body.getReader()
        let sentBytes = 0
        let nextProgressLog = UPLOAD_PROGRESS_LOG_BYTES
        let drainWaits = 0

        const settle = (fn: () => void): void => {
            if (!settled) {
                settled = true
                // Stop consuming the client upload as soon as the request has
                // settled — including idle/absolute timeout paths — so the
                // pump does not keep pulling and writing into a dead request.
                reader.cancel().catch(() => {})
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
                if (debug) {
                    logUploadDebug(
                        `storage answered HTTP ${response.statusCode} for ${debugHost} after ${sentBytes} bytes`,
                    )
                }
                settle(() => resolve({status: response.statusCode ?? 0}))
            },
        )

        // Idle watchdog: Node's socket timeout only fires when the socket has
        // been inactive for the full window, so steady progress on a large
        // upload never triggers it.
        upstreamRequest.on('socket', (socket) => {
            socket.setTimeout(timeouts.idleTimeoutMs)
            socket.on('timeout', () => {
                if (debug) {
                    logUploadDebug(
                        `storage PUT to ${debugHost} tripped the idle timeout at ${sentBytes} bytes`,
                    )
                }
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
            if (debug) {
                const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
                logUploadDebug(`storage PUT to ${debugHost} errored after ${sentBytes} bytes: ${detail}`)
            }
            settle(() => reject(error))
        })
        upstreamRequest.on('close', () => {
            clearTimers()
            if (debug && !settled) {
                logUploadDebug(`storage PUT to ${debugHost} socket closed early at ${sentBytes} bytes`)
            }
            settle(() =>
                reject(new Error('Upstream connection closed before completing the upload')),
            )
        })

        const pump = async (): Promise<void> => {
            try {
                while (true) {
                    if (settled) {
                        return
                    }
                    const {done, value} = await reader.read()
                    if (done || settled) {
                        break
                    }
                    sentBytes += value.byteLength
                    if (debug && sentBytes >= nextProgressLog) {
                        logUploadDebug(
                            `storage PUT to ${debugHost} progress: ${Math.round(sentBytes / (1024 * 1024))} MiB`,
                        )
                        nextProgressLog += UPLOAD_PROGRESS_LOG_BYTES
                    }
                    if (!upstreamRequest.write(value)) {
                        drainWaits += 1
                        if (debug && drainWaits === 1) {
                            logUploadDebug(
                                `storage PUT to ${debugHost} paused for drain at ${sentBytes} bytes (storage-side backpressure)`,
                            )
                        }
                        await new Promise<void>((resume) => {
                            upstreamRequest.once('drain', resume)
                            upstreamRequest.once('close', resume)
                        })
                    }
                }
                if (!settled) {
                    if (debug) {
                        logUploadDebug(
                            `storage PUT to ${debugHost} request fully sent: ${sentBytes} bytes, ${drainWaits} drain waits`,
                        )
                    }
                    upstreamRequest.end()
                }
            } catch (error) {
                upstreamRequest.destroy(
                    error instanceof Error ? error : new Error('Upload stream failed'),
                )
            }
        }

        void pump()
    })
}
