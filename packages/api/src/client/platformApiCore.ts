import type {ApiEnvelope} from '../types'
import {envelopeResult} from '../envelope/envelopeResult'
import {parseApiEnvelope, parsePaginatedApiEnvelope} from '../envelope'
import type {AuthedRequestFn} from './authedRequest'

export interface PlatformApiCore {
    get<T>(path: string, invalidMessage?: string): Promise<T>
    post<T>(path: string, body: object, invalidMessage?: string): Promise<T>
    patch<T>(path: string, body: object, invalidMessage?: string): Promise<T>
    delete<T>(path: string, invalidMessage?: string): Promise<T>
    getEnvelope<T>(
        path: string,
        parser: (value: unknown) => ApiEnvelope<T> | null,
        invalidMessage: string,
    ): Promise<T>
    mutateEnvelope<T>(
        path: string,
        init: RequestInit,
        parser: (value: unknown) => ApiEnvelope<T> | null,
        invalidMessage: string,
    ): Promise<T>
}

export function createPlatformApiCore(
    authedFetch: AuthedRequestFn,
    options: {proxyPrefix?: string} = {},
): PlatformApiCore {
    const proxyPrefix = options.proxyPrefix ?? '/api/proxy/'

    async function platformRequest(
        path: string,
        init: RequestInit,
    ): Promise<unknown> {
        return authedFetch(`${proxyPrefix}${path}`, {
            ...init,
            cache: 'no-store',
        })
    }

    async function unwrap<T>(
        raw: unknown,
        invalidMessage = 'The server returned an invalid response.',
    ): Promise<T> {
        if (raw === null) {
            return null as T
        }

        try {
            return parseApiEnvelope<T>(raw)
        } catch {
            throw new Error(invalidMessage)
        }
    }

    return {
        get<T>(path: string, invalidMessage?: string): Promise<T> {
            return platformRequest(path, {method: 'GET'}).then((raw) =>
                unwrap<T>(raw, invalidMessage),
            )
        },
        post<T>(path: string, body: object, invalidMessage?: string): Promise<T> {
            return platformRequest(path, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(body),
            }).then((raw) => unwrap<T>(raw, invalidMessage))
        },
        patch<T>(path: string, body: object, invalidMessage?: string): Promise<T> {
            return platformRequest(path, {
                method: 'PATCH',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(body),
            }).then((raw) => unwrap<T>(raw, invalidMessage))
        },
        delete<T>(path: string, invalidMessage?: string): Promise<T> {
            return platformRequest(path, {method: 'DELETE'}).then((raw) =>
                unwrap<T>(raw, invalidMessage),
            )
        },
        async getEnvelope<T>(
            path: string,
            parser: (value: unknown) => ApiEnvelope<T> | null,
            invalidMessage: string,
        ): Promise<T> {
            const raw = await platformRequest(path, {method: 'GET'})
            if (raw === null) {
                return null as T
            }
            return envelopeResult(parser, raw, invalidMessage).data
        },
        async mutateEnvelope<T>(
            path: string,
            init: RequestInit,
            parser: (value: unknown) => ApiEnvelope<T> | null,
            invalidMessage: string,
        ): Promise<T> {
            const raw = await platformRequest(path, init)
            if (raw === null) {
                return null as T
            }
            return envelopeResult(parser, raw, invalidMessage).data
        },
    }
}

export {parsePaginatedApiEnvelope}
