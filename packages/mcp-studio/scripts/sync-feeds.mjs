#!/usr/bin/env node
/**
 * Feed sync for hosted podcast archives.
 *
 * Reads a show config, fetches each upstream RSS feed, and imports only the
 * episodes that are not in the tenant yet (match: title + publish date). New
 * episodes are downloaded, uploaded, created and published with their original
 * date, exactly like the initial import.
 *
 * Usage:
 *   node scripts/sync-feeds.mjs --config scripts/feeds.json [--show NAME] [--dry-run] [--limit N]
 *
 * Env: DIRECTWERK_API_BASE_URL, DIRECTWERK_API_KEY, DIRECTWERK_TENANT_HOST
 */
import {spawn} from 'node:child_process'
import {readFile, mkdir, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import {realpathSync} from 'node:fs'
import {pathToFileURL} from 'node:url'

import {audioVisibility, day, parseFeedDate, storedDay} from './feed-utils.mjs'

const MIME_AUDIO = 'audio/mpeg'
const MAX_DESCRIPTION = 90000

function env(name, fallback) {
    const value = process.env[name] ?? fallback
    if (!value) {
        throw new Error(`Missing env ${name}`)
    }
    return value
}

const baseUrl = env('DIRECTWERK_API_BASE_URL', 'https://api.directwerk.org').replace(/\/$/, '')
const apiKey = env('DIRECTWERK_API_KEY')
const tenantHost = env('DIRECTWERK_TENANT_HOST')

async function api(method, path, body, retries = 3) {
    for (let attempt = 0; attempt < retries; attempt++) {
        const response = await fetch(baseUrl + path, {
            method,
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'X-Tenant-Host': tenantHost,
                Accept: 'application/json',
                ...(body === undefined ? {} : {'Content-Type': 'application/json'}),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        })
        const text = await response.text()
        if (response.ok) {
            return text ? JSON.parse(text) : {}
        }
        if ([429, 500, 502, 503, 504].includes(response.status) && attempt < retries - 1) {
            await sleep(1500 * (attempt + 1))
            continue
        }
        throw new Error(`${method} ${path} -> ${response.status}: ${text.slice(0, 400)}`)
    }
    throw new Error(`${method} ${path} failed`)
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/* ------------------------------------------------------------------ feed parsing */

function decodeXml(value) {
    return value
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&amp;/g, '&')
}

function cleanTitle(value) {
    return (value ?? '').replace(/\s+/g, ' ').trim()
}

function tag(block, name) {
    const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'))
    return match ? decodeXml(match[1]).trim() : null
}

function attr(block, name, attrName) {
    const match = block.match(new RegExp(`<${name}[^>]*\\s${attrName}="([^"]*)"`, 'i'))
    return match ? decodeXml(match[1]) : null
}

function parseDuration(value) {
    if (!value) {
        return null
    }
    const parts = value.split(':').map(Number)
    if (parts.some(Number.isNaN)) {
        return null
    }
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    }
    if (parts.length === 2) {
        return parts[0] * 60 + parts[1]
    }
    return parts[0] || null
}

function parseFeed(xml) {
    const channelBlock = xml.match(/<channel[^>]*>([\s\S]*?)<\/channel>/i)?.[1] ?? ''
    const channelImage = attr(channelBlock, 'itunes:image', 'href')
    const items = []
    const itemRe = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi
    let match
    while ((match = itemRe.exec(xml)) !== null) {
        const block = match[1]
        const enclosure = block.match(/<enclosure[^>]*>/i)?.[0] ?? ''
        const url = enclosure.match(/\surl="([^"]*)"/i)?.[1]
        if (!url) {
            continue
        }
        const image = attr(block, 'itunes:image', 'href') ?? channelImage
        items.push({
            title: cleanTitle(tag(block, 'title')),
            guid: tag(block, 'guid') ?? url,
            description: tag(block, 'content:encoded') ?? tag(block, 'description') ?? '',
            publishedAt: new Date(tag(block, 'pubDate') ?? '').toISOString(),
            url: decodeXml(url),
            durationSeconds: parseDuration(tag(block, 'itunes:duration')),
            image,
            channelImage,
            mimeType: enclosure.match(/\stype="([^"]*)"/i)?.[1] ?? MIME_AUDIO,
        })
    }
    return items.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))
}

/* ------------------------------------------------------------------ helpers */

function slugify(text) {
    const ascii = text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    let slug = ascii.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    if (slug.length > 56) {
        slug = slug.slice(0, 56).replace(/-[^-]*$/, '') || slug.slice(0, 56)
    }
    return slug || 'episode'
}

