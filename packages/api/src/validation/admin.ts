import {JOB_STATUSES} from '../constants'
import type {QueueJob} from '../types'
import {isRecord} from './primitives'

const JOB_STATUS_VALUES = new Set<string>(JOB_STATUSES)

/** Guard for platform queue jobs (`QueueJobView`). */
export function isQueueJob(value: unknown): value is QueueJob {
    if (!isRecord(value)) {
        return false
    }

    const job = value

    return (
        typeof job.id === 'string' &&
        typeof job.queue === 'string' &&
        Object.hasOwn(job, 'payload') &&
        typeof job.priority === 'number' &&
        typeof job.status === 'string' &&
        JOB_STATUS_VALUES.has(job.status) &&
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
