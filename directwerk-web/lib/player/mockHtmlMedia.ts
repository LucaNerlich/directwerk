import {vi, type MockInstance} from 'vitest'

function setPaused(el: HTMLMediaElement, paused: boolean): void {
    Object.defineProperty(el, 'paused', {
        configurable: true,
        enumerable: true,
        get: () => paused,
    })
}

/**
 * jsdom does not implement HTMLMediaElement play/pause/load. Stub them for
 * player unit tests so click handlers can drive the site-wide audio element.
 */
export function mockHtmlMedia(): {
    play: MockInstance
    pause: MockInstance
    load: MockInstance
    restore: () => void
} {
    const play = vi
        .spyOn(HTMLMediaElement.prototype, 'play')
        .mockImplementation(function (this: HTMLMediaElement) {
            setPaused(this, false)
            this.dispatchEvent(new Event('play'))
            return Promise.resolve()
        })
    const pause = vi
        .spyOn(HTMLMediaElement.prototype, 'pause')
        .mockImplementation(function (this: HTMLMediaElement) {
            setPaused(this, true)
            this.dispatchEvent(new Event('pause'))
        })
    const load = vi
        .spyOn(HTMLMediaElement.prototype, 'load')
        .mockImplementation(() => undefined)

    return {
        play,
        pause,
        load,
        restore: () => {
            play.mockRestore()
            pause.mockRestore()
            load.mockRestore()
        },
    }
}
