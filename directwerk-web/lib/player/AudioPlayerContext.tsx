'use client'

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react'

import {trackEpisodePlay} from '@/lib/analytics/umamiTrack'

/**
 * Episode metadata loaded into the site-wide player. `audioUrl` is the
 * entitled CDN URL (`audioCdnUrl`) — never persist it; private presigns must
 * stay in memory for the session only.
 */
export interface PlayerTrack {
    slug: string
    title: string
    audioUrl: string
    coverImageUrl: string | null
    /** Locale-prefixed href to the episode detail page. */
    href: string
}

interface AudioPlayerValue {
    track: PlayerTrack | null
    isPlaying: boolean
    currentTime: number
    duration: number
    /** Load (or resume) a track and start playback. No-ops when `audioUrl` is empty. */
    playTrack: (track: PlayerTrack) => void
    togglePlay: () => void
    pause: () => void
    seek: (seconds: number) => void
    /** Stop playback and clear the active track (hides the mini-player). */
    dismiss: () => void
}

const AudioPlayerContext = createContext<AudioPlayerValue | null>(null)

export function AudioPlayerProvider({
    children,
}: {
    children: ReactNode
}): React.JSX.Element {
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const [track, setTrack] = useState<PlayerTrack | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    /** Slug awaiting the next successful `play` event for Umami. */
    const pendingPlayTrackSlugRef = useRef<string | null>(null)
    /** Slug currently loaded into the `<audio>` element. */
    const loadedSlugRef = useRef<string | null>(null)
    /** `audioUrl` currently assigned to `<audio src>` (presigns can rotate). */
    const loadedUrlRef = useRef<string | null>(null)

    useEffect(() => {
        const audio = audioRef.current
        if (audio === null) {
            return
        }

        const onTimeUpdate = (): void => {
            setCurrentTime(audio.currentTime)
        }
        const onDurationChange = (): void => {
            setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
        }
        const onPlay = (): void => {
            setIsPlaying(true)
            const slug = pendingPlayTrackSlugRef.current
            if (slug !== null) {
                trackEpisodePlay(slug)
                // Once per load; dismiss clears the ref so a later replay of
                // the same slug after dismiss still reports.
                pendingPlayTrackSlugRef.current = null
            }
        }
        const onPause = (): void => {
            setIsPlaying(false)
        }
        const onEnded = (): void => {
            setIsPlaying(false)
            setCurrentTime(0)
        }

        audio.addEventListener('timeupdate', onTimeUpdate)
        audio.addEventListener('durationchange', onDurationChange)
        audio.addEventListener('loadedmetadata', onDurationChange)
        audio.addEventListener('play', onPlay)
        audio.addEventListener('pause', onPause)
        audio.addEventListener('ended', onEnded)
        return () => {
            audio.removeEventListener('timeupdate', onTimeUpdate)
            audio.removeEventListener('durationchange', onDurationChange)
            audio.removeEventListener('loadedmetadata', onDurationChange)
            audio.removeEventListener('play', onPlay)
            audio.removeEventListener('pause', onPause)
            audio.removeEventListener('ended', onEnded)
        }
    }, [])

    const playTrack = useCallback((next: PlayerTrack) => {
        if (next.audioUrl.length === 0) {
            return
        }
        const audio = audioRef.current
        if (audio === null) {
            return
        }

        // Slug alone is not enough: entitled private URLs rotate (presign TTL).
        const sameSource =
            loadedSlugRef.current === next.slug &&
            loadedUrlRef.current === next.audioUrl
        setTrack(next)
        if (!sameSource) {
            pendingPlayTrackSlugRef.current = next.slug
            loadedSlugRef.current = next.slug
            loadedUrlRef.current = next.audioUrl
            // Assigning `src` runs the media load algorithm; avoid an extra
            // `load()` call (jsdom throws "Not implemented" for it).
            audio.src = next.audioUrl
            setCurrentTime(0)
            setDuration(0)
        }
        void audio.play().catch(() => {
            // Aborted play() (src change / newer play) must not clear a live
            // track's playing state.
            if (audio.paused) {
                setIsPlaying(false)
            }
        })
    }, [])

    const pause = useCallback(() => {
        audioRef.current?.pause()
    }, [])

    const togglePlay = useCallback(() => {
        const audio = audioRef.current
        if (audio === null || track === null) {
            return
        }
        if (audio.paused) {
            void audio.play().catch(() => {
                if (audio.paused) {
                    setIsPlaying(false)
                }
            })
        } else {
            audio.pause()
        }
    }, [track])

    const seek = useCallback((seconds: number) => {
        const audio = audioRef.current
        if (audio === null) {
            return
        }
        if (!Number.isFinite(seconds)) {
            return
        }
        const next = Math.max(0, seconds)
        audio.currentTime = next
        setCurrentTime(next)
    }, [])

    const dismiss = useCallback(() => {
        const audio = audioRef.current
        if (audio !== null) {
            try {
                audio.pause()
            } catch {
                // jsdom media stubs may throw; UI state still clears below.
            }
            audio.removeAttribute('src')
            try {
                audio.load()
            } catch {
                // Same as pause — clearing src is enough for real browsers.
            }
        }
        pendingPlayTrackSlugRef.current = null
        loadedSlugRef.current = null
        loadedUrlRef.current = null
        setTrack(null)
        setIsPlaying(false)
        setCurrentTime(0)
        setDuration(0)
    }, [])

    const value = useMemo<AudioPlayerValue>(
        () => ({
            track,
            isPlaying,
            currentTime,
            duration,
            playTrack,
            togglePlay,
            pause,
            seek,
            dismiss,
        }),
        [
            track,
            isPlaying,
            currentTime,
            duration,
            playTrack,
            togglePlay,
            pause,
            seek,
            dismiss,
        ],
    )

    return (
        <AudioPlayerContext.Provider value={value}>
            {/* Single site-wide media element — survives App Router navigations. */}
            <audio ref={audioRef} preload="metadata" className="hidden" />
            {children}
        </AudioPlayerContext.Provider>
    )
}

export function useAudioPlayer(): AudioPlayerValue {
    const ctx = useContext(AudioPlayerContext)
    if (ctx === null) {
        throw new Error('useAudioPlayer must be used within AudioPlayerProvider')
    }
    return ctx
}
