import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {fileURLToPath} from 'node:url'

// Issue #573: the tmux launchers listed a deleted example-fe window and kept the app list
// duplicated across several scripts.
const script = readFileSync(new URL('./dev.sh', import.meta.url), 'utf8')

const apps = [...script.matchAll(/APPS\+?=\(([^)]*)\)/g)].flatMap((match) =>
    match[1].trim().split(/\s+/).filter(Boolean),
)

test('every launcher window points at an existing app', () => {
    assert.ok(apps.length > 0, 'no APPS entries found in scripts/dev.sh')
    for (const app of apps) {
        assert.ok(
            existsSync(new URL(`../${app}`, import.meta.url)),
            `${app} is listed in scripts/dev.sh but does not exist`,
        )
    }
})

test('no launcher still references the deleted example app', () => {
    assert.doesNotMatch(script, /example-fe/)
})

// Issue #710: the Docker workspace copy lists are hand-maintained and nothing executes them
// before a deploy, so a renamed root file surfaced as `cp: can't stat` in an image build.
const dockerSources = ['scripts/docker-assemble-app.sh', 'directwerk-docs/Dockerfile'].map(
    (path) => ({path, source: readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')}),
)

test('every file the Docker copy lists exists at the repo root', () => {
    for (const {path, source} of dockerSources) {
        const copies =
            source.match(/cp\s+["']?(?:\/ctx\/|\$CTX\/)\S+(?:\s+["']?(?:\/ctx\/|\$CTX\/)\S+)*/g) ?? []
        const files = copies.flatMap((line) =>
            [...line.matchAll(/["']?(?:\/ctx\/|\$CTX\/)([A-Za-z0-9._-]+)/g)].map((match) => match[1]),
        )
        assert.ok(files.length > 0, `no copy sources found in ${path}`)
        for (const file of files) {
            assert.ok(
                existsSync(new URL(`../${file}`, import.meta.url)),
                `${file} is copied in ${path} but does not exist`,
            )
        }
    }
})

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

function runCircularCheck(pnpmScript) {
    const binDir = mkdtempSync(path.join(tmpdir(), 'dw-fake-pnpm-'))
    const pnpmBin = path.join(binDir, 'pnpm')
    writeFileSync(pnpmBin, pnpmScript)
    chmodSync(pnpmBin, 0o755)
    try {
        return {
            status: 0,
            stdout: execFileSync(process.execPath, ['scripts/check-circular-deps.mjs'], {
                cwd: repoRoot,
                env: {...process.env, PATH: `${binDir}:${process.env.PATH}`},
                encoding: 'utf8',
                stdio: 'pipe',
            }),
        }
    } catch (error) {
        return {
            status: error.status,
            stdout: String(error.stdout ?? ''),
            stderr: String(error.stderr ?? ''),
        }
    } finally {
        rmSync(binDir, {recursive: true, force: true})
    }
}

test('reports a cycle as a cycle, not a tool failure (#1084)', () => {
    const result = runCircularCheck('#!/bin/sh\necho "Found 1 circular dependency"\nexit 1\n')

    assert.equal(result.status, 1)
    assert.match(result.stderr, /Circular dependencies detected/)
    assert.doesNotMatch(result.stderr, /tool failure/)
})

test('reports a broken madge run as a tool failure (#1084)', () => {
    const result = runCircularCheck('#!/bin/sh\necho "madge: not found" >&2\nexit 127\n')

    assert.equal(result.status, 2)
    assert.match(result.stderr, /tool failure/)
    assert.doesNotMatch(result.stderr, /Circular dependencies detected/)
})

test('reports both when a cycle and a tool failure occur in one run (#1084)', () => {
    const result = runCircularCheck(
        '#!/bin/sh\nif [ -f "${0}.seen" ]; then echo "madge: not found" >&2; exit 127; fi\ntouch "${0}.seen"\necho "Found 1 circular dependency"\nexit 1\n',
    )

    assert.equal(result.status, 2)
    assert.match(result.stderr, /Circular dependencies detected/)
    assert.match(result.stderr, /tool failure/)
})
