'use client'

import {createSiteConfigProvider} from '@directwerk/api/site/createSiteConfigProvider'
import type {PublicSiteConfig} from '@directwerk/api/types'

const {SiteConfigProvider, useSiteConfig} = createSiteConfigProvider<PublicSiteConfig>()

export {SiteConfigProvider, useSiteConfig}
