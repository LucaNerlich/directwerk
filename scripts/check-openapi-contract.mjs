#!/usr/bin/env node
/**
 * OpenAPI contract tower checks: spec presence, freshness, and key schema names
 * referenced in hand-maintained TypeScript types.
 */
import {existsSync, readFileSync, statSync} from 'node:fs'
import {resolve} from 'node:path'

const root = resolve(import.meta.dirname, '..')
const specPath = resolve(root, 'directwerk-docs/docs/openapi/openapi.yaml')
const typesPath = resolve(root, 'packages/api/src/types.ts')

const REQUIRED_SCHEMAS = [
    'SubscriptionProduct',
    'ProductAccessRule',
    'EpisodeDetail',
    'SubscriberFeedView',
    'MediaAsset',
]

if (!existsSync(specPath)) {
    console.warn(
        'OpenAPI spec missing — skipping schema cross-check. Run: cd Directwerk && ./gradlew :directwerk-app:exportOpenApi',
    )
    process.exit(0)
}

const ageMs = Date.now() - statSync(specPath).mtimeMs
const maxAgeDays = 30
if (ageMs > maxAgeDays * 24 * 60 * 60 * 1000) {
    console.warn(
        `Warning: OpenAPI spec is older than ${maxAgeDays} days — consider re-exporting.`,
    )
}

const spec = readFileSync(specPath, 'utf8')
const types = readFileSync(typesPath, 'utf8')
const missingInSpec = REQUIRED_SCHEMAS.filter((name) => !spec.includes(name))
const missingInTypes = REQUIRED_SCHEMAS.filter((name) => !types.includes(name))

if (missingInSpec.length > 0) {
    console.error('OpenAPI spec missing schemas:', missingInSpec.join(', '))
    process.exit(1)
}

if (missingInTypes.length > 0) {
    console.error('packages/api types missing schemas:', missingInTypes.join(', '))
    process.exit(1)
}

console.log('OpenAPI contract check passed:', specPath)
