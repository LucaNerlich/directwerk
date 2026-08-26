import 'server-only'

import {request as httpRequest} from 'node:http'
import {request as httpsRequest} from 'node:https'

export type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ServerTransportRequest {
    targetUrl: URL
    tenantHost?: string
    method: HttpMethod
    authorization?: string
    body?: string
    contentType?: 'application/json' | 'application/x-www-form-urlencoded'
}

export interface ServerTransportConfig {
    /**
     * Require a tenant host for every request and use it verbatim as the
     * upstream Host header (directwerk-admin behaviour). When false, the
     * target URL's own host is used unless a tenant host is supplied.
     */
    requireTenantHost?: boolean
    /** Upstream response byte cap. Default 1 MiB. */
    maxResponseBytes?: number
    /** Wall-clock and idle timeout for upstream requests. Default 10 s. */
    timeoutMs?: number
    /**
     * Send an explicit Content-Length header for bodies
     * (directwerk-admin behaviour).
     */
    forwardContentLength?: boolean
}

const DEFAULT_MAX_RESPONSE_BYTES = 1_048_576
const DEFAULT_TIMEOUT_MS = 10_000

function isLoopbackHostname(hostname: string): boolean {
    return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '[::1]'
    )
}

/**
 * Builds the node:http(s)-based SSRF-guarded server transport shared by the
 * BFF route handlers.
 *
 * Guarantees (identical across all three apps):
 * - HTTPS only, except plain HTTP to loopback hosts
 * - Host-header rewrite so multi-tenant upstream routing works
 * - Hard response byte cap and wall-clock timeout
 */
export function createServerTransport(
    config: ServerTransportConfig = {},
): (request: ServerTransportRequest) => Promise<Response> {
    const maxResponseBytes = config.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES
    const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS

    return function requestWithTenantHost({
        targetUrl,
        tenantHost,
        method,
        authorization,
        body,
        contentType,
    }: ServerTransportRequest): Promise<Response> {
        const isLoopback = isLoopbackHostname(targetUrl.hostname)

        if (
            targetUrl.protocol !== 'https:' &&
            !(targetUrl.protocol === 'http:' && isLoopback)
        ) {
            return Promise.reject(
                new Error('Non-HTTPS URLs are not allowed except for loopback hosts.'),
            )
        }

        if (config.requireTenantHost === true && !tenantHost) {
            return Promise.reject(new Error('A tenant host is required.'))
        }

        const request = targetUrl.protocol === 'https:' ? httpsRequest : httpRequest
        const hostHeader =
            config.requireTenantHost === true
                ? (tenantHost as string)
                : (tenantHost ?? targetUrl.host)

        return new Promise<Response>((resolve, reject) => {
            let resolved = false
            const wallClockTimeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true
                    upstreamRequest.destroy(new Error('Upstream request deadline exceeded'))
                    reject(new Error('Upstream request deadline exceeded'))
                }
            }, timeoutMs)

            const cleanup = () => {
                if (!resolved) {
                    resolved = true
                    clearTimeout(wallClockTimeout)
                }
            }

            const upstreamRequest = request(
                targetUrl,
                {
                    method,
                    headers: {
                        Accept: 'application/json',
                        Host: hostHeader,
                        ...(authorization === undefined
                            ? {}
                            : {Authorization: authorization}),
                        ...(contentType === undefined ? {} : {'Content-Type': contentType}),
                        ...(config.forwardContentLength === true && body !== undefined
                            ? {'Content-Length': Buffer.byteLength(body)}
                            : {}),
                    },
                },
                (upstreamResponse) => {
                    const chunks: Buffer[] = []
                    let totalBytes = 0

                    upstreamResponse.on('data', (chunk: Buffer) => {
                        totalBytes += chunk.byteLength
                        if (totalBytes > maxResponseBytes) {
                            upstreamResponse.destroy(
                                new Error('Upstream response exceeded the size limit'),
                            )
                            return
                        }
                        chunks.push(chunk)
                    })
                    upstreamResponse.on('error', (error) => {
                        cleanup()
                        reject(error)
                    })
                    upstreamResponse.on('end', () => {
                        cleanup()
                        const responseBody =
                            chunks.length === 0 ? null : Buffer.concat(chunks)
                        const responseHeaders = new Headers()
                        const responseContentType =
                            upstreamResponse.headers['content-type']
                        if (typeof responseContentType === 'string') {
                            responseHeaders.set('Content-Type', responseContentType)
                        }

                        resolve(
                            new Response(responseBody, {
                                status: upstreamResponse.statusCode ?? 502,
                                headers: responseHeaders,
                            }),
                        )
                    })
                },
            )

            upstreamRequest.setTimeout(timeoutMs, () => {
                cleanup()
                upstreamRequest.destroy(new Error('Upstream request timed out'))
            })
            upstreamRequest.on('error', (error) => {
                cleanup()
                reject(error)
            })

            if (body !== undefined) {
                upstreamRequest.write(body)
            }
            upstreamRequest.end()
        })
    }
}