async function listTenantSlugs() {
    const slugs = new Set()
    for (let offset = 0; ; offset += 100) {
        const page = await api('GET', `/api/v1/episodes?limit=100&offset=${offset}`)
        for (const episode of page.data) {
            slugs.add(episode.slug)
        }
        if (page.data.length < 100) {
            break
        }
    }
    return slugs
}

async function listAllEpisodes(seriesId) {
    const episodes = []
    for (let offset = 0; ; offset += 100) {
        const page = await api('GET', `/api/v1/episodes?seriesId=${seriesId}&limit=100&offset=${offset}`)
        episodes.push(...page.data)
        if (page.data.length < 100) {
            break
        }
    }
    return episodes
}

async function listMedia(folderId) {
    const media = []
    for (let offset = 0; ; offset += 100) {
        const page = await api('GET', `/api/v1/media?folderId=${folderId}&limit=100&offset=${offset}`)
        media.push(...page.data)
        if (page.data.length < 100) {
            break
        }
    }
    return media
}

async function upload(buffer, filename, mimeType, assetType, folderId, existing, visibility = 'PUBLIC') {
    const reusable = existing.get(filename)
    if (reusable?.status === 'READY' && reusable.visibility === visibility) {
        return reusable.id
    }
    // A READY asset with the wrong visibility (typically PUBLIC audio from before the
    // PAID fix) is re-uploaded; delete the superseded one so its public URL stops working.
    const supersededId = reusable?.status === 'READY' ? reusable.id : null
    for (let attempt = 0; attempt < 3; attempt++) {
        const {uploadUrl, assetId} = (await api('POST', '/api/v1/media/upload-url', {
            filename,
            mimeType,
            sizeBytes: buffer.length,
            assetType,
            intendedVisibility: visibility,
            folderId,
        })).data
        const put = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {'Content-Type': mimeType},
            body: buffer,
        })
        if (!put.ok) {
            await sleep(1500)
            continue
        }
        try {
            await api('POST', `/api/v1/media/${assetId}/confirm`, {}, 1)
            existing.set(filename, {id: assetId, status: 'READY', visibility})
            if (supersededId !== null) {
                try {
                    await api('DELETE', `/api/v1/media/${supersededId}`, {}, 1)
                } catch (error) {
                    console.warn(`    could not delete superseded asset ${supersededId}: ${error.message}`)
                }
            }
            return assetId
        } catch (error) {
            console.warn(`    confirm failed (attempt ${attempt + 1}): ${error.message}`)
            await sleep(2000)
        }
    }
    throw new Error(`upload failed: ${filename}`)
}

/**
 * curl instead of fetch: some podcast CDNs (Captivate) answer Node's fetch with
 * 404 while curl gets the 302 to the media host. Streaming to a file also keeps
 * memory flat for 100 MB episodes.
 */
function downloadToFile(url, path) {
    return new Promise((resolve, reject) => {
        const child = spawn('curl', ['-fsSL', '--retry', '3', '--retry-delay', '2',
            '-A', 'directwerk-feed-sync/1.0', '-o', path, url])
        let stderr = ''
        child.stderr.on('data', chunk => {
            stderr += chunk
        })
        child.on('error', reject)
        child.on('close', code => {
            if (code === 0) {
                resolve()
            } else {
                reject(new Error(`download ${url} -> curl ${code} ${stderr.slice(0, 120)}`))
            }
        })
    })
}

/* ------------------------------------------------------------------ sync */

