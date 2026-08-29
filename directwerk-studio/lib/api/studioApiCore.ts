'use client'

import type {PublishOptions, ScheduleOptions} from '@directwerk/api/types'
import {jsonInit, postJson, proxyRequest, request} from './studioTransport'

/**
 * Authenticated GET with envelope parsing.
 *
 * @param tenantHost Deprecated — ignored; tenant binding comes from transport headers.
 */
export async function studioGet<T>(
    path: string,
    tenantHost: string,
    parser: (value: unknown) => {data: T} | null,
    errorMessage: string,
): Promise<T> {
    return proxyRequest(path, tenantHost, undefined, parser, errorMessage)
}

/**
 * Authenticated mutation with envelope parsing.
 *
 * @param tenantHost Deprecated — ignored; tenant binding comes from transport headers.
 */
export async function studioMutate<T>(
    path: string,
    tenantHost: string,
    init: RequestInit,
    parser: (value: unknown) => {data: T} | null,
    errorMessage: string,
): Promise<T> {
    return proxyRequest(path, tenantHost, init, parser, errorMessage)
}

export interface PublicationWorkflowApi<T, TCreate, TUpdate> {
    list(tenantHost: string): Promise<T[]>
    get(tenantHost: string, id: number): Promise<T>
    create(tenantHost: string, input: TCreate): Promise<T>
    update(tenantHost: string, id: number, input: TUpdate): Promise<T>
    publish(tenantHost: string, id: number, options?: PublishOptions): Promise<T>
    schedule(tenantHost: string, id: number, options: ScheduleOptions): Promise<T>
    cancelSchedule(tenantHost: string, id: number): Promise<T>
    unpublish(tenantHost: string, id: number): Promise<T>
    archive(tenantHost: string, id: number): Promise<T>
    unarchive(tenantHost: string, id: number): Promise<T>
}

export function createPublicationWorkflowApi<T, TCreate, TUpdate>(config: {
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
        list: (tenantHost) =>
            studioGet(basePath, tenantHost, parseListEnvelope, messages.list),
        get: (tenantHost, id) =>
            studioGet(`${basePath}/${id}`, tenantHost, parseEnvelope, messages.detail),
        create: (tenantHost, input) =>
            studioMutate(
                basePath,
                tenantHost,
                jsonInit('POST', input),
                parseEnvelope,
                messages.detail,
            ),
        update: (tenantHost, id, input) =>
            studioMutate(
                `${basePath}/${id}`,
                tenantHost,
                jsonInit('PUT', input),
                parseEnvelope,
                messages.detail,
            ),
        publish: (tenantHost, id, options) =>
            studioMutate(
                `${basePath}/${id}/publish`,
                tenantHost,
                jsonInit('POST', {
                    notifySubscribers: options?.notifySubscribers === true,
                }),
                parseEnvelope,
                messages.detail,
            ),
        schedule: (tenantHost, id, options) =>
            studioMutate(
                `${basePath}/${id}/schedule`,
                tenantHost,
                jsonInit('POST', {
                    scheduledAt: options.scheduledAt,
                    notifySubscribers: options.notifySubscribers === true,
                }),
                parseEnvelope,
                messages.detail,
            ),
        cancelSchedule: (tenantHost, id) =>
            studioMutate(
                `${basePath}/${id}/cancel-schedule`,
                tenantHost,
                {method: 'POST'},
                parseEnvelope,
                messages.detail,
            ),
        unpublish: (tenantHost, id) =>
            studioMutate(
                `${basePath}/${id}/unpublish`,
                tenantHost,
                {method: 'POST'},
                parseEnvelope,
                messages.detail,
            ),
        archive: (tenantHost, id) =>
            studioMutate(
                `${basePath}/${id}/archive`,
                tenantHost,
                {method: 'POST'},
                parseEnvelope,
                messages.detail,
            ),
        unarchive: (tenantHost, id) =>
            studioMutate(
                `${basePath}/${id}/unarchive`,
                tenantHost,
                {method: 'POST'},
                parseEnvelope,
                messages.detail,
            ),
    }
}

export {authenticatedRequest, jsonInit, postJson, request} from './studioTransport'
