'use client'

import {parseEnvelope} from '@directwerk/api/validation/primitives'
import type {NewsletterListSummary, NewsletterSubscriptionSummary} from '@directwerk/api/types'
import {jsonInit, studioDelete, studioMutate, studioGet} from './studioApiCore'

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

function parseList(value: unknown): NewsletterListSummary | null {
    if (!isRecord(value)) return null
    if (typeof value.id !== 'number' || typeof value.slug !== 'string' || typeof value.name !== 'string') {
        return null
    }
    return {
        id: value.id,
        slug: value.slug,
        name: value.name,
        description: typeof value.description === 'string' ? value.description : null,
        status: value.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE',
        activeCount: typeof value.activeCount === 'number' ? value.activeCount : 0,
        pendingCount: typeof value.pendingCount === 'number' ? value.pendingCount : 0,
        createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
        updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '',
    }
}

function parseSubscription(value: unknown): NewsletterSubscriptionSummary | null {
    if (!isRecord(value)) return null
    if (typeof value.id !== 'number' || typeof value.email !== 'string') return null
    return {
        id: value.id,
        email: value.email,
        status:
            value.status === 'PENDING' || value.status === 'UNSUBSCRIBED'
                ? value.status
                : 'ACTIVE',
        source: typeof value.source === 'string' ? value.source : 'PUBLIC_FORM',
        confirmedAt: typeof value.confirmedAt === 'string' ? value.confirmedAt : null,
        unsubscribedAt: typeof value.unsubscribedAt === 'string' ? value.unsubscribedAt : null,
        createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
    }
}

export async function listNewsletterLists(tenantHost: string): Promise<NewsletterListSummary[]> {
    return studioGet(
        '/api/proxy/newsletter-lists',
        tenantHost,
        (value) => {
            const envelope = parseEnvelope(value, (data) => {
                if (!Array.isArray(data)) return null
                const rows: NewsletterListSummary[] = []
                for (const item of data) {
                    const parsed = parseList(item)
                    if (parsed === null) return null
                    rows.push(parsed)
                }
                return rows
            })
            return envelope
        },
        'Listen konnten nicht geladen werden.',
    )
}

export async function createNewsletterList(
    tenantHost: string,
    input: {slug: string; name: string; description?: string},
): Promise<NewsletterListSummary> {
    return studioMutate(
        '/api/proxy/newsletter-lists',
        tenantHost,
        jsonInit('POST', input),
        (value) => parseEnvelope(value, parseList),
        'Liste konnte nicht angelegt werden.',
    )
}

export async function updateNewsletterList(
    tenantHost: string,
    listId: number,
    input: {slug?: string; name?: string; description?: string; status?: 'ACTIVE' | 'ARCHIVED'},
): Promise<NewsletterListSummary> {
    return studioMutate(
        `/api/proxy/newsletter-lists/${listId}`,
        tenantHost,
        jsonInit('PUT', input),
        (value) => parseEnvelope(value, parseList),
        'Liste konnte nicht gespeichert werden.',
    )
}

export async function archiveNewsletterList(
    tenantHost: string,
    listId: number,
): Promise<NewsletterListSummary> {
    return studioMutate(
        `/api/proxy/newsletter-lists/${listId}`,
        tenantHost,
        jsonInit('DELETE'),
        (value) => parseEnvelope(value, parseList),
        'Liste konnte nicht archiviert werden.',
    )
}

export async function listNewsletterSubscriptions(
    tenantHost: string,
    listId: number,
): Promise<NewsletterSubscriptionSummary[]> {
    return studioGet(
        `/api/proxy/newsletter-lists/${listId}/subscriptions`,
        tenantHost,
        (value) => {
            const envelope = parseEnvelope(value, (data) => {
                if (!Array.isArray(data)) return null
                const rows: NewsletterSubscriptionSummary[] = []
                for (const item of data) {
                    const parsed = parseSubscription(item)
                    if (parsed === null) return null
                    rows.push(parsed)
                }
                return rows
            })
            return envelope
        },
        'Abonnenten konnten nicht geladen werden.',
    )
}

export async function removeNewsletterSubscription(
    tenantHost: string,
    listId: number,
    subscriptionId: number,
): Promise<void> {
    return studioDelete(
        `/api/proxy/newsletter-lists/${listId}/subscriptions/${subscriptionId}`,
        tenantHost,
    )
}
