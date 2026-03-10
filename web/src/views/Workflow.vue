<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import api from '@/api'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import { useAccountStore } from '@/stores/account'
import { useToastStore } from '@/stores/toast'
import { localizeRuntimeText } from '@/utils/runtime-text'

const accountStore = useAccountStore()
const { currentAccountId } = storeToRefs(accountStore)
const toast = useToastStore()

// ======== 类型定义 ========

interface WorkflowNode {
  id: string
  type: string
  params?: Record<string, any>
}

interface WorkflowLane {
  enabled: boolean
  minInterval: number
  maxInterval: number
  nodes: WorkflowNode[]
}

interface WorkflowConfig {
  farm: WorkflowLane
  friend: WorkflowLane
}

interface NodeTemplate {
  type: string
  label: string
  icon: string
  color: string
  chipClass: string
  category: 'farm' | 'friend' | 'common'
  hasParams: boolean
  defaultParams?: Record<string, any>
}

// ======== 节点模板库 ========

const NODE_TEMPLATES: NodeTemplate[] = [
  // Farm Specific
  { type: 'stage_fertilize', label: '阶段施肥', icon: '🧪', color: 'var(--ui-brand-500)', chipClass: 'ui-meta-chip--brand', category: 'farm', hasParams: true, defaultParams: { mode: 'normal', phases: ['seed', 'sprout', 'leaf'] } },
  { type: 'wait_mature', label: '等待成熟', icon: '⏳', color: 'var(--ui-status-danger)', chipClass: 'ui-meta-chip--danger', category: 'farm', hasParams: true, defaultParams: { stopIfNotMature: true } },
  { type: 'harvest', label: '收获', icon: '🌾', color: 'var(--ui-status-warning)', chipClass: 'ui-meta-chip--warning', category: 'farm', hasParams: false },
  { type: 'remove_dead', label: '铲除', icon: '💀', color: 'var(--ui-text-2)', chipClass: 'ui-meta-chip--neutral', category: 'farm', hasParams: false },
  { type: 'select_seed', label: '选种', icon: '🌱', color: 'var(--ui-status-success)', chipClass: 'ui-meta-chip--success', category: 'farm', hasParams: true, defaultParams: { strategy: 'preferred' } },
  { type: 'plant', label: '种植', icon: '🌱', color: 'var(--ui-status-success)', chipClass: 'ui-meta-chip--success', category: 'farm', hasParams: false },
  { type: 'fertilize', label: '施肥', icon: '🧪', color: 'var(--ui-brand-600)', chipClass: 'ui-meta-chip--brand', category: 'farm', hasParams: true, defaultParams: { mode: 'normal' } },

  // Friend Specific
  { type: 'steal', label: '偷菜', icon: '🤏', color: 'var(--ui-status-warning)', chipClass: 'ui-meta-chip--warning', category: 'friend', hasParams: false },
  { type: 'put_bug', label: '放虫', icon: '😈', color: 'var(--ui-status-danger)', chipClass: 'ui-meta-chip--danger', category: 'friend', hasParams: false },
  { type: 'put_weed', label: '放草', icon: '🌿', color: 'var(--ui-status-success)', chipClass: 'ui-meta-chip--success', category: 'friend', hasParams: false },

  // Common
  { type: 'weed', label: '除草', icon: '✂️', color: 'var(--ui-status-success)', chipClass: 'ui-meta-chip--success', category: 'common', hasParams: false },
  { type: 'bug', label: '除虫', icon: '🐛', color: 'var(--ui-status-danger)', chipClass: 'ui-meta-chip--danger', category: 'common', hasParams: false },
  { type: 'water', label: '浇水', icon: '💧', color: 'var(--ui-status-info)', chipClass: 'ui-meta-chip--info', category: 'common', hasParams: false },
  { type: 'delay', label: '延迟', icon: '⏱️', color: 'var(--ui-text-2)', chipClass: 'ui-meta-chip--neutral', category: 'common', hasParams: true, defaultParams: { sec: 5 } },
]

function getTemplate(type: string): NodeTemplate | undefined {
  return NODE_TEMPLATES.find(t => t.type === type)
}

