import {SLUG_PATTERN} from '../constants'
import type {
    CreateTenantInput,
    JobListQuery,
    JobStatus,
    ModulePresetKey,
    TenantInvitableRole,
} from '../types'
import {
    JOB_STATUSES,
    MODULE_PRESETS,
    PLATFORM_TENANT_INVITABLE_ROLES,
} from '../types'
import {parseTenantHost} from '../proxy'
import {isRecord, isValidEmail} from './primitives'
import type {LoginInput} from './input'

export type LoginCredentials = LoginInput

export type LoginValidationResult =
    | {success: true; data: LoginCredentials}
    | {success: false; error: string}

interface TenantUserInviteInput {
    email: string
    name: string | null
    role: TenantInvitableRole
}

export type TenantUserInviteValidationResult =
    | {success: true; data: TenantUserInviteInput}
    | {success: false; error: string}

interface PlatformAdminInviteInput {
    email: string
    name: string | null
}

export type PlatformAdminInviteValidationResult =
    | {success: true; data: PlatformAdminInviteInput}
    | {success: false; error: string}

export type JobListQueryValidationResult =
    | {success: true; data: JobListQuery}
    | {success: false; error: string}

export type CreateTenantValidationResult =
    | {success: true; data: CreateTenantInput}
    | {success: false; error: string}

const LOGIN_KEYS = new Set(['email', 'password'])
const TENANT_INVITE_KEYS = new Set(['email', 'name', 'role'])
const PLATFORM_ADMIN_INVITE_KEYS = new Set(['email', 'name'])
const CREATE_TENANT_KEYS = new Set([
    'name',
    'slug',
    'primaryDomain',
    'modulePreset',
    'adminEmail',
    'adminName',
])
const JOB_LIST_QUERY_KEYS = new Set([
    'queue',
    'status',
    'updatedAfter',
    'updatedBefore',
    'offset',
    'limit',
])
const TENANT_INVITABLE_ROLE_SET = new Set<string>(PLATFORM_TENANT_INVITABLE_ROLES)
const MODULE_PRESET_SET = new Set<string>(MODULE_PRESETS)
const JOB_STATUS_SET = new Set<string>(JOB_STATUSES)
const MAX_NAME_LENGTH = 200
const MAX_TENANT_NAME_LENGTH = 255
const MAX_QUEUE_NAME_LENGTH = 100
const SAFE_QUEUE_NAME = /^[A-Za-z0-9_-]+$/
const ISO_INSTANT =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/

/**
 * Validates and normalizes login credentials.
 *
 * @param input - The value containing the login credentials
 * @returns A successful validation result with trimmed email and password, or a validation error
 */
export function validateLoginInput(input: unknown): LoginValidationResult {
    if (
        !isRecord(input) ||
        Object.keys(input).some((key) => !LOGIN_KEYS.has(key))
    ) {
        return {success: false, error: 'Invalid login request.'}
    }

    const {email, password} = input
    const normalizedEmail = typeof email === 'string' ? email.trim() : ''

    if (
        !isValidEmail(normalizedEmail) ||
        normalizedEmail.length > 254 ||
        typeof password !== 'string' ||
        password.length < 1 ||
        password.length > 1024
    ) {
        return {
            success: false,
            error: 'Enter a valid email address and password.',
        }
    }

    return {
        success: true,
        data: {email: normalizedEmail, password},
    }
}


/**
 * Validates and normalizes a tenant user invitation request.
 *
 * @param input - The untrusted invitation data to validate
 * @returns A successful result with normalized invitation data, or a validation error
 */
export function validateTenantUserInviteInput(
    input: unknown
): TenantUserInviteValidationResult {
    if (
        !isRecord(input) ||
        Object.keys(input).some((key) => !TENANT_INVITE_KEYS.has(key))
    ) {
        return {success: false, error: 'Invalid invitation request.'}
    }

    const {email, name, role} = input
    const normalizedEmail = typeof email === 'string' ? email.trim() : ''

    if (name !== null && typeof name !== 'string') {
        return {
            success: false,
            error: 'Enter a valid email address and role.',
        }
    }

    const normalizedName =
        typeof name === 'string' && name.trim().length > 0
            ? name.trim()
            : null

    if (
        !isValidEmail(normalizedEmail) ||
        normalizedEmail.length > 254 ||
        (normalizedName !== null && normalizedName.length > MAX_NAME_LENGTH) ||
        typeof role !== 'string' ||
        !TENANT_INVITABLE_ROLE_SET.has(role)
    ) {
        return {
            success: false,
            error: 'Enter a valid email address and role.',
        }
    }

    return {
        success: true,
        data: {
            email: normalizedEmail,
            name: normalizedName,
            role: role as TenantInvitableRole,
        },
    }
}

