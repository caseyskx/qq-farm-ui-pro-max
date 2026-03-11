export type MetaBadgeTone = 'brand' | 'owner' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export function metaBadgeToneClass(tone: MetaBadgeTone) {
  return `ui-meta-chip--${tone}`
}

export function metaBadgeClass(tone: MetaBadgeTone, ...extraClasses: Array<string | false | null | undefined>) {
  return ['ui-meta-chip', metaBadgeToneClass(tone), ...extraClasses].filter(Boolean).join(' ')
}
