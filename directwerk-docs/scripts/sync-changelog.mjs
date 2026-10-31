#!/usr/bin/env node
/**
 * Sync directwerk-docs/docs/changelog/index.md from the repo-root CHANGELOG.md.
 * Prefer editing CHANGELOG.md; re-run this script (or predev/prebuild) to refresh.
 *
 * Lives at changelog/index.md (not changelog.md) so it coexists with
 * vitepress-openapi-docs' /changelog/{spec} pages under the same directory
 * without serve treating /changelog as a bare folder listing.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const root = join(scriptDir, '../..')
const source = join(root, 'CHANGELOG.md')
const dest = join(root, 'directwerk-docs/docs/changelog/index.md')

if (!existsSync(source)) {
  console.error(
    `Missing ${relative(root, source)} (repo root). Docker/Coolify: allowlist it in /.dockerignore (!CHANGELOG.md) and copy it in directwerk-docs/Dockerfile.`,
  )
  process.exit(1)
}

let body = readFileSync(source, 'utf8')
if (body.startsWith('# ')) {
  body = body.replace(/^# [^\n]+\n+/, '')
}
if (!body.endsWith('\n')) {
  body += '\n'
}

const srcLabel = relative(root, source)
const out = `---
title: Changelog
description: Release notes for the Directwerk platform.
outline: deep
---

<!-- source: ${srcLabel} — run pnpm --filter directwerk-docs sync-changelog after editing -->

${body}`

mkdirSync(dirname(dest), { recursive: true })
writeFileSync(dest, out)
console.log(`Synced ${relative(root, dest)} from ${srcLabel}`)