function generateId(): string {
  return `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

const farmTemplates = computed(() => NODE_TEMPLATES.filter(t => t.category === 'farm' || t.category === 'common'))
const friendTemplates = computed(() => NODE_TEMPLATES.filter(t => t.category === 'friend' || t.category === 'common'))

// ======== 响应式状态 ========

const loading = ref(false)
const saving = ref(false)

const config = ref<WorkflowConfig>({
  farm: { enabled: false, minInterval: 30, maxInterval: 120, nodes: [] },
  friend: { enabled: false, minInterval: 60, maxInterval: 300, nodes: [] },
})

const lastSavedConfig = ref<string>('')

const hasFarmChanges = computed(() => JSON.stringify(config.value.farm) !== JSON.parse(lastSavedConfig.value || '{}')?.farm)
const hasFriendChanges = computed(() => JSON.stringify(config.value.friend) !== JSON.parse(lastSavedConfig.value || '{}')?.friend)

const editingNodeId = ref<string | null>(null)
const editingScope = ref<'farm' | 'friend' | null>(null)

const activeNode = computed(() => {
  if (!editingScope.value || !editingNodeId.value)
    return null
  return config.value[editingScope.value].nodes.find(n => n.id === editingNodeId.value) || null
})

// ======== 拖拽物理引擎 (横向 X轴) ========

interface SpringState {
  x: number
  y: number
  vx: number
  vy: number
  targetX: number
  targetY: number
}

const STIFFNESS = 300
const DAMPING = 22
const MASS = 1
const SETTLE_THRESHOLD = 0.5
const DRAG_THRESHOLD_PX = 8

const isDragging = ref(false)
const dragScope = ref<'farm' | 'friend' | null>(null)
const dragSource = ref<'pool' | 'queue'>('queue')
const dragIndex = ref(-1)
const dragNodeType = ref('')

const dropPlaceholderIndex = ref(-1)

const ghostEl = ref<HTMLElement | null>(null)
const ghostSpring = ref<SpringState>({ x: 0, y: 0, vx: 0, vy: 0, targetX: 0, targetY: 0 })

let animFrameId = 0
let lastTime = 0
let pointerDownStart = { x: 0, y: 0 }
let dragHoldTimer: ReturnType<typeof setTimeout> | null = null

// 轨道容器引用
const farmTrackRef = ref<HTMLElement | null>(null)
const friendTrackRef = ref<HTMLElement | null>(null)

function springTick(s: SpringState, dt: number): boolean {
  const ax = (-STIFFNESS * (s.x - s.targetX) - DAMPING * s.vx) / MASS
  const ay = (-STIFFNESS * (s.y - s.targetY) - DAMPING * s.vy) / MASS
  s.vx += ax * dt
  s.vy += ay * dt
  s.x += s.vx * dt
  s.y += s.vy * dt
  return Math.abs(s.x - s.targetX) > SETTLE_THRESHOLD
    || Math.abs(s.y - s.targetY) > SETTLE_THRESHOLD
    || Math.abs(s.vx) > SETTLE_THRESHOLD
    || Math.abs(s.vy) > SETTLE_THRESHOLD
}

function animateLoop(time: number) {
  const dt = Math.min((time - lastTime) / 1000, 0.05)
  lastTime = time

  let needsContinue = false

  if (isDragging.value && ghostEl.value) {
    if (springTick(ghostSpring.value, dt))
      needsContinue = true

    // 如果拖出轨道，样式变红提示删除
    const trackRef = dragScope.value === 'farm' ? farmTrackRef.value : friendTrackRef.value
    let isOutside = true
    if (trackRef) {
      const tr = trackRef.getBoundingClientRect()
      if (ghostSpring.value.targetX + ghostEl.value.offsetWidth / 2 >= tr.left
        && ghostSpring.value.targetX - ghostEl.value.offsetWidth / 2 <= tr.right
        && ghostSpring.value.targetY + ghostEl.value.offsetHeight / 2 >= tr.top
        && ghostSpring.value.targetY - ghostEl.value.offsetHeight / 2 <= tr.bottom) {
        isOutside = false
      }
    }

    if (dragSource.value === 'queue' && isOutside) {
      ghostEl.value.style.borderColor = 'var(--ui-status-danger)'
      ghostEl.value.style.background = 'color-mix(in srgb, var(--ui-status-danger-soft) 70%, transparent)'
      ghostEl.value.style.opacity = '0.8'
    }
    else {
      ghostEl.value.style.borderColor = ''
      ghostEl.value.style.background = ''
      ghostEl.value.style.opacity = '1'
    }

    ghostEl.value.style.transform = `translate3d(${ghostSpring.value.x}px, ${ghostSpring.value.y}px, 0) scale(1.05) rotate(${ghostSpring.value.vx * 0.005}deg)`
  }

  if (needsContinue || isDragging.value) {
    animFrameId = requestAnimationFrame(animateLoop)
  }
}

function initDrag(e: PointerEvent, template: NodeTemplate, _scope: 'farm' | 'friend') {
  if (ghostEl.value)
    ghostEl.value.remove()

  const el = document.createElement('div')
  el.className = `fixed z-[9999] pointer-events-none px-5 py-2.5 border-2 rounded-full font-bold shadow-xl flex items-center gap-2.5 whitespace-nowrap backdrop-blur-md text-base`
  el.style.background = 'color-mix(in srgb, var(--ui-bg-surface-raised) 94%, transparent)'
  el.style.color = 'var(--ui-text-1)'
  el.style.borderColor = template.color
  el.innerHTML = `<span>${template.icon}</span><span>${template.label}</span>`

  document.body.appendChild(el)
  ghostEl.value = el

  const rect = el.getBoundingClientRect()
  const startX = e.clientX - rect.width / 2
  const startY = e.clientY - rect.height / 2
  ghostSpring.value = { x: startX, y: startY, vx: 0, vy: 0, targetX: startX, targetY: startY }
  el.style.transform = `translate3d(${startX}px, ${startY}px, 0) scale(1.05)`

  lastTime = performance.now()
  animFrameId = requestAnimationFrame(animateLoop)

  // Add auto-scroll
  document.addEventListener('pointermove', handleAutoScroll)
}

// 自动滚动支持 (当拖到边缘时)
function handleAutoScroll(e: PointerEvent) {
  if (!isDragging.value || !dragScope.value)
    return
  const track = dragScope.value === 'farm' ? farmTrackRef.value : friendTrackRef.value
  if (!track)
    return

  const rect = track.getBoundingClientRect()
  const scrollZone = 50

  // 仅在 Y 轴大致对齐时才自动横向滚动轨道
  if (e.clientY > rect.top - 50 && e.clientY < rect.bottom + 50) {
    if (e.clientX < rect.left + scrollZone) {
      track.scrollLeft -= 10
    }
    else if (e.clientX > rect.right - scrollZone) {
      track.scrollLeft += 10
    }
  }
}

function handlePointerDownPool(e: PointerEvent, scope: 'farm' | 'friend', template: NodeTemplate) {
  e.preventDefault()

  pointerDownStart = { x: e.clientX, y: e.clientY }

  const activateDrag = () => {
    dragScope.value = scope
    dragSource.value = 'pool'
    dragNodeType.value = template.type
    isDragging.value = true
    dragIndex.value = -1
    dropPlaceholderIndex.value = config.value[scope].nodes.length
    initDrag(e, template, scope)
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUpPool)
  }

  // Click vs Drag logic
  const moveToleration = (ev: PointerEvent) => {
    if (Math.hypot(ev.clientX - pointerDownStart.x, ev.clientY - pointerDownStart.y) > DRAG_THRESHOLD_PX) {
      if (dragHoldTimer)
        clearTimeout(dragHoldTimer)
      document.removeEventListener('pointermove', moveToleration)
      document.removeEventListener('pointerup', cancelEarly)
      activateDrag()
      onPointerMove(ev) // process the first move
    }
  }

  function cancelEarly() {
    if (dragHoldTimer) {
      clearTimeout(dragHoldTimer)
    }
    document.removeEventListener('pointermove', moveToleration)
    document.removeEventListener('pointerup', cancelEarly)
    // It was a click!
    addNode(scope, template)
  }

  document.addEventListener('pointermove', moveToleration)
  document.addEventListener('pointerup', cancelEarly)

  // Mobile long press -> drag
  dragHoldTimer = setTimeout(() => {
    document.removeEventListener('pointermove', moveToleration)
    document.removeEventListener('pointerup', cancelEarly)
    activateDrag()
  }, 200)
}

function handlePointerDownQueue(e: PointerEvent, scope: 'farm' | 'friend', index: number) {
  // If clicking on actions or anything, ignore
  const target = e.target as HTMLElement
  if (target.closest('button') || target.tagName === 'INPUT')
    return

  e.preventDefault()
  const node = config.value[scope].nodes[index]
  if (!node)
    return
  const template = getTemplate(node.type)
  if (!template)
    return

  pointerDownStart = { x: e.clientX, y: e.clientY }

  const activateDrag = () => {
    dragScope.value = scope
    dragSource.value = 'queue'
    dragNodeType.value = node.type
    isDragging.value = true
    dragIndex.value = index
    dropPlaceholderIndex.value = index

    editingNodeId.value = null // hide editor while dragging

    initDrag(e, template, scope)
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUpQueue)
  }

  const moveToleration = (ev: PointerEvent) => {
    if (Math.hypot(ev.clientX - pointerDownStart.x, ev.clientY - pointerDownStart.y) > DRAG_THRESHOLD_PX) {
      if (dragHoldTimer)
        clearTimeout(dragHoldTimer)
      document.removeEventListener('pointermove', moveToleration)
      document.removeEventListener('pointerup', cancelEarly)
      activateDrag()
      onPointerMove(ev)
    }
  }

  function cancelEarly() {
    if (dragHoldTimer) {
      clearTimeout(dragHoldTimer)
    }
    document.removeEventListener('pointermove', moveToleration)
    document.removeEventListener('pointerup', cancelEarly)
    // Click logic: open editor
    if (template?.hasParams && node) {
      if (editingNodeId.value === node.id) {
        editingNodeId.value = null
      }
      else {
        editingNodeId.value = node.id
        editingScope.value = scope
      }
    }
  }

  document.addEventListener('pointermove', moveToleration)
  document.addEventListener('pointerup', cancelEarly)

  dragHoldTimer = setTimeout(() => {
    document.removeEventListener('pointermove', moveToleration)
    document.removeEventListener('pointerup', cancelEarly)
    activateDrag()
  }, 200)
}

function onPointerMove(e: PointerEvent) {
  if (!isDragging.value || !ghostEl.value)
    return

  const rect = ghostEl.value.getBoundingClientRect()
  ghostSpring.value.targetX = e.clientX - rect.width / 2
  ghostSpring.value.targetY = e.clientY - rect.height / 2

  const trackRef = dragScope.value === 'farm' ? farmTrackRef.value : friendTrackRef.value
  if (!trackRef)
    return

  const tRect = trackRef.getBoundingClientRect()
  const items = Array.from(trackRef.querySelectorAll('.wf-node-track-item'))
  let newPlaceholder = config.value[dragScope.value!].nodes.length

  // Only calc if inside track bounds (allow a little slack vertically)
  if (e.clientX >= tRect.left - 50 && e.clientX <= tRect.right + 50
    && e.clientY >= tRect.top - 50 && e.clientY <= tRect.bottom + 50) {
    // Find index based on X coordinate
    // The items are horizontal
    for (let i = 0; i < items.length; i++) {
      const iRect = items[i]?.getBoundingClientRect()
      if (!iRect)
        continue
      const midX = iRect.left + iRect.width / 2
      if (e.clientX < midX) {
        newPlaceholder = i
        break
      }
    }
  }
  else {
    // Left the track
    newPlaceholder = -1
  }

  dropPlaceholderIndex.value = newPlaceholder
}

function cleanupDrag() {
  document.removeEventListener('pointermove', onPointerMove)
  document.removeEventListener('pointermove', handleAutoScroll)

  isDragging.value = false
  dragIndex.value = -1
  dropPlaceholderIndex.value = -1
  dragNodeType.value = ''
  dragScope.value = null

  if (ghostEl.value) {
    ghostEl.value.remove()
    ghostEl.value = null
  }

  if (animFrameId) {
    cancelAnimationFrame(animFrameId)
    animFrameId = 0
  }
}

function onPointerUpPool(_e: PointerEvent) {
  document.removeEventListener('pointerup', onPointerUpPool)

  const scope = dragScope.value
  if (!scope) {
    cleanupDrag()
    return
  }

  const nodes = config.value[scope].nodes
  const phIdx = dropPlaceholderIndex.value

  // Dropped inside track
  if (phIdx >= 0) {
    const template = getTemplate(dragNodeType.value)
    if (template) {
      nodes.splice(phIdx, 0, {
        id: generateId(),
        type: template.type,
        ...(template.hasParams ? { params: JSON.parse(JSON.stringify(template.defaultParams || {})) } : {}),
      })
    }
  }

  cleanupDrag()
}

function onPointerUpQueue(_e: PointerEvent) {
  document.removeEventListener('pointerup', onPointerUpQueue)
  const scope = dragScope.value
  if (!scope) {
    cleanupDrag()
    return
  }

  const nodes = config.value[scope].nodes
  const phIdx = dropPlaceholderIndex.value

  if (phIdx < 0) {
    // Delete
    nodes.splice(dragIndex.value, 1)
  }
  else {
    // Reorder
    if (phIdx !== dragIndex.value && phIdx !== dragIndex.value + 1) {
      const moved = nodes.splice(dragIndex.value, 1)[0]
      if (moved) {
        // Because we removed an item, if we mapped to an index after our old position,
        // it shifts by 1.
        const insertAt = phIdx > dragIndex.value ? phIdx - 1 : phIdx
        nodes.splice(insertAt, 0, moved)
      }
    }
  }

  cleanupDrag()
}

// ======== 操作 ========
function addNode(scope: 'farm' | 'friend', template: NodeTemplate) {
  config.value[scope].nodes.push({
    id: generateId(),
    type: template.type,
    ...(template.hasParams ? { params: JSON.parse(JSON.stringify(template.defaultParams || {})) } : {}),
  })
}

function removeNode(scope: 'farm' | 'friend', index: number) {
  config.value[scope].nodes.splice(index, 1)
  editingNodeId.value = null
}

// ======== 数据交互 ========

async function loadData() {
  if (!currentAccountId.value)
    return
  loading.value = true
  try {
    const { data } = await api.get('/api/settings', {
      headers: { 'x-account-id': currentAccountId.value },
    })
    if (data?.ok && data.data?.workflowConfig) {
      const wc = data.data.workflowConfig
      config.value = {
        farm: {
          enabled: !!wc.farm?.enabled,
          minInterval: wc.farm?.minInterval || 30,
          maxInterval: wc.farm?.maxInterval || 120,
          nodes: Array.isArray(wc.farm?.nodes) ? wc.farm.nodes : [],
        },
        friend: {
          enabled: !!wc.friend?.enabled,
          minInterval: wc.friend?.minInterval || 60,
          maxInterval: wc.friend?.maxInterval || 300,
          nodes: Array.isArray(wc.friend?.nodes) ? wc.friend.nodes : [],
        },
      }
      lastSavedConfig.value = JSON.stringify(config.value)
    }
  }
  catch (e) {
    console.error('加载流程配置失败:', e)
  }
  finally {
    loading.value = false
  }
}

async function saveConfigData(scope: 'farm' | 'friend') {
  if (!currentAccountId.value)
    return

  // 静态编译期拦截：农场一旦启用编排，必须明确知道自己没有配置施肥可能会导致停滞
  if (scope === 'farm' && config.value.farm.enabled) {
    const hasFertilizeNode = config.value.farm.nodes.some(n => n.type === 'stage_fertilize' || n.type === 'fertilize')
    if (!hasFertilizeNode) {
      // confirm
      if (!window.window.confirm('【警告】您的农场流程中没有包含“阶段施肥”或“普通施肥”节点。\n在流程编排模式下，系统将完全依靠编排节点执行。缺少施肥节点可能导致植物长期处于某阶段不成长。\n\n是否确认无化肥直接保存？')) {
        return
      }
    }
  }

  saving.value = true

  // To avoid overwriting the other scope if it was changed by another client, we should merge.
  // But for simplicity of this component, we save the whole config state.
  try {
    const res = await api.post('/api/settings/save', { workflowConfig: config.value }, {
      headers: { 'x-account-id': currentAccountId.value },
    })
    if (res.data?.ok) {
      toast.success(`${scope === 'farm' ? '农场' : '好友'}流程保存成功`)
      lastSavedConfig.value = JSON.stringify(config.value)
      editingNodeId.value = null
    }
    else {
      toast.error(`保存失败: ${localizeRuntimeText(res.data?.error || '未知错误')}`)
    }
  }
  catch {
    toast.error('保存请求异常')
  }
  finally {
    saving.value = false
  }
}

function resetDefault(scope: 'farm' | 'friend') {
  if (scope === 'farm') {
    config.value.farm.nodes = [
      { id: generateId(), type: 'stage_fertilize', params: { mode: 'normal', phases: ['seed', 'sprout', 'leaf', 'flower'] } },
      { id: generateId(), type: 'weed' },
      { id: generateId(), type: 'bug' },
      { id: generateId(), type: 'water' },
      { id: generateId(), type: 'wait_mature', params: { stopIfNotMature: true } },
      { id: generateId(), type: 'harvest' },
      { id: generateId(), type: 'delay', params: { sec: 5 } },
      { id: generateId(), type: 'remove_dead' },
      { id: generateId(), type: 'delay', params: { sec: 2 } },
      { id: generateId(), type: 'select_seed', params: { strategy: 'preferred' } },
      { id: generateId(), type: 'plant' },
      { id: generateId(), type: 'fertilize', params: { mode: 'normal' } },
    ]
  }
  else {
    config.value.friend.nodes = [
      { id: generateId(), type: 'weed' },
      { id: generateId(), type: 'bug' },
      { id: generateId(), type: 'water' },
      { id: generateId(), type: 'steal' },
      { id: generateId(), type: 'put_bug' },
      { id: generateId(), type: 'put_weed' },
    ]
  }
}

onMounted(() => {
  loadData()
})

// 【修复闪烁】监听 accountId 字符串值而非 currentAccount 对象引用
watch(() => currentAccountId.value, () => {
  loadData()
})
</script>

<template>
  <div class="workflow-page ui-page-shell ui-page-density-relaxed min-h-full w-full pb-28 space-y-6">
    <!-- Header -->
    <div class="workflow-header flex flex-col justify-between gap-4 pb-4 md:flex-row md:items-center">
      <div>
        <h1 class="glass-text-main flex items-center gap-2 text-2xl font-bold">
          <span class="text-primary-500 font-normal">🚀</span> 策略流程编排
        </h1>
        <p class="glass-text-muted mt-1 text-sm">
          通过水平拖拽节点组织自动化流水线，高级弹簧交互，随心所欲定制策略。
        </p>
      </div>
      <div class="ui-page-actions ui-bulk-actions">
        <BaseButton variant="outline" size="sm" :loading="loading" @click="loadData">
          刷新配置
        </BaseButton>
      </div>
    </div>

    <div v-if="!currentAccountId" class="workflow-empty-state flex flex-1 flex-col items-center justify-center py-20">
      <div class="i-carbon-user-settings mb-4 text-4xl" />
      <p>请先在右上角选择指定账号</p>
    </div>

    <template v-else>
      <!-- ================= 农场流程 ================= -->
      <div class="workflow-lane-shell glass-panel overflow-hidden rounded-xl shadow-sm">
        <!-- Title Bar -->
        <div class="workflow-lane-header flex flex-wrap items-center justify-between p-4">
          <div class="flex items-center gap-3">
            <h2 class="glass-text-main flex items-center gap-2 text-base font-bold">
              <span>🚜</span> 农场流程编排
            </h2>
            <span
              class="rounded px-2 py-0.5 text-xs font-bold transition-colors"
              :class="config.farm.enabled ? 'workflow-enabled-badge ui-meta-chip--brand' : 'workflow-enabled-badge ui-meta-chip--neutral'"
            >
              {{ config.farm.enabled ? '已启用' : '未启用' }}
            </span>
          </div>
          <BaseSwitch v-model="config.farm.enabled" label="启用流程模式" />
        </div>

        <div class="p-4 space-y-4">
          <!-- Description & Interval -->
          <div class="workflow-note text-xs">
            启用后，巡田时按以下流程执行，未启用时使用传统模式。可拖拽节点调整顺序。
            推荐顺序: 阶段施肥 -> 等待成熟 -> 收获/铲除/种植
          </div>

          <div class="workflow-interval-card grid grid-cols-1 gap-4 rounded-lg p-3 sm:grid-cols-2 md:w-1/2">
            <div class="space-y-1">
              <label class="workflow-label text-xs font-bold">最小间隔 (秒)</label>
              <input
                v-model.number="config.farm.minInterval" type="number" min="1"
                class="workflow-input glass-panel w-full rounded bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
            </div>
            <div class="space-y-1">
              <label class="workflow-label text-xs font-bold">最大间隔 (秒)</label>
              <input
                v-model.number="config.farm.maxInterval" type="number" min="1"
                class="workflow-input glass-panel w-full rounded bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
            </div>
          </div>

          <!-- Status Bar -->
          <div
            class="workflow-status-banner flex flex-col items-start gap-2 rounded px-3 py-2 text-xs transition-colors sm:flex-row sm:items-center sm:justify-between"
            :class="hasFarmChanges ? 'ui-meta-chip--warning' : 'ui-meta-chip--success'"
          >
            <div class="font-bold font-mono">
              {{ hasFarmChanges ? '农场流程有未保存改动' : '农场流程已就绪 (未保存改动)' }}
            </div>
            <div class="opacity-70">
              {{ hasFarmChanges ? '等待保存' : '最后保存: 未知' }}
            </div>
          </div>

          <div class="workflow-mobile-toolbar ui-mobile-sticky-panel ui-mobile-action-panel md:hidden">
            <div class="workflow-mobile-toolbar-group">
              <div class="workflow-mobile-toolbar-label">
                快速添加节点
              </div>
              <div class="ui-bulk-actions">
                <button
                  v-for="tpl in farmTemplates" :key="tpl.type"
                  class="workflow-pool-chip flex cursor-grab items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-bold shadow-sm transition-colors active:cursor-grabbing"
                  :class="tpl.chipClass"
                  @pointerdown="(e) => handlePointerDownPool(e, 'farm', tpl)"
                >
                  <span class="text-base">{{ tpl.icon }}</span>
                  <span>{{ tpl.label }}</span>
                </button>
              </div>
            </div>

            <div class="ui-bulk-actions">
              <BaseButton variant="outline" size="sm" @click="resetDefault('farm')">
                重置默认流程
              </BaseButton>
              <BaseButton variant="primary" size="sm" :loading="saving" @click="saveConfigData('farm')">
                保存农场流程
              </BaseButton>
            </div>
          </div>

          <!-- THE TRACK -->
          <div
            ref="farmTrackRef"
            class="workflow-track custom-scrollbar relative flex select-none items-center overflow-x-auto overflow-y-hidden p-3 transition-colors sm:py-6"
            :class="{ 'workflow-track-active': isDragging && dragScope === 'farm' }"
          >
            <div v-if="config.farm.nodes.length === 0" class="workflow-track-empty pointer-events-none py-4 pl-2 text-sm italic">
              拖拽底部节点到这里，或者直接点击下方节点...
            </div>

            <TransitionGroup name="wf-horizontal" class="flex items-center">
              <template v-for="(node, idx) in config.farm.nodes" :key="node.id">
                <div
                  v-if="isDragging && dragScope === 'farm' && dropPlaceholderIndex === idx"
                  class="workflow-placeholder wf-ph mx-2 h-[36px] w-[80px] shrink-0 rounded-full border-dashed transition-all"
                />

                <template v-if="!(isDragging && dragSource === 'queue' && dragScope === 'farm' && dragIndex === idx)">
                  <!-- Arrow between nodes -->
                  <div v-if="idx > 0 || (isDragging && dragScope === 'farm' && dropPlaceholderIndex === 0)" class="workflow-arrow i-carbon-arrow-right wf-arrow mx-1 shrink-0" />

                  <!-- Node Chip -->
                  <div
                    class="group wf-node-track-item relative shrink-0 cursor-grab transition-transform hover:scale-105 active:cursor-grabbing hover:-translate-y-1"
                    @pointerdown="(e) => handlePointerDownQueue(e, 'farm', idx)"
                  >
                    <div
                      class="workflow-node-chip flex items-center gap-2 rounded-full px-4 py-2 text-base font-bold shadow-sm transition-colors"
                      :class="[
                        getTemplate(node.type)?.chipClass,
                        editingNodeId === node.id ? 'ring-2 ring-primary-500 shadow-md' : 'hover:shadow',
                      ]"
                    >
                      <span>{{ getTemplate(node.type)?.icon }}</span>
                      <span>{{ getTemplate(node.type)?.label }}</span>
                      <!-- Preview parameters if any -->
                      <span v-if="node.type === 'wait_mature' && node.params?.stopIfNotMature" class="ml-1.5 border-l border-current pl-1.5 text-xs font-normal opacity-75">(未成熟停止)</span>
                      <span v-if="node.type === 'stage_fertilize' && node.params" class="ml-1.5 border-l border-current pl-1.5 text-xs font-normal opacity-75">({{ node.params.phases?.length || 0 }}阶段)</span>
                    </div>

                    <!-- Delete button overlay map (visible on hover) -->
                    <button
                      class="workflow-node-delete absolute z-10 h-5 w-5 flex items-center justify-center rounded-full opacity-0 shadow-sm transition-opacity -right-2 -top-2 group-hover:opacity-100"
                      @pointerdown.stop
                      @click="removeNode('farm', idx)"
                    >
                      <div class="i-carbon-close text-xs" />
                    </button>
                    <!-- Settings button if params -->
                    <button
                      v-if="getTemplate(node.type)?.hasParams"
                      class="workflow-node-settings absolute z-10 h-5 w-5 flex items-center justify-center rounded-full opacity-0 shadow-sm transition-opacity -bottom-2 -right-2 group-hover:opacity-100"
                      @pointerdown.stop
                      @click="editingNodeId = editingNodeId === node.id ? null : node.id; editingScope = 'farm'"
                    >
                      <div class="i-carbon-settings text-[10px]" />
                    </button>
                  </div>
                </template>
              </template>

              <!-- End placeholder -->
              <div
                v-if="isDragging && dragScope === 'farm' && dropPlaceholderIndex === config.farm.nodes.length" key="ph-end"
                class="workflow-placeholder wf-ph mx-2 h-[36px] w-[80px] shrink-0 rounded-full border-dashed transition-all"
              />
            </TransitionGroup>
          </div>

          <!-- Inline Editor -->
          <div v-if="editingScope === 'farm' && editingNodeId && activeNode" class="workflow-editor animate-in fade-in slide-in-from-top-2 relative rounded-lg p-4">
            <button class="workflow-editor-close absolute right-3 top-3" @click="editingNodeId = null">
              <div class="i-carbon-close text-lg" />
            </button>
            <h3 class="workflow-editor-title mb-3 flex items-center gap-2 text-sm font-bold">
              <div class="i-carbon-edit" />
              编辑节点: {{ getTemplate(activeNode.type)?.label }}
            </h3>

            <div v-if="activeNode.params" class="space-y-4">
              <template v-if="activeNode.type === 'wait_mature'">
                <BaseSwitch v-model="activeNode.params.stopIfNotMature" label="若所有作物未成熟，中止后续流程" />
              </template>

              <template v-if="activeNode.type === 'stage_fertilize'">
                <div>
                  <label class="workflow-label mb-1 block text-xs font-bold">阶段施肥模式</label>
                  <select v-model="activeNode.params.mode" class="workflow-select glass-panel max-w-[240px] w-full rounded px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/50">
                    <option value="normal">
                      仅普通化肥
                    </option>
                    <option value="organic">
                      仅有机化肥
                    </option>
                    <option value="both">
                      双效(普通+有机)
                    </option>
                  </select>
                </div>
                <div>
                  <label class="workflow-label mb-2 block text-xs font-bold">选择执行施肥的作物阶段</label>
                  <div class="flex flex-wrap gap-3">
                    <label v-for="ph in [{ v: 'seed', l: '种子期' }, { v: 'sprout', l: '发芽期' }, { v: 'leaf', l: '小叶期' }, { v: 'big_leaf', l: '大叶期' }, { v: 'flower', l: '开花期' }]" :key="ph.v" class="workflow-checkbox-label flex items-center gap-1 text-sm">
                      <input v-model="activeNode.params.phases" type="checkbox" :value="ph.v" class="h-4 w-4 rounded accent-primary-500">
                      {{ ph.l }}
                    </label>
                  </div>
                </div>
              </template>

              <template v-if="activeNode.type === 'delay'">
                <div class="max-w-[240px] w-full">
                  <BaseInput v-model.number="activeNode.params.sec" type="number" min="1" label="延时时间(秒)" />
                </div>
              </template>

              <template v-if="activeNode.type === 'select_seed'">
                <div class="max-w-[240px] w-full">
                  <label class="workflow-label mb-1 block text-xs font-bold">选种策略</label>
                  <select v-model="activeNode.params.strategy" class="workflow-select glass-panel w-full rounded px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/50">
                    <option value="preferred">
                      设置项中优先选择
                    </option>
                    <option value="max_profit">
                      理论时润最高
                    </option>
                    <option value="max_exp">
                      理论时经最高
                    </option>
                  </select>
                </div>
              </template>
            </div>
          </div>

          <!-- Bottom Toolbar -->
          <div class="mt-2 hidden flex-col justify-between gap-4 md:flex md:flex-row md:items-center">
            <div class="flex flex-1 flex-wrap items-center gap-2.5">
              <span class="workflow-pool-label whitespace-nowrap text-base font-bold">添加节点:</span>
              <button
                v-for="tpl in farmTemplates" :key="tpl.type"
                class="workflow-pool-chip flex cursor-grab items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-bold shadow-sm transition-colors active:cursor-grabbing"
                :class="tpl.chipClass"
                @pointerdown="(e) => handlePointerDownPool(e, 'farm', tpl)"
              >
                <span class="text-base">{{ tpl.icon }}</span>
                <span>{{ tpl.label }}</span>
              </button>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <BaseButton variant="outline" size="sm" @click="resetDefault('farm')">
                重置默认流程
              </BaseButton>
              <BaseButton variant="primary" size="sm" :loading="saving" @click="saveConfigData('farm')">
                保存农场流程
              </BaseButton>
            </div>
          </div>
        </div>
      </div>

      <!-- ================= 好友流程 ================= -->
      <div class="workflow-lane-shell glass-panel overflow-hidden rounded-xl shadow-sm">
        <!-- Title Bar -->
        <div class="workflow-lane-header flex flex-wrap items-center justify-between p-4">
          <div class="flex items-center gap-3">
            <h2 class="glass-text-main flex items-center gap-2 text-base font-bold">
              <span>🤝</span> 好友巡查流程编排
            </h2>
            <span
              class="rounded px-2 py-0.5 text-xs font-bold transition-colors"
              :class="config.friend.enabled ? 'workflow-enabled-badge ui-meta-chip--brand' : 'workflow-enabled-badge ui-meta-chip--neutral'"
            >
              {{ config.friend.enabled ? '已启用' : '未启用' }}
            </span>
          </div>
          <BaseSwitch v-model="config.friend.enabled" label="启用流程模式" />
        </div>

        <div class="p-4 space-y-4">
          <div class="workflow-note text-xs">
            启用后，拜访每位好友时按以下流程依次执行操作。未启用时使用默认顺序（除草->浇水->除虫->偷菜->放虫->放草）。
          </div>

          <div class="workflow-interval-card grid grid-cols-1 gap-4 rounded-lg p-3 sm:grid-cols-2 md:w-1/2">
            <div class="space-y-1">
              <label class="workflow-label text-xs font-bold">最小间隔 (秒)</label>
              <input
                v-model.number="config.friend.minInterval" type="number" min="1"
                class="workflow-input glass-panel w-full rounded bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
            </div>
            <div class="space-y-1">
              <label class="workflow-label text-xs font-bold">最大间隔 (秒)</label>
              <input
                v-model.number="config.friend.maxInterval" type="number" min="1"
                class="workflow-input glass-panel w-full rounded bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
            </div>
          </div>

          <!-- Status Bar -->
          <div
            class="workflow-status-banner flex flex-col items-start gap-2 rounded px-3 py-2 text-xs transition-colors sm:flex-row sm:items-center sm:justify-between"
            :class="hasFriendChanges ? 'ui-meta-chip--warning' : 'ui-meta-chip--success'"
          >
            <div class="font-bold font-mono">
              {{ hasFriendChanges ? '好友流程有未保存改动' : '好友流程已就绪 (未手保存改动)' }}
            </div>
            <div class="opacity-70">
              {{ hasFriendChanges ? '等待保存' : '最后保存: 未知' }}
            </div>
          </div>

          <div class="workflow-mobile-toolbar ui-mobile-sticky-panel ui-mobile-action-panel md:hidden">
            <div class="workflow-mobile-toolbar-group">
              <div class="workflow-mobile-toolbar-label">
                快速添加节点
              </div>
              <div class="ui-bulk-actions">
                <button
                  v-for="tpl in friendTemplates" :key="tpl.type"
                  class="workflow-pool-chip flex cursor-grab items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-bold shadow-sm transition-colors active:cursor-grabbing"
                  :class="tpl.chipClass"
                  @pointerdown="(e) => handlePointerDownPool(e, 'friend', tpl)"
                >
                  <span class="text-base">{{ tpl.icon }}</span>
                  <span>{{ tpl.label }}</span>
                </button>
              </div>
            </div>

            <div class="ui-bulk-actions">
              <BaseButton variant="outline" size="sm" @click="resetDefault('friend')">
                重置默认流程
              </BaseButton>
              <BaseButton variant="primary" size="sm" :loading="saving" @click="saveConfigData('friend')">
                保存好友流程
              </BaseButton>
            </div>
          </div>

          <!-- THE TRACK -->
          <div
            ref="friendTrackRef"
            class="workflow-track custom-scrollbar relative flex select-none items-center overflow-x-auto overflow-y-hidden p-3 transition-colors sm:py-6"
            :class="{ 'workflow-track-active': isDragging && dragScope === 'friend' }"
          >
            <div v-if="config.friend.nodes.length === 0" class="workflow-track-empty pointer-events-none py-4 pl-2 text-sm italic">
              拖拽底部节点到这里，或者直接点击下方节点...
            </div>

            <TransitionGroup name="wf-horizontal" class="flex items-center">
              <template v-for="(node, idx) in config.friend.nodes" :key="node.id">
                <div
                  v-if="isDragging && dragScope === 'friend' && dropPlaceholderIndex === idx"
                  class="workflow-placeholder wf-ph mx-2 h-[36px] w-[80px] shrink-0 rounded-full border-dashed transition-all"
                />

                <template v-if="!(isDragging && dragSource === 'queue' && dragScope === 'friend' && dragIndex === idx)">
                  <div v-if="idx > 0 || (isDragging && dragScope === 'friend' && dropPlaceholderIndex === 0)" class="workflow-arrow i-carbon-arrow-right wf-arrow mx-1 shrink-0" />

                  <div
                    class="group wf-node-track-item relative shrink-0 cursor-grab transition-transform hover:scale-105 active:cursor-grabbing hover:-translate-y-1"
                    @pointerdown="(e) => handlePointerDownQueue(e, 'friend', idx)"
                  >
                    <div
                      class="workflow-node-chip flex items-center gap-2 rounded-full px-4 py-2 text-base font-bold shadow-sm transition-colors"
                      :class="[
                        getTemplate(node.type)?.chipClass,
                        editingNodeId === node.id ? 'ring-2 ring-primary-500 shadow-md' : 'hover:shadow',
                      ]"
                    >
                      <span>{{ getTemplate(node.type)?.icon }}</span>
                      <span>{{ getTemplate(node.type)?.label }}</span>
                    </div>

                    <button
                      class="workflow-node-delete absolute z-10 h-5 w-5 flex items-center justify-center rounded-full opacity-0 shadow-sm transition-opacity -right-2 -top-2 group-hover:opacity-100"
                      @pointerdown.stop
                      @click="removeNode('friend', idx)"
                    >
                      <div class="i-carbon-close text-xs" />
                    </button>
                    <button
                      v-if="getTemplate(node.type)?.hasParams"
                      class="workflow-node-settings absolute z-10 h-5 w-5 flex items-center justify-center rounded-full opacity-0 shadow-sm transition-opacity -bottom-2 -right-2 group-hover:opacity-100"
                      @pointerdown.stop
                      @click="editingNodeId = editingNodeId === node.id ? null : node.id; editingScope = 'friend'"
                    >
                      <div class="i-carbon-settings text-[10px]" />
                    </button>
                  </div>
                </template>
              </template>

              <div
                v-if="isDragging && dragScope === 'friend' && dropPlaceholderIndex === config.friend.nodes.length" key="ph-end"
                class="workflow-placeholder wf-ph mx-2 h-[36px] w-[80px] shrink-0 rounded-full border-dashed transition-all"
              />
            </TransitionGroup>
          </div>

          <!-- Inline Editor -->
          <div v-if="editingScope === 'friend' && editingNodeId && activeNode" class="workflow-editor animate-in fade-in slide-in-from-top-2 relative rounded-lg p-4">
            <button class="workflow-editor-close absolute right-3 top-3" @click="editingNodeId = null">
              <div class="i-carbon-close text-lg" />
            </button>
            <h3 class="workflow-editor-title mb-3 flex items-center gap-2 text-sm font-bold">
              <div class="i-carbon-edit" />
              编辑节点: {{ getTemplate(activeNode.type)?.label }}
            </h3>

            <div v-if="activeNode.params" class="space-y-4">
              <template v-if="activeNode.type === 'delay'">
                <div class="max-w-[240px] w-full">
                  <BaseInput v-model.number="activeNode.params.sec" type="number" min="1" label="延时时间(秒)" />
                </div>
              </template>
            </div>
          </div>

          <!-- Bottom Toolbar -->
          <div class="mt-2 hidden flex-col justify-between gap-4 md:flex md:flex-row md:items-center">
            <div class="flex flex-1 flex-wrap items-center gap-2.5">
              <span class="workflow-pool-label whitespace-nowrap text-base font-bold">添加节点:</span>
              <button
                v-for="tpl in friendTemplates" :key="tpl.type"
                class="workflow-pool-chip flex cursor-grab items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-bold shadow-sm transition-colors active:cursor-grabbing"
                :class="tpl.chipClass"
                @pointerdown="(e) => handlePointerDownPool(e, 'friend', tpl)"
              >
                <span class="text-base">{{ tpl.icon }}</span>
                <span>{{ tpl.label }}</span>
              </button>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <BaseButton variant="outline" size="sm" @click="resetDefault('friend')">
                重置默认流程
              </BaseButton>
              <BaseButton variant="primary" size="sm" :loading="saving" @click="saveConfigData('friend')">
                保存好友流程
              </BaseButton>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.workflow-page {
  color: var(--ui-text-1);
}

.workflow-page
  :is(
    [class*='text-'][class*='gray-300'],
    [class*='text-'][class*='gray-400'],
    [class*='text-'][class*='gray-500'],
    .glass-text-muted
  ) {
  color: var(--ui-text-2) !important;
}

.workflow-page
  :is(
    [class*='text-'][class*='gray-200'],
    [class*='text-'][class*='gray-100'],
    [class*='text-'][class*='slate-300'],
    [class*='text-'][class*='slate-200']
  ) {
  color: var(--ui-text-1) !important;
}

.workflow-page
  :is(
    [class*='text-'][class*='white/95'],
    [class*='text-'][class*='white/90'],
    [class*='text-'][class*='white/85'],
    [class*='text-'][class*='white/80']
  ) {
  color: color-mix(in srgb, var(--ui-text-1) 90%, var(--ui-text-on-brand) 10%) !important;
}

.workflow-page [class*='border-'][class*='white/20'],
.workflow-page [class*='border-'][class*='white/10'],
.workflow-page [class*='border-'][class*='gray-200/50'],
.workflow-page [class*='dark:border-'][class*='gray-700/50'],
.workflow-page [class*='border-'][class*='gray-200'],
.workflow-page [class*='border-'][class*='gray-300'],
.workflow-page [class*='dark:border-'][class*='gray-700'],
.workflow-page [class*='dark:border-'][class*='gray-800'] {
  border-color: var(--ui-border-subtle) !important;
}

.workflow-page [class*='bg-'][class*='black/5'],
.workflow-page [class*='bg-'][class*='white/5'],
.workflow-page [class*='dark:bg-'][class*='black/20'],
.workflow-page [class*='dark:bg-'][class*='black/30'],
.workflow-page [class*='bg-'][class*='white/50'],
.workflow-page [class*='bg-'][class*='gray-200/50'],
.workflow-page [class*='dark:bg-'][class*='gray-700/50'] {
  background-color: var(--ui-bg-surface) !important;
}

.workflow-header {
  border-bottom: 1px solid var(--ui-border-subtle);
}

.workflow-empty-state,
.workflow-note,
.workflow-label,
.workflow-track-empty,
.workflow-pool-label,
.workflow-mobile-toolbar-label {
  color: var(--ui-text-2);
}

.workflow-lane-shell,
.workflow-interval-card,
.workflow-track,
.workflow-editor,
.workflow-input,
.workflow-select {
  border: 1px solid var(--ui-border-subtle);
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 82%, transparent);
}

.workflow-lane-header {
  border-bottom: 1px solid var(--ui-border-subtle);
  background: color-mix(in srgb, var(--ui-bg-surface) 74%, transparent);
}

.workflow-enabled-badge {
  border-width: 1px;
  border-style: solid;
}

.workflow-status-banner {
  border-width: 1px;
  border-style: solid;
}

.workflow-track {
  border-top: 1px dashed var(--ui-border-subtle);
  border-bottom: 1px dashed var(--ui-border-subtle);
}

.workflow-track-active {
  background: color-mix(in srgb, var(--ui-brand-500) 6%, var(--ui-bg-surface-raised));
  border-color: color-mix(in srgb, var(--ui-brand-500) 30%, var(--ui-border-subtle));
}

.workflow-placeholder {
  border-color: color-mix(in srgb, var(--ui-brand-500) 50%, transparent);
  background: color-mix(in srgb, var(--ui-brand-500) 10%, var(--ui-bg-surface-raised));
}

.workflow-arrow {
  color: var(--ui-text-3);
}

.workflow-node-chip {
  border-width: 1px;
  border-style: solid;
}

.workflow-pool-chip {
  border-width: 1px;
  border-style: solid;
}

.workflow-node-delete {
  background: var(--ui-status-danger);
  color: var(--ui-text-on-brand);
}

.workflow-node-delete:hover {
  background: color-mix(in srgb, var(--ui-status-danger) 88%, black 12%);
}

.workflow-node-settings {
  background: var(--ui-status-info);
  color: var(--ui-text-on-brand);
}

.workflow-node-settings:hover {
  background: color-mix(in srgb, var(--ui-status-info) 88%, black 12%);
}

.workflow-editor {
  border-color: color-mix(in srgb, var(--ui-brand-500) 20%, var(--ui-border-subtle));
}

.workflow-editor-close {
  color: var(--ui-text-2);
}

.workflow-editor-close:hover {
  color: var(--ui-text-1);
}

.workflow-editor-title {
  color: var(--ui-brand-700);
}

.workflow-checkbox-label {
  color: var(--ui-text-2);
}

.workflow-input,
.workflow-select {
  color: var(--ui-text-1);
}

.workflow-mobile-toolbar {
  z-index: 12;
  display: grid;
  gap: 0.85rem;
  border: 1px solid var(--ui-border-subtle);
  border-radius: 1rem;
  padding: 0.9rem;
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 90%, transparent);
}

.workflow-mobile-toolbar-group {
  display: grid;
  gap: 0.55rem;
}

.workflow-mobile-toolbar-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.workflow-pool-chip:hover {
  filter: brightness(1.02);
}

.custom-scrollbar::-webkit-scrollbar {
  height: 8px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: var(--ui-bg-surface);
  border-radius: 4px;
}
.dark .custom-scrollbar::-webkit-scrollbar-track {
  background: var(--ui-bg-surface);
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--ui-scrollbar-thumb);
  border-radius: 4px;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--ui-scrollbar-thumb);
}

.wf-horizontal-move {
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.wf-horizontal-enter-active,
.wf-horizontal-leave-active {
  transition: all 0.3s ease;
}
.wf-horizontal-enter-from {
  opacity: 0;
  transform: translateX(-20px) scale(0.9);
}
.wf-horizontal-leave-to {
  opacity: 0;
  transform: scale(0.9);
  position: absolute;
}
</style>
