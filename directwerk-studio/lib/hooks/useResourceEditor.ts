'use client'

import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type Dispatch,
    type FormEvent,
    type SetStateAction,
} from 'react'
import {useRouter} from 'next/navigation'

import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'
import {getClientTenantHost} from '@directwerk/api/tenant'

/**
 * Fallback messages for the four failure paths a resource editor can hit.
 * Concrete errors thrown by the API always win over these defaults.
 */
export interface ResourceEditorMessages {
    /** Shown when a collection lookup finds no entity with the requested id. */
    notFound: string
    /** Fallback when loading throws without a usable message. */
    loadFailed: string
    /** Fallback for create/update failures. */
    saveFailed?: string
    /** Fallback for deactivate failures. */
    deactivateFailed?: string
}

export interface ResourceEditorConfig<
    Entity extends {id: number},
    Values,
    CreateInput,
    UpdateInput,
> {
    /** Entity to edit; omit (or leave `undefined`) to create a new one. */
    id?: number
    /** Loads the collection an entity is found in (used with `id`). */
    load?: (host: string) => Promise<Entity[]>
    /** Loads a single entity directly (preferred over `load` when available). */
    loadOne?: (host: string, id: number) => Promise<Entity>
    /** When true (and no `id` is given), still run `load` — e.g. for parent options. */
    alwaysLoad?: boolean
    create?: (host: string, input: CreateInput) => Promise<Entity>
    update: (host: string, id: number, input: UpdateInput) => Promise<Entity>
    deactivate?: (host: string, id: number) => Promise<Entity>
    initialValues: Values
    /** Maps a loaded/updated entity onto the form values. */
    toValues: (entity: Entity) => Values
    /** Returns a validation message to block submit, or `null` when valid. */
    validate?: (values: Values) => string | null
    buildCreate: (values: Values) => CreateInput
    buildUpdate: (values: Values, entity: Entity | null) => UpdateInput
    /** Where to send the browser after a successful create. */
    redirectPath?: (created: Entity) => string
    messages: ResourceEditorMessages
    /** Message shown after a successful create (usually unseen behind the redirect). */
    createSuccessMessage?: (created: Entity) => string
    /** Message shown after a successful update. */
    updateSuccessMessage?: string
    /** Message shown after a successful deactivate. */
    deactivateSuccessMessage?: string
    /**
     * Runs after a create, before redirecting. Return `{ok: false}` to stay on
     * the form (e.g. a follow-up publish failed); the given entity is applied.
     */
    afterCreate?: (context: {
        host: string
        created: Entity
        values: Values
    }) => Promise<ResourceEditorAfterCreate<Entity>>
}

export interface ResourceEditorAfterCreate<Entity> {
    ok: boolean
    entity?: Entity
    message?: string
}

export interface ResourceEditorState<Entity, Values> {
    /** Loaded/created/updated entity, or `null` while new or not found. */
    entity: Entity | null
    /** Full collection when `load` was used (useful for relation pickers). */
    entities: Entity[]
    values: Values
    setField: <K extends keyof Values>(field: K, value: Values[K]) => void
    setValues: Dispatch<SetStateAction<Values>>
    /** Applies an entity returned outside `handleSubmit` (e.g. a workflow action). */
    applyEntity: (entity: Entity) => void
    /** The id currently being edited (given id or the id created this session). */
    effectiveId?: number
    isNew: boolean
    isLoading: boolean
    loadError: string | null
    reload: () => void
    isSaving: boolean
    isDeactivating: boolean
    errorMessage: string | null
    statusMessage: string | null
    setErrorMessage: (message: string | null) => void
    setStatusMessage: (message: string | null) => void
    /** Auth-redirects the error when needed, otherwise surfaces its message. */
    reportError: (error: unknown, fallback: string) => void
    handleSubmit: (event?: FormEvent<HTMLFormElement>) => Promise<void>
    handleDeactivate: () => Promise<void>
    /** Wraps a non-form mutation with the shared saving/error/auth state. */
    runAction: <T>(
        action: () => Promise<T>,
        options?: {failedMessage?: string},
    ) => Promise<T | null>
}

