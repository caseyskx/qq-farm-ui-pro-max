import { getCommonStatusTokens, resolveThemeTokens } from '@/theme/tokens'

type ThemeMode = 'light' | 'dark'

export function applyThemeTokens(themeKey: string, themeMode: ThemeMode, target: HTMLElement = document.documentElement) {
  const tokens = resolveThemeTokens(themeKey, themeMode)
  const statusTokens = getCommonStatusTokens()

  const cssVars: Record<string, string> = {
    '--ui-bg-canvas': tokens.canvas,
    '--ui-bg-surface': tokens.surface,
    '--ui-bg-surface-raised': tokens.surfaceRaised,
    '--ui-border-subtle': tokens.border,
    '--ui-border-strong': tokens.borderStrong,
    '--ui-text-1': tokens.textMain,
    '--ui-text-2': tokens.textMuted,
    '--ui-text-3': tokens.textSoft,
    '--ui-text-on-brand': '#ffffff',
    '--ui-glass-bg': tokens.glassBg,
    '--ui-glass-border': tokens.glassBorder,
    '--ui-focus-ring': 'rgba(var(--color-primary-500), 0.25)',
    '--ui-scrollbar-thumb': tokens.scrollbarThumb,
    '--ui-scrollbar-thumb-hover': tokens.scrollbarThumbHover,
    '--ui-orb-1': tokens.orb1,
    '--ui-orb-2': tokens.orb2,
    '--ui-orb-3': tokens.orb3,

    // Backward-compatible aliases to keep existing UI stable
    '--theme-bg': tokens.themeBg,
    '--theme-dark-bg': tokens.themeDarkBg,
    '--glass-bg': tokens.glassBg,
    '--glass-border': tokens.glassBorder,
    '--text-main': tokens.textMain,
    '--text-muted': tokens.textMuted,
    '--orb-1': tokens.orb1,
    '--orb-2': tokens.orb2,
    '--orb-3': tokens.orb3,
  }

  Object.entries(cssVars).forEach(([name, value]) => {
    target.style.setProperty(name, value)
  })
  Object.entries(statusTokens).forEach(([name, value]) => {
    target.style.setProperty(name, value)
  })

  target.setAttribute('data-theme-mode', themeMode)
}
