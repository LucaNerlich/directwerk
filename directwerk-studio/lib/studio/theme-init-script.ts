/**
 * Server-safe theme bootstrap helpers.
 *
 * Must stay free of `'use client'` so the root layout can inline the script
 * string during SSR without crossing the client module boundary.
 */

export const STUDIO_THEME_STORAGE_KEY = 'dw.studio.theme'

/**
 * Inline script for early document bootstrap — applies the stored theme before
 * paint so the first frame matches localStorage / system preference.
 *
 * Keep in sync with resolveTheme / applyThemeClass in theme-provider.tsx.
 */
export function themeInitScript(storageKey = STUDIO_THEME_STORAGE_KEY): string {
    return `(function(){try{var k=${JSON.stringify(storageKey)};var t=localStorage.getItem(k);if(t!=="dark"&&t!=="light"&&t!=="system")t="system";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.remove("light","dark");r.classList.add(d?"dark":"light");}catch(e){}})();`
}
