'use client'

import type {PublishOptions, ScheduleOptions} from '@directwerk/api/types'
import {authenticatedRequest, INVALID_RESPONSE, jsonInit, proxyRequest} from './studioTransport'


export async function studioGet<T>(
    path: string,
    parser: (value: unknown) => {data: T} | null,
    errorMessage: string,
): Promise<T> {
    return proxyRequest(path, '', undefined, parser, errorMessage)
}


export async function studioMutate<T>(
    path: string,
    init: RequestInit,
    parser: (value: unknown) => {data: T} | null,
    errorMessage: string,
): Promise<T> {
    return proxyRequest(path, '', init, parser, errorMessage)
}

/**
 * DELETE helper for endpoints that answer 204 No Content.
 *
 * The BFF proxy forwards 204/205 responses without a JSON body, while every
 * error path stays JSON — so the shared JSON transport reports a successful
 * delete as {@link INVALID_RESPONSE}. Only that exact failure is swallowed;
 * every other error (including the German catalog message for 4xx) propagates.
 */
export async function studioDelete(path: string): Promise<void> {
    try {
        await authenticatedRequest(path, '', {method: 'DELETE'})
    } catch (error) {
        if (
            error instanceof Error &&
            error.message === INVALID_RESPONSE &&
            'status' in error &&
            (error.status === 204 || error.status === 205)
        ) {
            return
        }
        throw error
    }
}

export interface PublicationWorkflowApi<T, TCreate, TUpdate> {
    list(): Promise<T[]>
    get(id: number): Promise<T>
    create(input: TCreate): Promise<T>
    update(id: number, input: TUpdate): Promise<T>
    publish(id: number, options?: PublishOptions): Promise<T>
    schedule(id: number, options?: ScheduleOptions): Promise<T>
    cancelSchedule(id: number): Promise<T>
    unpublish(id: number): Promise<T>
    archive(id: number): Promise<T>
    unarchive(id: number): Promise<T>
}

export function createPublicationWorkflowApi<T, TCreate extends object, TUpdate extends object>(config: {
    basePath: string
    parseEnvelope: (value: unknown) => {data: T} | null
    parseListEnvelope: (value: unknown) => {data: T[]} | null
    messages: {
        list: string
        detail: string
    }
}): PublicationWorkflowApi<T, TCreate, TUpdate> {
    const {basePath, parseEnvelope, parseListEnvelope, messages} = config

    return {
        list: (): Promise<T[]> =>
            studioGet(basePath,  parseListEnvelope, messages.list),
        get: (id: number): Promise<T> =>
            studioGet(`${basePath}/${id}`,  parseEnvelope, messages.detail),
        create: (input: TCreate): Promise<T> =>
            studioMutate(
                basePath,
                jsonInit('POST', input),
                parseEnvelope,
                messages.detail,
            ),
        update: (id: number, input: TUpdate): Promise<T> =>
            studioMutate(
                `${basePath}/${id}`,
                jsonInit('PUT', input),
                parseEnvelope,
                messages.detail,
            ),
        publish: (id: number, options?: PublishOptions): Promise<T> =>
            studioMutate(
                `${basePath}/${id}/publish`,
                jsonInit('POST', {
                    notifySubscribers: options?.notifySubscribers === true,
                }),
                parseEnvelope,
                messages.detail,
            ),
        schedule: (id: number, options?: ScheduleOptions): Promise<T> =>
            studioMutate(
                `${basePath}/${id}/schedule`,
                jsonInit('POST', {
                    scheduledAt: options?.scheduledAt,
                    notifySubscribers: options?.notifySubscribers === true,
                }),
                parseEnvelope,
                messages.detail,
            ),
        cancelSchedule: (id: number): Promise<T> =>
            studioMutate(
                `${basePath}/${id}/cancel-schedule`,
                
                {method: 'POST'},
                parseEnvelope,
                messages.detail,
            ),
        unpublish: (id: number): Promise<T> =>
            studioMutate(
                `${basePath}/${id}/unpublish`,
                
                {method: 'POST'},
                parseEnvelope,
                messages.detail,
            ),
        archive: (id: number): Promise<T> =>
            studioMutate(
                `${basePath}/${id}/archive`,
                
                {method: 'POST'},
                parseEnvelope,
                messages.detail,
            ),
        unarchive: (id: number): Promise<T> =>
            studioMutate(
                `${basePath}/${id}/unarchive`,
                
                {method: 'POST'},
                parseEnvelope,
                messages.detail,
            ),
    }
}

export {authenticatedRequest, jsonInit, postJson, request} from './studioTransport'
