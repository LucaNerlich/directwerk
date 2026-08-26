import {JOB_STATUSES} from '../constants'
import type {QueueJob} from '../types'
import {isRecord} from './primitives'

/** Guard for platform queue jobs (`QueueJobView`). */
export function isQueueJob(value: unknown): value is QueueJob {
    if (!isRecord(value)) {
        return false
    }

    const job = value as Record<string, unknown>

    return (
        typeof job.id === 'string' &&
        typeof job.queue === 'string' &&
        Object.hasOwn(job, 'payload') &&
        typeof job.priority === 'number' &&
        typeof job.status === 'string' &&
        JOB_STATUSES.includes(job.status as never) &&
        typeof job.availableAt === 'string' &&
        typeof job.attempts === 'number' &&
        typeof job.maxAttempts === 'number' &&
        (job.lockedBy === null || typeof job.lockedBy === 'string') &&
        (job.lockedUntil === null || typeof job.lockedUntil === 'string') &&
        (job.lastError === null || typeof job.lastError === 'string') &&
        typeof job.createdAt === 'string' &&
        typeof job.updatedAt === 'string'
    )
}
