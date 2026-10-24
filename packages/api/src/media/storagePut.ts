import 'server-only'

import {randomUUID} from 'node:crypto'
import {createReadStream, createWriteStream} from 'node:fs'
import {unlink} from 'node:fs/promises'
import {request as httpRequest} from 'node:http'
import {request as httpsRequest} from 'node:https'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {Readable} from 'node:stream'
import {pipeline} from 'node:stream/promises'
import type {ReadableStream as NodeWebReadableStream} from 'node:stream/web'

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

export interface SpoolResult {
    path: string
    sizeBytes: number
    cleanup: () => Promise<void>
}

function timeoutError(message: string): Error {
    const error = new Error(message)
    error.name = 'TimeoutError'
    return error
}

/**
 * Spools an inbound upload body to a temp file as fast as the client/proxy can
 * deliver it — without waiting on object-storage drain.
 *
 * Coolify Traefik’s entrypoint `readTimeout` (often ~60s) covers the *entire*
 * browser→Studio request body. The previous end-to-end stream applied S3
 * backpressure to that same read, so a multi‑hundred‑MB PUT that took longer
 * than ~60s of S3-bound wall clock became a bare gateway 502. Spooling first
 * lets Traefik finish at edge-network speed; the slower S3 PUT happens after.
 */
export async function spoolStreamToTempFile(
    body: ReadableStream<Uint8Array>,
    timeouts: StoragePutTimeouts,
    signal?: AbortSignal,
): Promise<SpoolResult> {
    const path = join(tmpdir(), `directwerk-upload-${randomUUID()}`)
    const debug = uploadDebugEnabled()
    if (debug) {
        logUploadDebug('spool to temp started')
    }

    let sizeBytes = 0
    let lastActivity = Date.now()
    let idleTimer: ReturnType<typeof setInterval> | undefined
    let absoluteTimer: ReturnType<typeof setTimeout> | undefined

    const cleanup = async (): Promise<void> => {
        try {
            await unlink(path)
        } catch {
            // Best-effort: file may not exist yet or already removed.
        }
    }

    const nodeReadable = Readable.fromWeb(body as NodeWebReadableStream)
    const writeStream = createWriteStream(path)

    const abortWith = (error: Error): void => {
        nodeReadable.destroy(error)
        writeStream.destroy(error)
    }

    nodeReadable.on('data', (chunk: Buffer | Uint8Array) => {
        sizeBytes += chunk.byteLength
        lastActivity = Date.now()
    })

    idleTimer = setInterval(() => {
        if (Date.now() - lastActivity >= timeouts.idleTimeoutMs) {
            abortWith(timeoutError('Inbound upload stalled (idle timeout while spooling)'))
        }
    }, Math.min(1_000, Math.max(100, timeouts.idleTimeoutMs)))

    absoluteTimer = setTimeout(() => {
        abortWith(timeoutError('Inbound upload timed out while spooling'))
    }, timeouts.absoluteTimeoutMs)

    const onAbort = (): void => {
        abortWith(
            signal?.reason instanceof Error
                ? signal.reason
                : new Error('Upload spool aborted'),
        )
    }
    if (signal !== undefined) {
        if (signal.aborted) {
            onAbort()
        } else {
            signal.addEventListener('abort', onAbort, {once: true})
        }
    }

    try {
        await pipeline(nodeReadable, writeStream)
        if (debug) {
            logUploadDebug(`spool to temp finished: ${sizeBytes} bytes`)
        }
        return {path, sizeBytes, cleanup}
    } catch (error) {
        await cleanup()
        throw error
    } finally {
        if (idleTimer !== undefined) {
            clearInterval(idleTimer)
        }
        if (absoluteTimer !== undefined) {
            clearTimeout(absoluteTimer)
        }
        signal?.removeEventListener('abort', onAbort)
    }
}

/**
 * PUTs a local file to an object-storage URL (presigned, typically without a
 * signed Content-Length — chunked streaming is the supported wire shape).
 */
