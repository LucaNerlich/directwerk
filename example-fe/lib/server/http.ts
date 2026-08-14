import {request as httpRequest} from 'node:http'
import {request as httpsRequest} from 'node:https'

import type {TenantHost} from '@/lib/tenants'

const MAX_RESPONSE_BYTES = 1_048_576
const REQUEST_TIMEOUT_MS = 10_000

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface TenantHostRequest {
    targetUrl: URL
    tenantHost?: TenantHost
    method: HttpMethod
    authorization?: string
    body?: string
    contentType?: 'application/json' | 'application/x-www-form-urlencoded'
}

export function requestWithTenantHost({
    targetUrl,
    tenantHost,
    method,
    authorization,
    body,
    contentType,
}: TenantHostRequest): Promise<Response> {
    const isLoopback =
        targetUrl.hostname === 'localhost' ||
        targetUrl.hostname === '127.0.0.1' ||
        targetUrl.hostname === '[::1]'

    if (targetUrl.protocol !== 'https:' && !(targetUrl.protocol === 'http:' && isLoopback)) {
        return Promise.reject(new Error('Non-HTTPS URLs are not allowed except for loopback hosts.'))
    }

    const request = targetUrl.protocol === 'https:' ? httpsRequest : httpRequest
    const hostHeader = tenantHost ?? targetUrl.host

    return new Promise<Response>((resolve, reject) => {
        let resolved = false
        const wallClockTimeout = setTimeout(() => {
            if (!resolved) {
                resolved = true
                upstreamRequest.destroy(new Error('Upstream request deadline exceeded'))
                reject(new Error('Upstream request deadline exceeded'))
            }
        }, REQUEST_TIMEOUT_MS)

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
                    ...(authorization === undefined ? {} : {Authorization: authorization}),
                    ...(contentType === undefined ? {} : {'Content-Type': contentType}),
                },
            },
            (upstreamResponse) => {
                const chunks: Buffer[] = []
                let totalBytes = 0

                upstreamResponse.on('data', (chunk: Buffer) => {
                    totalBytes += chunk.byteLength
                    if (totalBytes > MAX_RESPONSE_BYTES) {
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
                    const responseContentType = upstreamResponse.headers['content-type']
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

        upstreamRequest.setTimeout(REQUEST_TIMEOUT_MS, () => {
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
