'use client'

import {studioCreatorPolicy} from '@directwerk/api/client/policies'

export const INVALID_RESPONSE: string =
    studioCreatorPolicy.invalidResponseMessage ??
    'Der Server hat eine ungültige Antwort gesendet.'

export {
    authenticatedRequest,
    jsonInit,
    postJson,
    proxyRequest,
    request,
} from './transport'
