'use client'

import {parseEpisodeEnvelope, parseEpisodeListEnvelope, parseSeriesEnvelope, parseSeriesListEnvelope} from '@directwerk/api/validation/catalog'

import type {
    CreateEpisodeInput,
    CreateSeriesInput,
    EpisodeDetail,
    SeriesDetail,
    SeriesSummary,
    UpdateEpisodeInput,
    UpdateSeriesInput,
} from '@directwerk/api/types'
import {createPublicationWorkflowApi, jsonInit, studioGet, studioMutate} from './studioApiCore'

const episodeApi = createPublicationWorkflowApi<
    EpisodeDetail,
    CreateEpisodeInput,
    UpdateEpisodeInput
>({
    basePath: '/api/proxy/episodes',
    parseEnvelope: parseEpisodeEnvelope,
    parseListEnvelope: parseEpisodeListEnvelope,
    messages: {
        list: 'Der Server hat eine ungültige Folgenliste gesendet.',
        detail: 'Der Server hat eine ungültige Folge gesendet.',
    },
})

export const listEpisodes = episodeApi.list
export const getEpisode = episodeApi.get
export const createEpisode = episodeApi.create
export const updateEpisode = episodeApi.update
export const publishEpisode = episodeApi.publish
export const scheduleEpisode = episodeApi.schedule
export const cancelScheduleEpisode = episodeApi.cancelSchedule
export const unpublishEpisode = episodeApi.unpublish
export const archiveEpisode = episodeApi.archive
export const unarchiveEpisode = episodeApi.unarchive

const invalidEpisodeMessage = 'Der Server hat eine ungültige Folge gesendet.'

export async function setEpisodeEnclosureEnabled(
    tenantHost: string,
    episodeId: number,
    enabled: boolean,
): Promise<EpisodeDetail> {
    return studioMutate(
        `/api/proxy/episodes/${episodeId}/enclosure-enabled`,
        tenantHost,
        jsonInit('PUT', {enabled}),
        parseEpisodeEnvelope,
        invalidEpisodeMessage,
    )
}

export async function attachEpisodeAudio(
    tenantHost: string,
    episodeId: number,
    audioAssetId: number,
): Promise<EpisodeDetail> {
    return studioMutate(
        `/api/proxy/episodes/${episodeId}/audio`,
        tenantHost,
        jsonInit('POST', {audioAssetId}),
        parseEpisodeEnvelope,
        invalidEpisodeMessage,
    )
}

export async function listSeries(tenantHost: string): Promise<SeriesSummary[]> {
    return studioGet(
        '/api/proxy/series',
        tenantHost,
        parseSeriesListEnvelope,
        'Der Server hat eine ungültige Sendungsliste gesendet.',
    )
}

export async function getSeries(
    tenantHost: string,
    seriesId: number,
): Promise<SeriesDetail> {
    return studioGet(
        `/api/proxy/series/${seriesId}`,
        tenantHost,
        parseSeriesEnvelope,
        'Der Server hat eine ungültige Sendung gesendet.',
    )
}

export async function createSeries(
    tenantHost: string,
    input: CreateSeriesInput,
): Promise<SeriesDetail> {
    return studioMutate(
        '/api/proxy/series',
        tenantHost,
        jsonInit('POST', input),
        parseSeriesEnvelope,
        'Der Server hat eine ungültige Sendung gesendet.',
    )
}

export async function updateSeries(
    tenantHost: string,
    seriesId: number,
    input: UpdateSeriesInput,
): Promise<SeriesDetail> {
    return studioMutate(
        `/api/proxy/series/${seriesId}`,
        tenantHost,
        jsonInit('PUT', input),
        parseSeriesEnvelope,
        'Der Server hat eine ungültige Sendung gesendet.',
    )
}

export async function publishSeries(
    tenantHost: string,
    seriesId: number,
): Promise<SeriesSummary> {
    const updated = await updateSeries(tenantHost, seriesId, {status: 'PUBLISHED'})
    return {
        id: updated.id,
        slug: updated.slug,
        title: updated.title,
        status: updated.status,
        rssUrl: updated.rssUrl,
    }
}

export async function unpublishSeries(
    tenantHost: string,
    seriesId: number,
): Promise<SeriesSummary> {
    const updated = await updateSeries(tenantHost, seriesId, {status: 'DRAFT'})
    return {
        id: updated.id,
        slug: updated.slug,
        title: updated.title,
        status: updated.status,
        rssUrl: updated.rssUrl,
    }
}