/**
 * Shared controller for studio resource editors (product, category, format,
 * series): loads a collection or detail, finds the edited row, and runs
 * create/update/deactivate with the project's error, status and auth handling.
 */
export function useResourceEditor<
    Entity extends {id: number},
    Values,
    CreateInput,
    UpdateInput,
>(
    config: ResourceEditorConfig<Entity, Values, CreateInput, UpdateInput>,
): ResourceEditorState<Entity, Values> {
    const router = useRouter()
    const authRedirect = useAuthRequired()

    // Keep the latest config/callbacks in refs so the load effect only depends
    // on the id, and so mocked router/auth objects can't retrigger it.
    const configRef = useRef(config)
    configRef.current = config
    const authRedirectRef = useRef(authRedirect)
    authRedirectRef.current = authRedirect

    const [entity, setEntity] = useState<Entity | null>(null)
    const [entities, setEntities] = useState<Entity[]>([])
    const [values, setValues] = useState<Values>(config.initialValues)
    const [createdId, setCreatedId] = useState<number | null>(null)
    const [reloadToken, setReloadToken] = useState(0)
    const [isLoading, setIsLoading] = useState(config.id !== undefined)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [isDeactivating, setIsDeactivating] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [statusMessage, setStatusMessage] = useState<string | null>(null)

    const effectiveId = config.id ?? createdId ?? undefined
    const isNew = effectiveId === undefined

    const valuesRef = useRef(values)
    valuesRef.current = values
    const entityRef = useRef(entity)
    entityRef.current = entity
    const effectiveIdRef = useRef(effectiveId)
    effectiveIdRef.current = effectiveId

    const setField = useCallback(
        <K extends keyof Values>(field: K, value: Values[K]) => {
            setValues((previous) => ({...previous, [field]: value}) as Values)
        },
        [],
    )

    const applyEntity = useCallback((next: Entity) => {
        setEntity(next)
        setValues(configRef.current.toValues(next))
    }, [])

    const reload = useCallback(() => {
        setReloadToken((value) => value + 1)
    }, [])

    const reportError = useCallback((error: unknown, fallback: string) => {
        if (authRedirectRef.current(error)) {
            return
        }
        setErrorMessage(error instanceof Error ? error.message : fallback)
    }, [])

    useEffect(() => {
        const cfg = configRef.current
        const requestedId = cfg.id
        const shouldLoad = requestedId !== undefined || cfg.alwaysLoad === true
        if (!shouldLoad) {
            setIsLoading(false)
            return
        }

        let active = true
        if (requestedId !== undefined) {
            setIsLoading(true)
        }
        setLoadError(null)
        setErrorMessage(null)

        const run = async (): Promise<void> => {
            const host = getClientTenantHost()
            try {
                let found: Entity | null = null
                if (cfg.loadOne !== undefined && requestedId !== undefined) {
                    found = await cfg.loadOne(host, requestedId)
                } else if (cfg.load !== undefined) {
                    const list = await cfg.load(host)
                    if (!active) {
                        return
                    }
                    setEntities(list)
                    if (requestedId !== undefined) {
                        found = list.find((item) => item.id === requestedId) ?? null
                    }
                }

                if (!active) {
                    return
                }
                if (requestedId !== undefined && found === null) {
                    setLoadError(cfg.messages.notFound)
                    setErrorMessage(cfg.messages.notFound)
                    setIsLoading(false)
                    return
                }
                if (found !== null) {
                    setEntity(found)
                    setValues(cfg.toValues(found))
                }
                setIsLoading(false)
            } catch (error) {
                if (!active) {
                    return
                }
                if (authRedirectRef.current(error)) {
                    return
                }
                const message =
                    error instanceof Error ? error.message : cfg.messages.loadFailed
                setLoadError(message)
                setErrorMessage(message)
                setIsLoading(false)
            }
        }

        void run()

        return () => {
            active = false
        }
    }, [config.id, config.alwaysLoad, reloadToken])

    const runAction = useCallback(
        async <T,>(
            action: () => Promise<T>,
            options?: {failedMessage?: string},
        ): Promise<T | null> => {
            const cfg = configRef.current
            setIsSaving(true)
            setErrorMessage(null)
            try {
                return await action()
            } catch (error) {
                if (authRedirectRef.current(error)) {
                    return null
                }
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : options?.failedMessage ??
                              cfg.messages.saveFailed ??
                              'Aktion fehlgeschlagen.',
                )
                return null
            } finally {
                setIsSaving(false)
            }
        },
        [],
    )

    const handleSubmit = useCallback(
        async (event?: FormEvent<HTMLFormElement>): Promise<void> => {
            event?.preventDefault()
            const cfg = configRef.current
            const currentValues = valuesRef.current

            setIsSaving(true)
            setErrorMessage(null)
            setStatusMessage(null)
            setLoadError(null)

            const validation = cfg.validate?.(currentValues) ?? null
            if (validation !== null) {
                setErrorMessage(validation)
                setIsSaving(false)
                return
            }

            const host = getClientTenantHost()
            try {
                const targetId = effectiveIdRef.current
                if (targetId === undefined) {
                    if (cfg.create === undefined) {
                        return
                    }
                    const created = await cfg.create(host, cfg.buildCreate(currentValues))
                    setCreatedId(created.id)
                    setEntity(created)

                    if (cfg.afterCreate !== undefined) {
                        const outcome = await cfg.afterCreate({
                            host,
                            created,
                            values: currentValues,
                        })
                        if (!outcome.ok) {
                            const fallback = outcome.entity ?? created
                            setEntity(fallback)
                            setValues(cfg.toValues(fallback))
                            if (outcome.message !== undefined) {
                                setErrorMessage(outcome.message)
                            }
                            return
                        }
                    }

                    if (cfg.createSuccessMessage !== undefined) {
                        setStatusMessage(cfg.createSuccessMessage(created))
                    }
                    if (cfg.redirectPath !== undefined) {
                        router.replace(cfg.redirectPath(created))
                    }
                    return
                }

                const updated = await cfg.update(
                    host,
                    targetId,
                    cfg.buildUpdate(currentValues, entityRef.current),
                )
                setEntity(updated)
                setValues(cfg.toValues(updated))
                if (cfg.updateSuccessMessage !== undefined) {
                    setStatusMessage(cfg.updateSuccessMessage)
                }
            } catch (error) {
                if (authRedirectRef.current(error)) {
                    return
                }
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : cfg.messages.saveFailed ?? 'Aktion fehlgeschlagen.',
                )
            } finally {
                setIsSaving(false)
            }
        },
        [router],
    )

    const handleDeactivate = useCallback(async (): Promise<void> => {
        const cfg = configRef.current
        const targetId = effectiveIdRef.current
        if (targetId === undefined || cfg.deactivate === undefined) {
            return
        }
        setIsDeactivating(true)
        setErrorMessage(null)
        setStatusMessage(null)
        try {
            const updated = await cfg.deactivate(getClientTenantHost(), targetId)
            setEntity(updated)
            setValues(cfg.toValues(updated))
            if (cfg.deactivateSuccessMessage !== undefined) {
                setStatusMessage(cfg.deactivateSuccessMessage)
            }
        } catch (error) {
            if (authRedirectRef.current(error)) {
                return
            }
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : cfg.messages.deactivateFailed ?? 'Deaktivierung fehlgeschlagen.',
            )
        } finally {
            setIsDeactivating(false)
        }
    }, [])

    return {
        entity,
        entities,
        values,
        setField,
        setValues,
        applyEntity,
        effectiveId,
        isNew,
        isLoading,
        loadError,
        reload,
        isSaving,
        isDeactivating,
        errorMessage,
        statusMessage,
        setErrorMessage,
        setStatusMessage,
        reportError,
        handleSubmit,
        handleDeactivate,
        runAction,
    }
}
