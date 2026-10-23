import assert from 'node:assert/strict'
import {existsSync, readFileSync} from 'node:fs'
import test from 'node:test'

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
