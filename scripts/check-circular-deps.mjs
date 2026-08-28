#!/usr/bin/env node
/**
 * Frontend circular-dependency guard for the cleanup sweep scope.
 * Uses madge with each package's tsconfig so `@/` path aliases resolve.
 */
import {execSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import path from 'node:path'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Packages in scope for the frontend circular-deps audit. */
const PACKAGES = [
    {dir: 'directwerk-studio', tsconfig: 'directwerk-studio/tsconfig.json'},
    {dir: 'directwerk-web', tsconfig: 'directwerk-web/tsconfig.json'},
    {dir: 'directwerk-admin', tsconfig: 'directwerk-admin/tsconfig.json'},
    {dir: 'homepage', tsconfig: 'homepage/tsconfig.json'},
    {dir: 'packages/api', tsconfig: 'packages/api/tsconfig.json'},
    {dir: 'packages/ui', tsconfig: 'packages/ui/tsconfig.json'},
]

let failed = false

for (const pkg of PACKAGES) {
    process.stdout.write(`\n=== ${pkg.dir} ===\n`)
    try {
        execSync(
            `pnpm dlx madge --circular --extensions ts,tsx --ts-config ${pkg.tsconfig} ${pkg.dir}`,
            {cwd: repoRoot, stdio: 'inherit'},
        )
    } catch {
        failed = true
    }
}

if (failed) {
    console.error('\nCircular dependencies detected.')
    process.exit(1)
}

console.log('\nNo circular dependencies in frontend scope.')
