'use client'

import {createSiteConfigProvider} from '@directwerk/api/site/createSiteConfigProvider'
import type {SiteConfig} from '@directwerk/api/types'

const {SiteConfigProvider, useSiteConfig} = createSiteConfigProvider<SiteConfig>()

export {SiteConfigProvider, useSiteConfig}