export async function putFileToStorage(
    uploadUrl: string,
    headers: Record<string, string>,
    filePath: string,
    timeouts: StoragePutTimeouts,
): Promise<StoragePutResult> {
    const targetUrl = new URL(uploadUrl)
    const request = targetUrl.protocol === 'https:' ? httpsRequest : httpRequest
    const fileStream = createReadStream(filePath)

    const debug = uploadDebugEnabled()
    const debugHost = debug ? uploadDebugHost(uploadUrl) : ''
    if (debug) {
        logUploadDebug(`PUT file to ${debugHost} started`)
    }

    return new Promise<StoragePutResult>((resolve, reject) => {
        let settled = false
        let sentBytes = 0
        let nextProgressLog = UPLOAD_PROGRESS_LOG_BYTES
        let drainWaits = 0

        const settle = (fn: () => void): void => {
            if (!settled) {
                settled = true
                fileStream.destroy()
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

        upstreamRequest.on('socket', (socket) => {
            socket.setTimeout(timeouts.idleTimeoutMs)
            socket.on('timeout', () => {
                if (debug) {
                    logUploadDebug(
                        `storage PUT to ${debugHost} tripped the idle timeout at ${sentBytes} bytes`,
                    )
                }
                upstreamRequest.destroy(timeoutError('Upstream request stalled (idle timeout)'))
            })
        })

        const absoluteTimer = setTimeout(() => {
            upstreamRequest.destroy(timeoutError('Upstream request timed out'))
        }, timeouts.absoluteTimeoutMs)

        upstreamRequest.on('error', (error) => {
            clearTimers()
            if (debug) {
                const detail =
                    error instanceof Error ? `${error.name}: ${error.message}` : String(error)
                logUploadDebug(
                    `storage PUT to ${debugHost} errored after ${sentBytes} bytes: ${detail}`,
                )
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

        fileStream.on('error', (error) => {
            upstreamRequest.destroy(error)
        })
        fileStream.on('data', (chunk: string | Buffer) => {
            const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
            sentBytes += buf.byteLength
            if (debug && sentBytes >= nextProgressLog) {
                logUploadDebug(
                    `storage PUT to ${debugHost} progress: ${Math.round(sentBytes / (1024 * 1024))} MiB`,
                )
                nextProgressLog += UPLOAD_PROGRESS_LOG_BYTES
            }
            if (!upstreamRequest.write(buf)) {
                drainWaits += 1
                if (debug && drainWaits === 1) {
                    logUploadDebug(
                        `storage PUT to ${debugHost} paused for drain at ${sentBytes} bytes (storage-side backpressure)`,
                    )
                }
                fileStream.pause()
                upstreamRequest.once('drain', () => {
                    fileStream.resume()
                })
            }
        })
        fileStream.on('end', () => {
            if (!settled) {
                if (debug) {
                    logUploadDebug(
                        `storage PUT to ${debugHost} request fully sent: ${sentBytes} bytes, ${drainWaits} drain waits`,
                    )
                }
                upstreamRequest.end()
            }
        })
    })
}

/**
 * Ingests the browser/proxy body to a temp file, then PUTs that file to object
 * storage. Decouples Coolify Traefik’s request-body `readTimeout` from S3
 * throughput (see {@link spoolStreamToTempFile}).
 *
 * Prefer {@link spoolStreamToTempFile} + {@link putFileToStorage} when the
 * caller can overlap spooling with `upload-url` (see `performMediaUpload`).
 */
export async function putStreamToStorage(
    uploadUrl: string,
    headers: Record<string, string>,
    body: ReadableStream<Uint8Array>,
    timeouts: StoragePutTimeouts,
): Promise<StoragePutResult> {
    const spool = await spoolStreamToTempFile(body, timeouts)
    try {
        return await putFileToStorage(uploadUrl, headers, spool.path, timeouts)
    } finally {
        await spool.cleanup()
    }
}