async function syncShow(show, options, tenantSlugs) {
    console.log(`\n== ${show.name}`)
    const xml = await (await fetch(show.feedUrl, {headers: {'User-Agent': 'directwerk-feed-sync/1.0'}})).text()
    const items = parseFeed(xml)
    const existingEpisodes = await listAllEpisodes(show.seriesId)
    const seen = new Set(existingEpisodes.map(episode => `${cleanTitle(episode.title).toLowerCase()}|${storedDay(episode)}`))
    const usedSlugs = new Set([...tenantSlugs, ...existingEpisodes.map(episode => episode.slug)])
    let nextNumber = Math.max(0, ...existingEpisodes.map(episode => episode.episodeNumber ?? 0)) + 1

    const knownMedia = new Map()
    const audioExisting = await listMedia(show.audioFolderId)
    for (const asset of audioExisting) {
        knownMedia.set(asset.originalFilename, {id: asset.id, status: asset.status, visibility: asset.visibility})
    }

    let pending = items.filter(item => {
        const keyTitle = cleanTitle(item.title).toLowerCase()
        return !seen.has(`${keyTitle}|${day(item.publishedAt)}`) && !draftTitles.has(keyTitle)
    })
    if (options.limit) {
        pending = pending.slice(-options.limit)
    }
    console.log(`   feed ${items.length} items, ${existingEpisodes.length} in studio, ${pending.length} new`)
    if (pending.length === 0) {
        return {added: 0, skipped: 0}
    }
    if (options.dryRun) {
        for (const item of pending) {
            console.log(`   + ${day(item.publishedAt)} ${item.title}`)
        }
        return {added: 0, skipped: pending.length, dryRun: true}
    }

    let added = 0
    let failed = 0
    const workDir = join(tmpdir(), `directwerk-feed-sync-${process.pid}`)
    await mkdir(workDir, {recursive: true})

    for (const item of pending) {
        let slug = slugify(item.title)
        let suffix = 2
        while (usedSlugs.has(slug)) {
            slug = `${slugify(item.title).slice(0, 58)}-${suffix++}`
        }
        usedSlugs.add(slug)
        const audioFile = `${slug}.mp3`
        try {
            console.log(`   + ${day(item.publishedAt)} ${item.title}`)
            const audioPath = join(workDir, audioFile)
            await downloadToFile(item.url, audioPath)
            const audio = await readFile(audioPath)

            const audioAssetId = await upload(audio, audioFile, item.mimeType || MIME_AUDIO, 'AUDIO',
                show.audioFolderId, knownMedia, audioVisibility(show))

            let coverAssetId = show.seriesCoverAssetId
            if (item.image && item.image !== item.channelImage) {
                const coverFile = `${slug}.jpg`
                const coverPath = join(workDir, coverFile)
                await downloadToFile(item.image, coverPath)
                coverAssetId = await upload(await readFile(coverPath), coverFile, 'image/jpeg', 'IMAGE',
                    show.coverFolderId, new Map())
                await rm(coverPath, {force: true})
            }

            const body = {
                seriesId: show.seriesId,
                slug,
                title: item.title.slice(0, 255),
                description: (item.description || '').slice(0, MAX_DESCRIPTION) || undefined,
                audioAssetId,
                coverAssetId,
                durationSeconds: item.durationSeconds ?? undefined,
                accessPolicy: show.accessPolicy ?? 'PAID',
                requiredLevelSortOrder: show.requiredLevelSortOrder ?? 1,
                formatIds: [show.formatId],
                episodeNumber: show.numbering === 'sequence' ? nextNumber++ : undefined,
                ...(show.categoryIds?.length ? {categoryIds: show.categoryIds} : {}),
            }
            const created = (await api('POST', '/api/v1/episodes', body)).data
            const publishedAt = item.publishedAt
            if (new Date(publishedAt).getTime() > Date.now()) {
                await api('POST', `/api/v1/episodes/${created.id}/schedule`, {
                    scheduledAt: publishedAt,
                    notifySubscribers: false,
                })
            } else {
                await api('POST', `/api/v1/episodes/${created.id}/publish`, {
                    notifySubscribers: false,
                    publishedAt,
                })
            }
            await rm(audioPath, {force: true})
            added++
        } catch (error) {
            failed++
            console.error(`   FAILED ${item.title}: ${error.message}`)
            if (show.numbering === 'sequence') {
                nextNumber--
            }
        }
    }

    await rm(workDir, {recursive: true, force: true})
    return {added, failed}
}

async function main() {
    const args = process.argv.slice(2)
    const arg = name => {
        const index = args.indexOf(name)
        return index >= 0 ? args[index + 1] : undefined
    }
    const configPath = arg('--config')
    if (!configPath) {
        throw new Error('Usage: sync-feeds.mjs --config scripts/feeds.json [--show NAME] [--dry-run] [--limit N]')
    }
    const config = JSON.parse(await readFile(configPath, 'utf8'))
    const only = arg('--show')
    const options = {
        dryRun: args.includes('--dry-run'),
        limit: arg('--limit') ? Number(arg('--limit')) : undefined,
    }
    const shows = (config.shows ?? []).filter(show => !only || show.name === only)
    if (shows.length === 0) {
        throw new Error(`No shows matched${only ? ` --show ${only}` : ''}`)
    }
    const tenantSlugs = new Set()
    for (const slug of await listTenantSlugs()) {
        tenantSlugs.add(slug)
    }
    let added = 0
    let failed = 0
    for (const show of shows) {
        try {
            const result = await syncShow(show, options, tenantSlugs)
            added += result.added
            failed += result.failed ?? 0
        } catch (error) {
            failed++
            console.error(`== ${show.name}: ${error.message}`)
        }
    }
    console.log(`\n${options.dryRun ? 'dry-run: ' : ''}${added} added, ${failed} failed`)
    if (failed > 0) {
        process.exitCode = 1
    }
}

const isMain = process.argv[1]
    && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
if (isMain) {
    main().catch(error => {
        console.error(error.message)
        process.exit(1)
    })
}
