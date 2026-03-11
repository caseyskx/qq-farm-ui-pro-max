import type { Component } from 'vue'
import type { MetaBadgeTone } from '@/utils/ui-badge'

export type ActionButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'outline' | 'text'
export type ActionButtonSize = 'sm' | 'md' | 'lg'
export type BadgeSurface = 'badge' | 'meta' | 'glass' | 'glass-soft' | 'glass-dark'

export interface StatCardDefinition {
  key: string
  label?: string
  value?: string | number
  description?: string
  labelClass?: string
  valueClass?: string
  descriptionClass?: string
}

export interface FilterFieldDefinition {
  key: string
  component: Component
  modelValue?: unknown
  props?: Record<string, any>
  wrapperClass?: string
  text?: string
  onUpdate?: (value: unknown) => void
  onClear?: () => void
  onClick?: (event: MouseEvent) => void
  onChange?: (value: unknown) => void
}

export interface ActionButtonDefinition {
  key: string
  label: string
  active?: boolean
  activeLabel?: string
  iconClass?: string
  activeIconClass?: string
  variant?: ActionButtonVariant
  size?: ActionButtonSize
  loading?: boolean
  loadingLabel?: string
  disabled?: boolean
  block?: boolean
  stopPropagation?: boolean
  title?: string
  class?: string
  show?: boolean
  onClick?: (event: MouseEvent) => void
}

export interface IconActionDefinition {
  key: string
  iconClass: string
  title?: string
  danger?: boolean
  disabled?: boolean
  class?: string
  show?: boolean
  onClick?: (event: MouseEvent) => void
}

export interface ChipDefinition {
  key: string
  text?: string
  active?: boolean
  class?: string
  show?: boolean
  component?: Component
  props?: Record<string, any>
}

export interface ToggleOptionDefinition {
  key: string
  label: string
  shortLabel?: string
  iconClass?: string
  count?: string | number
  active?: boolean
  class?: string
  countClass?: string
  title?: string
  show?: boolean
  onClick?: (event: MouseEvent) => void
}

export interface RecordMetricFieldDefinition {
  key: string
  label: string
  iconClass?: string
  class?: string
  labelClass?: string
  bodyClass?: string
  props?: Record<string, any>
  show?: boolean
  onClick?: (event: MouseEvent) => void
}

export interface RecordDisplayBadgeDefinition {
  text: string
  class?: string
  show?: boolean
}

export interface RecordDisplayFieldDefinition {
  key: string
  label: string
  value?: string
  secondaryValue?: string
  note?: string
  noteClass?: string
  dotClass?: string
  badges?: RecordDisplayBadgeDefinition[]
  toggleItems?: ToggleOptionDefinition[]
  class?: string
  show?: boolean
}

export interface RecordHeroDefinition {
  key: string
  title: string
  subline?: string
  nickname?: string
  platformLabel?: string
  zoneLabel?: string
  avatarUrl?: string
  hint?: string
  badges?: RecordDisplayBadgeDefinition[]
  actions?: ActionButtonDefinition[]
  show?: boolean
}

export interface RecordStateDefinition {
  key: string
  selected?: boolean
  current?: boolean
  glowClass?: string
  selectionClass?: string
  selectionIconClass?: string
  mobileCardClass?: string
  tableRowClass?: string
  show?: boolean
}

export interface PageHeaderTextDefinition {
  key: string
  title: string
  description?: string
  titleClass?: string
  descriptionClass?: string
  show?: boolean
}

export interface HeaderNoticeDefinition {
  key: string
  text: string
  class?: string
  show?: boolean
}

export interface HeaderSummaryDefinition {
  key: string
  prefix?: string
  value?: string | number
  separator?: string
  secondaryValue?: string | number
  suffix?: string
  class?: string
  valueClass?: string
  secondaryValueClass?: string
  show?: boolean
}

export interface HistoryPanelDefinition {
  key: string
  title: string
  description?: string
  emptyText?: string
  filteredEmptyText?: string
  titleChips?: ChipDefinition[]
  titleMeta?: HistoryMetaItemDefinition[]
}

export interface HistoryHighlightDefinition {
  key: string
  title: string
  subtitle?: string
  description?: string
  detailLines?: string[]
  note?: string
  headerMeta?: HistoryMetaItemDefinition[]
  metaChips?: ChipDefinition[]
}

export interface HistoryMetricDefinition {
  key: string
  label: string
  value?: string | number
  metrics?: HistoryRecentMetricTextDefinition[]
  description?: string
  class?: string
  labelClass?: string
  valueClass?: string
  metricsClass?: string
  descriptionClass?: string
  show?: boolean
}

export interface HistoryMetaItemDefinition {
  key: string
  text: string
  iconClass?: string
  surface?: BadgeSurface
  tone?: MetaBadgeTone
  class?: string
  show?: boolean
}

export interface HistoryRecentBadgeDefinition {
  text: string
  surface?: BadgeSurface
  tone?: MetaBadgeTone
  class?: string
}

export interface HistoryRecentMetricTextDefinition {
  text: string
  class?: string
}

export interface HistoryRecentItemDefinition {
  key: string
  title: string
  subtitle?: string
  description?: string
  badges?: HistoryRecentBadgeDefinition[]
  metrics?: HistoryRecentMetricTextDefinition[]
  detailLines?: string[]
  detailLimit?: number
  copied?: boolean
  iconClass?: string
  copiedIconClass?: string
  class?: string
  headerClass?: string
  badgeGroupClass?: string
  titleClass?: string
  subtitleClass?: string
  descriptionClass?: string
  metricsClass?: string
  detailsClass?: string
  detailLineClass?: string
  footerText?: string
  footerClass?: string
  footerActiveClass?: string
  show?: boolean
  onClick?: (event: MouseEvent) => void
}

