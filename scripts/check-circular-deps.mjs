#!/usr/bin/env node
/**
 * Circular-dependency guard for the cleanup sweep scope.
 * Frontend: madge with each package tsconfig so `@/` path aliases resolve.
 * Backend: Gradle `project(':…')` edges must form a DAG (no module cycles).
 */
import {execSync} from 'node:child_process'
import {readFileSync, readdirSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import path from 'node:path'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const directwerkRoot = path.join(repoRoot, 'Directwerk')

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

process.stdout.write('\n=== Directwerk Gradle modules ===\n')

/** @type {Map<string, Set<string>>} */
const moduleDeps = new Map()

for (const entry of readdirSync(directwerkRoot, {withFileTypes: true})) {
    if (!entry.isDirectory() || !entry.name.startsWith('directwerk-')) {
        continue
    }

    const buildFile = path.join(directwerkRoot, entry.name, 'build.gradle')
    let contents
    try {
        contents = readFileSync(buildFile, 'utf8')
    } catch {
        continue
    }

    const deps = new Set()
    for (const match of contents.matchAll(/project\(':(directwerk-[^']+)'\)/g)) {
        deps.add(match[1])
    }
    moduleDeps.set(entry.name, deps)
}

/** @param {string} node @param {string[]} stack @param {Set<string>} visiting @param {Set<string>} visited @returns {string[] | null} */
function findCycle(node, stack, visiting, visited) {
    if (visiting.has(node)) {
        const cycleStart = stack.indexOf(node)
        return [...stack.slice(cycleStart), node]
    }
    if (visited.has(node)) {
        return null
    }

    visiting.add(node)
    stack.push(node)

    for (const dep of moduleDeps.get(node) ?? []) {
        const cycle = findCycle(dep, stack, visiting, visited)
        if (cycle) {
            return cycle
        }
    }

    stack.pop()
    visiting.delete(node)
    visited.add(node)
    return null
}

/** @type {Set<string>} */
const visited = new Set()
let gradleCycle = null

for (const moduleName of moduleDeps.keys()) {
    gradleCycle = findCycle(moduleName, [], new Set(), visited)
    if (gradleCycle) {
        break
    }
}

if (gradleCycle) {
    failed = true
    console.error(`✖ Gradle module cycle: ${gradleCycle.join(' → ')}`)
} else {
    console.log(`✔ No circular Gradle module dependencies (${moduleDeps.size} modules).`)
}

if (failed) {
    console.error('\nCircular dependencies detected.')
    process.exit(1)
}

console.log('\nNo circular dependencies in cleanup scope.')