/**
 * Validates and normalizes a platform administrator invitation request.
 *
 * @param input - The invitation data to validate
 * @returns A successful validation result with a trimmed email and optional name, or an error result
 */
export function validatePlatformAdminInviteInput(
    input: unknown
): PlatformAdminInviteValidationResult {
    if (
        !isRecord(input) ||
        Object.keys(input).some((key) => !PLATFORM_ADMIN_INVITE_KEYS.has(key))
    ) {
        return {success: false, error: 'Invalid invitation request.'}
    }

    const {email, name} = input
    const normalizedEmail = typeof email === 'string' ? email.trim() : ''

    if (name !== null && typeof name !== 'string') {
        return {
            success: false,
            error: 'Enter a valid email address.',
        }
    }

    const normalizedName =
        typeof name === 'string' && name.trim().length > 0
            ? name.trim()
            : null

    if (
        !isValidEmail(normalizedEmail) ||
        normalizedEmail.length > 254 ||
        (normalizedName !== null && normalizedName.length > MAX_NAME_LENGTH)
    ) {
        return {
            success: false,
            error: 'Enter a valid email address.',
        }
    }

    return {
        success: true,
        data: {
            email: normalizedEmail,
            name: normalizedName,
        },
    }
}

function parseOptionalString(value: unknown): string | undefined {
    if (value === undefined || value === null) {
        return undefined
    }

    if (typeof value !== 'string') {
        return undefined
    }

    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
}

/**
 * Parses an optional ISO instant value.
 *
 * @param value - The value to parse
 * @returns The trimmed ISO instant string, or `undefined` if the value is missing or invalid
 */
function parseOptionalInstant(value: unknown): string | undefined {
    const normalized = parseOptionalString(value)

    if (normalized === undefined) {
        return undefined
    }

    if (!ISO_INSTANT.test(normalized) || Number.isNaN(Date.parse(normalized))) {
        return undefined
    }

    return normalized
}

/**
 * Parses an optional integer and restricts it to an inclusive range.
 *
 * @param value - The value to parse
 * @param min - The minimum allowed value
 * @param max - The maximum allowed value
 * @returns The parsed integer if valid, otherwise `undefined`
 */
function parseOptionalIntInRange(
    value: unknown,
    min: number,
    max: number,
): number | undefined {
    if (value === undefined || value === null || value === '') {
        return undefined
    }

    const parsed =
        typeof value === 'number'
            ? value
            : typeof value === 'string' && /^\d+$/.test(value.trim())
              ? Number.parseInt(value.trim(), 10)
              : Number.NaN

    if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
        return undefined
    }

    return parsed
}

/**
 * Parses an optional pagination offset.
 *
 * @returns A nonnegative safe integer, or `undefined` for invalid or absent input.
 */
function parseOptionalOffset(value: unknown): number | undefined {
    return parseOptionalIntInRange(value, 0, Infinity)
}

/**
 * Parses an optional page size within the supported range.
 *
 * @param value - The value to parse
 * @returns An integer from 1 through 100, or `undefined` for invalid or absent values
 */
function parseOptionalLimit(value: unknown): number | undefined {
    return parseOptionalIntInRange(value, 1, 100)
}

/**
 * Validates and normalizes tenant creation data.
 *
 * @param input - The untrusted tenant creation input
 * @returns A normalized tenant input on success, or a validation error
 */
