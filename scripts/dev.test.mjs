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
