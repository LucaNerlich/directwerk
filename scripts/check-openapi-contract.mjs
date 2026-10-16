#!/usr/bin/env node
/**
 * OpenAPI contract tower checks: spec presence, freshness, and key schema names
 * referenced in hand-maintained TypeScript types.
 */
import {existsSync, readFileSync, statSync} from 'node:fs'
import {resolve} from 'node:path'

const root = resolve(import.meta.dirname, '..')
// #538: this pointed at a YAML file that has never existed in this repo (the spec is the JSON
// the Gradle export writes), and the missing-file branch exited 0 — so the freshness check and
// both schema comparisons below were unreachable and `pnpm check:openapi` always passed.
const specPath = resolve(root, 'directwerk-docs/docs/openapi/directwerk-api.json')
const typesPath = resolve(root, 'packages/api/src/types.ts')

// Each concept has a name on each side: the exported spec names the *view* it serialises, the
// hand-maintained types name the domain object. The old single-name list demanded one spelling in
// both files, so it could never pass once the check actually ran (#538).
const REQUIRED_SCHEMAS = [
    {spec: 'ProductView', types: 'SubscriptionProduct'},
    {spec: 'ProductAccessRuleView', types: 'ProductAccessRule'},
    {spec: 'EpisodeView', types: 'EpisodeDetail'},
    {spec: 'SubscriberFeedView', types: 'SubscriberFeedView'},
    {spec: 'MediaAsset', types: 'MediaAsset'},
]

if (!existsSync(specPath)) {
    console.error(
        `OpenAPI spec missing at ${specPath} — run: cd Directwerk && ./gradlew :directwerk-app:exportOpenApi`,
    )
    process.exit(1)
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
const missingInSpec = REQUIRED_SCHEMAS.filter((pair) => !spec.includes(pair.spec)).map((pair) => pair.spec)
const missingInTypes = REQUIRED_SCHEMAS.filter((pair) => !types.includes(pair.types)).map((pair) => pair.types)

if (missingInSpec.length > 0) {
    console.error('OpenAPI spec missing schemas:', missingInSpec.join(', '))
    process.exit(1)
}

if (missingInTypes.length > 0) {
    console.error('packages/api types missing schemas:', missingInTypes.join(', '))
    process.exit(1)
}

console.log('OpenAPI contract check passed:', specPath)