export function validateCreateTenantInput(
    input: unknown
): CreateTenantValidationResult {
    if (
        !isRecord(input) ||
        Object.keys(input).some((key) => !CREATE_TENANT_KEYS.has(key))
    ) {
        return {success: false, error: 'Invalid create-tenant request.'}
    }

    const record = input
    const name = typeof record.name === 'string' ? record.name.trim() : ''
    const slug = typeof record.slug === 'string' ? record.slug.trim() : ''
    const primaryDomain = parseOptionalString(record.primaryDomain)
    const modulePreset = parseOptionalString(record.modulePreset)
    const adminEmail = parseOptionalString(record.adminEmail)
    const adminName = parseOptionalString(record.adminName)

    if (
        name.length < 1 ||
        name.length > MAX_TENANT_NAME_LENGTH ||
        !SLUG_PATTERN.test(slug)
    ) {
        return {
            success: false,
            error: 'Enter a valid tenant name and slug.',
        }
    }

    if (
        modulePreset !== undefined &&
        !MODULE_PRESET_SET.has(modulePreset)
    ) {
        return {success: false, error: 'Choose a valid module preset.'}
    }

    if (
        adminEmail !== undefined &&
        (!isValidEmail(adminEmail) || adminEmail.length > 254)
    ) {
        return {success: false, error: 'Enter a valid admin email.'}
    }

    if (
        adminName !== undefined &&
        adminName.length > MAX_TENANT_NAME_LENGTH
    ) {
        return {success: false, error: 'Enter a valid admin name.'}
    }

    let normalizedPrimaryDomain: string | undefined
    if (primaryDomain !== undefined) {
        const host = parseTenantHost(primaryDomain)
        if (host === null) {
            return {success: false, error: 'Enter a valid primary domain.'}
        }
        normalizedPrimaryDomain = host
    }

    const data: CreateTenantInput = {name, slug}

    if (normalizedPrimaryDomain !== undefined) {
        data.primaryDomain = normalizedPrimaryDomain
    }

    if (modulePreset !== undefined) {
        data.modulePreset = modulePreset as ModulePresetKey
    }

    if (adminEmail !== undefined) {
        data.adminEmail = adminEmail
    }

    if (adminName !== undefined) {
        data.adminName = adminName
    }

    return {success: true, data}
}

export function validateJobListQuery(
    input: unknown
): JobListQueryValidationResult {
    if (
        !isRecord(input) ||
        Object.keys(input).some((key) => !JOB_LIST_QUERY_KEYS.has(key))
    ) {
        return {success: false, error: 'Invalid job list request.'}
    }

    const record = input

    if (
        record.queue !== undefined &&
        record.queue !== null &&
        typeof record.queue !== 'string'
    ) {
        return {success: false, error: 'Enter a valid queue filter.'}
    }

    const queue = parseOptionalString(record.queue)

    if (
        queue !== undefined &&
        (queue.length > MAX_QUEUE_NAME_LENGTH || !SAFE_QUEUE_NAME.test(queue))
    ) {
        return {success: false, error: 'Enter a valid queue filter.'}
    }

    if (
        record.status !== undefined &&
        record.status !== null &&
        typeof record.status !== 'string'
    ) {
        return {success: false, error: 'Enter a valid status filter.'}
    }

    const statusValue = parseOptionalString(record.status)

    if (statusValue !== undefined && !JOB_STATUS_SET.has(statusValue)) {
        return {success: false, error: 'Enter a valid status filter.'}
    }

    const updatedAfter = parseOptionalInstant(record.updatedAfter)
    const updatedBefore = parseOptionalInstant(record.updatedBefore)

    if (
        (record.updatedAfter !== undefined &&
            record.updatedAfter !== null &&
            record.updatedAfter !== '' &&
            updatedAfter === undefined) ||
        (record.updatedBefore !== undefined &&
            record.updatedBefore !== null &&
            record.updatedBefore !== '' &&
            updatedBefore === undefined)
    ) {
        return {success: false, error: 'Enter valid updated date filters.'}
    }

    const offset = parseOptionalOffset(record.offset)

    if (
        record.offset !== undefined &&
        record.offset !== null &&
        record.offset !== '' &&
        offset === undefined
    ) {
        return {success: false, error: 'Enter a valid page offset.'}
    }

    const limit = parseOptionalLimit(record.limit)

    if (
        record.limit !== undefined &&
        record.limit !== null &&
        record.limit !== '' &&
        limit === undefined
    ) {
        return {success: false, error: 'Enter a valid page size.'}
    }

    const data: JobListQuery = {}

    if (queue !== undefined) {
        data.queue = queue
    }

    if (statusValue !== undefined) {
        data.status = statusValue as JobStatus
    }

    if (updatedAfter !== undefined) {
        data.updatedAfter = updatedAfter
    }

    if (updatedBefore !== undefined) {
        data.updatedBefore = updatedBefore
    }

    if (offset !== undefined) {
        data.offset = offset
    }

    if (limit !== undefined) {
        data.limit = limit
    }

    return {
        success: true,
        data,
    }
}
