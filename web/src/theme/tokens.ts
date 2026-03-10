import type { UiColorTheme } from '@/constants/ui-appearance'

export type ResolvedThemeMode = 'light' | 'dark'

interface ThemeModeTokens {
  themeBg: string
  themeDarkBg: string
  glassBg: string
  glassBorder: string
  textMain: string
  textMuted: string
  textSoft: string
  orb1: string
  orb2: string
  orb3: string
  canvas: string
  surface: string
  surfaceRaised: string
  border: string
  borderStrong: string
  scrollbarThumb: string
  scrollbarThumbHover: string
}

const COMMON_STATUS_TOKENS: Record<string, string> = {
  '--ui-status-success': '#16a34a',
  '--ui-status-success-soft': 'rgba(22, 163, 74, 0.08)',
  '--ui-status-warning': '#d97706',
  '--ui-status-warning-soft': 'rgba(217, 119, 6, 0.08)',
  '--ui-status-danger': '#dc2626',
  '--ui-status-danger-soft': 'rgba(220, 38, 38, 0.08)',
  '--ui-status-info': '#0284c7',
  '--ui-status-info-soft': 'rgba(2, 132, 199, 0.08)',
}

const DEFAULT_LIGHT_TOKENS: ThemeModeTokens = {
  themeBg: '#f9fafb',
  themeDarkBg: '#111827',
  glassBg: 'rgba(255, 255, 255, 0.9)',
  glassBorder: 'rgba(0, 0, 0, 0.05)',
  textMain: '#0f172a',
  textMuted: '#475569',
  textSoft: '#64748b',
  orb1: 'transparent',
  orb2: 'transparent',
  orb3: 'transparent',
  canvas: '#f9fafb',
  surface: 'rgba(255, 255, 255, 0.72)',
  surfaceRaised: 'rgba(255, 255, 255, 0.9)',
  border: 'rgba(15, 23, 42, 0.08)',
  borderStrong: 'rgba(15, 23, 42, 0.2)',
  scrollbarThumb: '#cbd5e1',
  scrollbarThumbHover: '#94a3b8',
}

const DEFAULT_DARK_TOKENS: ThemeModeTokens = {
  themeBg: '#f9fafb',
  themeDarkBg: '#111827',
  glassBg: 'rgba(30, 41, 59, 0.7)',
  glassBorder: 'rgba(51, 65, 85, 0.5)',
  textMain: '#f8fafc',
  textMuted: '#94a3b8',
  textSoft: '#64748b',
  orb1: 'transparent',
  orb2: 'transparent',
  orb3: 'transparent',
  canvas: '#111827',
  surface: 'rgba(15, 23, 42, 0.66)',
  surfaceRaised: 'rgba(30, 41, 59, 0.72)',
  border: 'rgba(148, 163, 184, 0.2)',
  borderStrong: 'rgba(148, 163, 184, 0.34)',
  scrollbarThumb: '#475569',
  scrollbarThumbHover: '#64748b',
}