export function createStatCard(card: StatCardDefinition): StatCardDefinition {
  return card
}

export function createStatCards<T extends StatCardDefinition[]>(cards: T): T {
  return cards
}

export function createFilterField(field: FilterFieldDefinition): FilterFieldDefinition {
  return field
}

export function createFilterFields<T extends FilterFieldDefinition[]>(fields: T): T {
  return fields
}

export function createInputField({
  key,
  component,
  modelValue,
  label,
  placeholder,
  clearable,
  wrapperClass,
  props,
  onUpdate,
  onClear,
}: {
  key: string
  component: Component
  modelValue?: unknown
  label?: string
  placeholder?: string
  clearable?: boolean
  wrapperClass?: string
  props?: Record<string, any>
  onUpdate?: (value: unknown) => void
  onClear?: () => void
}): FilterFieldDefinition {
  return createFilterField({
    key,
    component,
    modelValue,
    wrapperClass,
    props: {
      label,
      placeholder,
      clearable,
      ...(props || {}),
    },
    onUpdate,
    onClear,
  })
}

export function createSelectField({
  key,
  component,
  modelValue,
  label,
  options,
  wrapperClass,
  props,
  onUpdate,
  onChange,
}: {
  key: string
  component: Component
  modelValue?: unknown
  label?: string
  options?: Array<{ label: string, value: string | number, disabled?: boolean, description?: string }>
  wrapperClass?: string
  props?: Record<string, any>
  onUpdate?: (value: unknown) => void
  onChange?: (value: unknown) => void
}): FilterFieldDefinition {
  return createFilterField({
    key,
    component,
    modelValue,
    wrapperClass,
    props: {
      label,
      options,
      ...(props || {}),
    },
    onUpdate,
    onChange,
  })
}

export function createButtonField({
  key,
  component,
  text,
  wrapperClass = 'flex items-end',
  props,
  onClick,
}: {
  key: string
  component: Component
  text: string
  wrapperClass?: string
  props?: Record<string, any>
  onClick?: (event: MouseEvent) => void
}): FilterFieldDefinition {
  return createFilterField({
    key,
    component,
    text,
    wrapperClass,
    props,
    onClick,
  })
}

export function createActionButton(action: ActionButtonDefinition): ActionButtonDefinition {
  return action
}

export function createActionButtons<T extends ActionButtonDefinition[]>(actions: T): T {
  return actions
}

export function createIconAction(action: IconActionDefinition): IconActionDefinition {
  return action
}

export function createIconActions<T extends IconActionDefinition[]>(actions: T): T {
  return actions
}

export function createChip(chip: ChipDefinition): ChipDefinition {
  return chip
}

export function createChips<T extends ChipDefinition[]>(chips: T): T {
  return chips
}

export function createToggleOption(option: ToggleOptionDefinition): ToggleOptionDefinition {
  return option
}

export function createToggleOptions<T extends ToggleOptionDefinition[]>(options: T): T {
  return options
}

export function createRecordMetricField(definition: RecordMetricFieldDefinition): RecordMetricFieldDefinition {
  return definition
}

export function createRecordMetricFields<T extends RecordMetricFieldDefinition[]>(definitions: T): T {
  return definitions
}

export function createRecordDisplayBadge(definition: RecordDisplayBadgeDefinition): RecordDisplayBadgeDefinition {
  return definition
}

export function createRecordDisplayBadges<T extends RecordDisplayBadgeDefinition[]>(definitions: T): T {
  return definitions
}

export function createRecordDisplayField(definition: RecordDisplayFieldDefinition): RecordDisplayFieldDefinition {
  return definition
}

export function createRecordDisplayFields<T extends RecordDisplayFieldDefinition[]>(definitions: T): T {
  return definitions
}

export function createRecordHero(definition: RecordHeroDefinition): RecordHeroDefinition {
  return definition
}

export function createRecordState(definition: RecordStateDefinition): RecordStateDefinition {
  return definition
}

export function createPageHeaderText(definition: PageHeaderTextDefinition): PageHeaderTextDefinition {
  return definition
}

export function createHeaderNotice(definition: HeaderNoticeDefinition): HeaderNoticeDefinition {
  return definition
}

export function createHeaderSummary(definition: HeaderSummaryDefinition): HeaderSummaryDefinition {
  return definition
}

export function createHistoryPanel(definition: HistoryPanelDefinition): HistoryPanelDefinition {
  return definition
}

export function createHistoryHighlight(definition: HistoryHighlightDefinition): HistoryHighlightDefinition {
  return definition
}

export function createHistoryMetric(definition: HistoryMetricDefinition): HistoryMetricDefinition {
  return definition
}

export function createHistoryMetrics<T extends HistoryMetricDefinition[]>(definitions: T): T {
  return definitions
}

export function createHistoryMetaItem(definition: HistoryMetaItemDefinition): HistoryMetaItemDefinition {
  return definition
}

export function createHistoryMetaItems<T extends HistoryMetaItemDefinition[]>(definitions: T): T {
  return definitions
}

export function createHistoryRecentItem(definition: HistoryRecentItemDefinition): HistoryRecentItemDefinition {
  return definition
}

export function createHistoryRecentItems<T extends HistoryRecentItemDefinition[]>(definitions: T): T {
  return definitions
}
