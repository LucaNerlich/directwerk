'use client'

import {parseEpisodeEnvelope, parseEpisodeListEnvelope, parseSeriesEnvelope, parseSeriesListEnvelope} from '@directwerk/api/validation/catalog'

import type {
    BulkPublishInput,
    CreateEpisodeInput,
    CreateSeriesInput,
    EpisodeDetail,
    SeriesDetail,
    SeriesSummary,
    UpdateEpisodeInput,
    UpdateSeriesInput,
} from '@directwerk/api/types'
import {parseBulkDeleteEnvelope} from '@directwerk/api/validation/catalog'
import {createPublicationWorkflowApi, jsonInit, studioDelete, studioGet, studioMutate} from './studioApiCore'

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

export async function deleteEpisode(
        episodeId: number,
): Promise<void> {
    return studioDelete(`/api/proxy/episodes/${episodeId}`, )
}

const invalidEpisodeMessage = 'Der Server hat eine ungültige Folge gesendet.'
const invalidBulkDeleteMessage = 'Der Server hat eine ungültige Löschantwort gesendet.'

export async function bulkPublishEpisodes(
        input: BulkPublishInput,
): Promise<EpisodeDetail[]> {
    return studioMutate(
        '/api/proxy/episodes/bulk/publish',
        
        jsonInit('POST', input),
        parseEpisodeListEnvelope,
        invalidEpisodeMessage,
    )
}

export async function bulkUnpublishEpisodes(
        ids: number[],
): Promise<EpisodeDetail[]> {
    return studioMutate(
        '/api/proxy/episodes/bulk/unpublish',
        
        jsonInit('POST', {ids}),
        parseEpisodeListEnvelope,
        invalidEpisodeMessage,
    )
}

export async function bulkDeleteEpisodes(
        ids: number[],
): Promise<number[]> {
    const result = await studioMutate(
        '/api/proxy/episodes/bulk/delete',
        
        jsonInit('POST', {ids}),
        parseBulkDeleteEnvelope,
        invalidBulkDeleteMessage,
    )
    return result.deletedIds
}

export async function setEpisodeEnclosureEnabled(
        episodeId: number,
    enabled: boolean,
): Promise<EpisodeDetail> {
    return studioMutate(
        `/api/proxy/episodes/${episodeId}/enclosure-enabled`,
        
        jsonInit('PUT', {enabled}),
        parseEpisodeEnvelope,
        invalidEpisodeMessage,
    )
}

export async function attachEpisodeAudio(
        episodeId: number,
    audioAssetId: number,
): Promise<EpisodeDetail> {
    return studioMutate(
        `/api/proxy/episodes/${episodeId}/audio`,
        
        jsonInit('POST', {audioAssetId}),
        parseEpisodeEnvelope,
        invalidEpisodeMessage,
    )
}

export async function listSeries(): Promise<SeriesSummary[]> {
    return studioGet(
        '/api/proxy/series',
        
        parseSeriesListEnvelope,
        'Der Server hat eine ungültige Sendungsliste gesendet.',
    )
}

export async function getSeries(
        seriesId: number,
): Promise<SeriesDetail> {
    return studioGet(
        `/api/proxy/series/${seriesId}`,
        
        parseSeriesEnvelope,
        'Der Server hat eine ungültige Sendung gesendet.',
    )
}

export async function createSeries(
        input: CreateSeriesInput,
): Promise<SeriesDetail> {
    return studioMutate(
        '/api/proxy/series',
        
        jsonInit('POST', input),
        parseSeriesEnvelope,
        'Der Server hat eine ungültige Sendung gesendet.',
    )
}

export async function updateSeries(
        seriesId: number,
    input: UpdateSeriesInput,
): Promise<SeriesDetail> {
    return studioMutate(
        `/api/proxy/series/${seriesId}`,
        
        jsonInit('PUT', input),
        parseSeriesEnvelope,
        'Der Server hat eine ungültige Sendung gesendet.',
    )
}

export async function publishSeries(
        seriesId: number,
): Promise<SeriesSummary> {
    const updated = await updateSeries( seriesId, {status: 'PUBLISHED'})
    return {
        id: updated.id,
        slug: updated.slug,
        title: updated.title,
        status: updated.status,
        rssUrl: updated.rssUrl,
    }
}

export async function unpublishSeries(
        seriesId: number,
): Promise<SeriesSummary> {
    const updated = await updateSeries( seriesId, {status: 'DRAFT'})
    return {
        id: updated.id,
        slug: updated.slug,
        title: updated.title,
        status: updated.status,
        rssUrl: updated.rssUrl,
    }
}
