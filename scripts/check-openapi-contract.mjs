#!/usr/bin/env node
/**
 * Ensures the exported OpenAPI spec exists for the contract-tower pipeline.
 * Full type/parser codegen from OpenAPI is tracked in CONTEXT.md §2.
 */
import {existsSync, statSync} from 'node:fs'
import {resolve} from 'node:path'

const specPath = resolve(
    import.meta.dirname,
    '../directwerk-docs/docs/openapi/openapi.yaml',
)

if (!existsSync(specPath)) {
    console.error(
        'OpenAPI spec missing. Run: cd Directwerk && ./gradlew :directwerk-app:exportOpenApi',
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

console.log('OpenAPI contract spec present:', specPath)
