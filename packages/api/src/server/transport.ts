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
    /**
     * Skip TLS certificate verification for HTTPS upstreams.
     * Prefer an internal `http://` API URL in production; use only for
     * self-signed staging certs (`DIRECTWERK_UPSTREAM_TLS_INSECURE=true`).
     */
    tlsInsecure?: boolean
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

export interface UpstreamTenantHeaders {
    host: string
    forwardedHost?: string
}

/**
 * Chooses upstream Host / X-Forwarded-Host for tenant-scoped BFF calls.
 *
 * Plain HTTP (local / Docker network): rewrite Host so Spring resolves the
 * tenant with `forward-headers-strategy=none`.
 *
 * HTTPS through a reverse proxy: keep the API hostname on Host and send the
 * tenant domain via X-Forwarded-Host (requires API `forward-headers-strategy=framework`).
 */
export function buildUpstreamTenantHeaders(
    targetUrl: URL,
    tenantHost: string | undefined,
    requireTenantHost: boolean,
): UpstreamTenantHeaders {
    if (requireTenantHost && tenantHost === undefined) {
        throw new Error('A tenant host is required.')
    }

    const effectiveTenantHost = requireTenantHost ? tenantHost : tenantHost
    if (effectiveTenantHost === undefined) {
        return {host: targetUrl.host}
    }

    if (targetUrl.protocol === 'https:') {
        return {
            host: targetUrl.host,
            forwardedHost: effectiveTenantHost,
        }
    }

    return {host: effectiveTenantHost}
}

/**
 * Builds the node:http(s)-based SSRF-guarded server transport shared by the
 * BFF route handlers.
 *
 * Guarantees (identical across all three apps):
 * - HTTPS only, except plain HTTP to loopback hosts
 * - Tenant routing via Host rewrite (HTTP) or X-Forwarded-Host (HTTPS)
 * - Hard response byte cap and wall-clock timeout
 */
export function createServerTransport(
    config: ServerTransportConfig = {},
): (request: ServerTransportRequest) => Promise<Response> {
    const maxResponseBytes = config.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES
    const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const tlsInsecure =
        config.tlsInsecure ??
        process.env.DIRECTWERK_UPSTREAM_TLS_INSECURE === 'true'

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
        const tenantHeaders = buildUpstreamTenantHeaders(
            targetUrl,
            tenantHost,
            config.requireTenantHost === true,
        )

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
                    ...(targetUrl.protocol === 'https:'
                        ? {rejectUnauthorized: !tlsInsecure}
                        : {}),
                    headers: {
                        Accept: 'application/json',
                        Host: tenantHeaders.host,
                        ...(tenantHeaders.forwardedHost === undefined
                            ? {}
                            : {
                                  'X-Forwarded-Host': tenantHeaders.forwardedHost,
                                  'X-Forwarded-Proto': 'https',
                                  Forwarded: `host=${tenantHeaders.forwardedHost};proto=https`,
                              }),
                        ...(tenantHost === undefined
                            ? {}
                            : {'X-Tenant-Host': tenantHost}),
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