const THEME_TOKEN_MAP: Record<UiColorTheme, Record<ResolvedThemeMode, ThemeModeTokens>> = {
  default: {
    light: { ...DEFAULT_LIGHT_TOKENS },
    dark: { ...DEFAULT_DARK_TOKENS },
  },
  cyber: {
    light: {
      ...DEFAULT_LIGHT_TOKENS,
      themeBg: '#f5f3ff',
      themeDarkBg: '#0f0f23',
      glassBg: 'rgba(255, 255, 255, 0.85)',
      glassBorder: 'rgba(139, 92, 246, 0.2)',
      textMain: '#0f172a',
      textMuted: '#475569',
      textSoft: '#64748b',
      orb1: '#c026d3',
      orb2: '#4f46e5',
      orb3: '#06b6d4',
      canvas: '#f5f3ff',
      border: 'rgba(91, 33, 182, 0.16)',
      borderStrong: 'rgba(91, 33, 182, 0.3)',
    },
    dark: {
      ...DEFAULT_DARK_TOKENS,
      themeBg: '#f5f3ff',
      themeDarkBg: '#0f0f23',
      glassBg: 'rgba(15, 23, 42, 0.75)',
      glassBorder: 'rgba(139, 92, 246, 0.3)',
      textMain: '#f8fafc',
      textMuted: '#94a3b8',
      textSoft: '#64748b',
      orb1: '#c026d3',
      orb2: '#4f46e5',
      orb3: '#06b6d4',
      canvas: '#0f0f23',
      border: 'rgba(196, 181, 253, 0.2)',
      borderStrong: 'rgba(196, 181, 253, 0.36)',
    },
  },
  elegant: {
    light: {
      ...DEFAULT_LIGHT_TOKENS,
      themeBg: '#fefce8',
      themeDarkBg: '#18181b',
      glassBg: 'rgba(255, 255, 255, 0.85)',
      glassBorder: 'rgba(234, 179, 8, 0.2)',
      textMain: '#0f172a',
      textMuted: '#475569',
      textSoft: '#64748b',
      orb1: '#b45309',
      orb2: '#ca8a04',
      orb3: '#78350f',
      canvas: '#fefce8',
      border: 'rgba(146, 64, 14, 0.16)',
      borderStrong: 'rgba(146, 64, 14, 0.3)',
    },
    dark: {
      ...DEFAULT_DARK_TOKENS,
      themeBg: '#fefce8',
      themeDarkBg: '#18181b',
      glassBg: 'rgba(24, 24, 27, 0.8)',
      glassBorder: 'rgba(217, 119, 6, 0.3)',
      textMain: '#f8fafc',
      textMuted: '#94a3b8',
      textSoft: '#64748b',
      orb1: '#b45309',
      orb2: '#ca8a04',
      orb3: '#78350f',
      canvas: '#18181b',
      border: 'rgba(250, 204, 21, 0.18)',
      borderStrong: 'rgba(250, 204, 21, 0.34)',
    },
  },
  ocean: {
    light: {
      ...DEFAULT_LIGHT_TOKENS,
      themeBg: '#f0f9ff',
      themeDarkBg: '#083344',
      glassBg: 'rgba(255, 255, 255, 0.85)',
      glassBorder: 'rgba(14, 165, 233, 0.2)',
      textMain: '#0f172a',
      textMuted: '#475569',
      textSoft: '#64748b',
      orb1: '#0ea5e9',
      orb2: '#0369a1',
      orb3: '#2dd4bf',
      canvas: '#f0f9ff',
      border: 'rgba(2, 132, 199, 0.16)',
      borderStrong: 'rgba(2, 132, 199, 0.3)',
    },
    dark: {
      ...DEFAULT_DARK_TOKENS,
      themeBg: '#f0f9ff',
      themeDarkBg: '#083344',
      glassBg: 'rgba(8, 47, 73, 0.75)',
      glassBorder: 'rgba(56, 189, 248, 0.2)',
      textMain: '#f8fafc',
      textMuted: '#94a3b8',
      textSoft: '#64748b',
      orb1: '#0ea5e9',
      orb2: '#0369a1',
      orb3: '#2dd4bf',
      canvas: '#083344',
      border: 'rgba(125, 211, 252, 0.2)',
      borderStrong: 'rgba(125, 211, 252, 0.36)',
    },
  },
  sakura: {
    light: {
      ...DEFAULT_LIGHT_TOKENS,
      themeBg: '#fff0f3',
      themeDarkBg: '#3f1a2e',
      glassBg: 'rgba(255, 255, 255, 0.85)',
      glassBorder: 'rgba(244, 114, 182, 0.15)',
      textMain: '#0f172a',
      textMuted: '#475569',
      textSoft: '#64748b',
      orb1: '#fbcfe8',
      orb2: '#f472b6',
      orb3: '#fecdd3',
      canvas: '#fff0f3',
      border: 'rgba(190, 24, 93, 0.14)',
      borderStrong: 'rgba(190, 24, 93, 0.28)',
    },
    dark: {
      ...DEFAULT_DARK_TOKENS,
      themeBg: '#fff0f3',
      themeDarkBg: '#3f1a2e',
      glassBg: 'rgba(63, 26, 46, 0.75)',
      glassBorder: 'rgba(244, 114, 182, 0.18)',
      textMain: '#f8fafc',
      textMuted: '#94a3b8',
      textSoft: '#64748b',
      orb1: '#fbcfe8',
      orb2: '#f472b6',
      orb3: '#fecdd3',
      canvas: '#3f1a2e',
      border: 'rgba(251, 207, 232, 0.22)',
      borderStrong: 'rgba(251, 207, 232, 0.38)',
    },
  },
}

export function normalizeThemeKey(themeKey: string): UiColorTheme {
  if (themeKey === 'sakura' || themeKey === 'cyber' || themeKey === 'elegant' || themeKey === 'ocean')
    return themeKey
  return 'default'
}

export function resolveThemeTokens(themeKey: string, mode: ResolvedThemeMode): ThemeModeTokens {
  const normalizedTheme = normalizeThemeKey(themeKey)
  return THEME_TOKEN_MAP[normalizedTheme][mode]
}

export function getCommonStatusTokens() {
  return COMMON_STATUS_TOKENS
}
