<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import ConfirmModal from '@/components/ConfirmModal.vue'
import LandCard from '@/components/LandCard.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import { useAccountStore } from '@/stores/account'
import { useFriendStore } from '@/stores/friend'
import { useStatusStore } from '@/stores/status'
import { useToastStore } from '@/stores/toast'

const accountStore = useAccountStore()
const toast = useToastStore()
const friendStore = useFriendStore()
const statusStore = useStatusStore()
const { currentAccountId, currentAccount } = storeToRefs(accountStore)
const { friends, loading, friendLands, friendLandsLoading, blacklist } = storeToRefs(friendStore)
const { status, loading: statusLoading, realtimeConnected } = storeToRefs(statusStore)

// Confirm Modal state
const showConfirm = ref(false)
const confirmMessage = ref('')
const confirmLoading = ref(false)
const pendingAction = ref<(() => Promise<void>) | null>(null)
const avatarErrorKeys = ref<Set<string>>(new Set())
const selectionMode = ref(false)
const selectedFriendIds = ref<number[]>([])
const batchRunning = ref(false)
const batchResult = ref<any | null>(null)

function confirmAction(msg: string, action: () => Promise<void>) {
  confirmMessage.value = msg
  pendingAction.value = action
  showConfirm.value = true
}

async function onConfirm() {
  if (pendingAction.value) {
    try {
      confirmLoading.value = true
      await pendingAction.value()
      pendingAction.value = null
      showConfirm.value = false
    }
    finally {
      confirmLoading.value = false
    }
  }
  else {
    showConfirm.value = false
  }
}

// Track expanded friends
const expandedFriends = ref<Set<string>>(new Set())

async function loadFriends() {
  if (currentAccountId.value) {
    const acc = currentAccount.value
    if (!acc)
      return

    if (!realtimeConnected.value) {
      await statusStore.fetchStatus(currentAccountId.value)
    }

    avatarErrorKeys.value.clear()
    const result = await friendStore.fetchFriends(currentAccountId.value)
    if (result?.fromCache) {
      toast.warning('好友列表实时拉取失败，已显示缓存数据，可能非最新')
    }
    if (acc.running || friends.value.length > 0) {
      await friendStore.fetchBlacklist(currentAccountId.value)
    }
  }
}

useIntervalFn(() => {
  for (const gid in friendLands.value) {
    if (friendLands.value[gid]) {
      friendLands.value[gid] = friendLands.value[gid].map((l: any) =>
        l.matureInSec > 0 ? { ...l, matureInSec: l.matureInSec - 1 } : l,
      )
    }
  }
}, 1000)

onMounted(() => {
  loadFriends()
})

// 【修复闪烁】监听 accountId 字符串值而非 currentAccount 对象引用
watch(() => currentAccountId.value, () => {
  expandedFriends.value.clear()
  selectedFriendIds.value = []
  batchResult.value = null
  loadFriends()
})

// Search state
const searchQuery = ref('')

const filteredFriends = computed(() => {
  if (!searchQuery.value)
    return friends.value
  const q = searchQuery.value.toLowerCase()
  return friends.value.filter((f: any) => {
    const nameStr = String(f.name || f.nick || f.userName || f.id || '').toLowerCase()
    return nameStr.includes(q)
  })
})

const selectedFriendCount = computed(() => selectedFriendIds.value.length)
const selectedIdSet = computed(() => new Set(selectedFriendIds.value))

function toggleFriend(friendId: string) {
  if (expandedFriends.value.has(friendId)) {
    expandedFriends.value.delete(friendId)
  }
  else {
    // Collapse others? The original code does:
    // document.querySelectorAll('.friend-lands').forEach(e => e.style.display = 'none');
    // So it behaves like an accordion.
    expandedFriends.value.clear()
    expandedFriends.value.add(friendId)
    if (currentAccountId.value && currentAccount.value?.running && status.value?.connection?.connected) {
      friendStore.fetchFriendLands(currentAccountId.value, friendId)
    }
  }
}

function toggleSelectionMode() {
  selectionMode.value = !selectionMode.value
  if (!selectionMode.value) {
    selectedFriendIds.value = []
  }
}

function toggleFriendSelection(friendId: string | number, e?: Event) {
  e?.stopPropagation()
  const gid = Number(friendId || 0)
  if (!gid)
    return
  if (selectedIdSet.value.has(gid)) {
    selectedFriendIds.value = selectedFriendIds.value.filter(id => id !== gid)
  }
  else {
    selectedFriendIds.value = [...selectedFriendIds.value, gid]
  }
}

function selectAllFiltered() {
  selectedFriendIds.value = filteredFriends.value.map((friend: any) => Number(friend.gid || 0)).filter((gid: number) => gid > 0)
}

function clearSelectedFriends() {
  selectedFriendIds.value = []
}

async function handleOp(friendId: string, type: string, e: Event) {
  e.stopPropagation()
  if (!currentAccountId.value)
    return

  confirmAction('确定执行此操作吗?', async () => {
    await friendStore.operate(currentAccountId.value!, friendId, type)
    await loadFriends() // 操作完毕后局部刷新
  })
}

async function handleToggleBlacklist(friend: any, e: Event) {
  e.stopPropagation()
  if (!currentAccountId.value)
    return
  await friendStore.toggleBlacklist(currentAccountId.value, Number(friend.gid))
  await loadFriends() // 切换黑名单后局部刷新
}

async function handleBatchOp(opType: string) {
  if (!currentAccountId.value || selectedFriendIds.value.length === 0)
    return
  const actionLabels: Record<string, string> = {
    steal: '批量偷菜',
    water: '批量浇水',
    weed: '批量除草',
    bug: '批量除虫',
    bad: '批量捣乱',
    blacklist_add: '批量加入黑名单',
    blacklist_remove: '批量移出黑名单',
  }
  confirmAction(`确定对已选 ${selectedFriendIds.value.length} 位好友执行“${actionLabels[opType] || opType}”吗？`, async () => {
    batchRunning.value = true
    try {
      const result = await friendStore.batchOperate(currentAccountId.value!, selectedFriendIds.value, opType, {
        continueOnError: true,
        skipBlacklisted: opType !== 'blacklist_remove',
        cooldownMs: 1200,
      })
      batchResult.value = result
      if (result?.successCount > 0) {
        toast.success(`${actionLabels[opType] || '批量操作'}完成，成功 ${result.successCount} 项`)
      }
      else {
        toast.warning(`${actionLabels[opType] || '批量操作'}已执行，但没有成功项`)
      }
      if (opType === 'blacklist_add' || opType === 'blacklist_remove') {
        await friendStore.fetchBlacklist(currentAccountId.value!)
      }
      await loadFriends()
    }
    finally {
      batchRunning.value = false
    }
  })
}

function getFriendStatusText(friend: any) {
  const p = friend.plant || {}
  const info = []
  if (p.stealNum)
    info.push(`偷${p.stealNum}`)
  if (p.dryNum)
    info.push(`水${p.dryNum}`)
  if (p.weedNum)
    info.push(`草${p.weedNum}`)
  if (p.insectNum)
    info.push(`虫${p.insectNum}`)
  return info.length ? info.join(' ') : '无操作'
}

function getFriendAvatar(friend: any) {
  const direct = String(friend?.avatarUrl || friend?.avatar_url || '').trim()
  if (direct)
    return direct
  const gid = String(friend?.gid || '').trim()
  const uin = String(friend?.uin || '').trim()
  if (!uin || !/^\d+$/.test(uin) || uin === gid)
    return ''
  if (uin && !friend?.isWechat)
    return `https://q1.qlogo.cn/g?b=qq&nk=${uin}&s=100`
  return ''
}

function getFriendAvatarKey(friend: any) {
  const key = String(friend?.gid || friend?.uin || '').trim()
  return key || String(friend?.name || '').trim()
}

function canShowFriendAvatar(friend: any) {
  const key = getFriendAvatarKey(friend)
  if (!key)
    return false
  return !!getFriendAvatar(friend) && !avatarErrorKeys.value.has(key)
}

function handleFriendAvatarError(friend: any) {
  const key = getFriendAvatarKey(friend)
  if (!key)
    return
  avatarErrorKeys.value.add(key)
}

function getBatchResultStateClass(row: any) {
  if (row?.ok)
    return 'friends-result-state friends-result-state-success'
  if (row?.skipped)
    return 'friends-result-state friends-result-state-skipped'
  return 'friends-result-state friends-result-state-error'
}

function getFriendStatusClass(friend: any) {
  return getFriendStatusText(friend) !== '无操作'
    ? 'friends-status-text friends-status-text-active'
    : 'friends-status-text friends-status-text-idle'
}
</script>

<template>
  <div class="friends-page ui-page-shell ui-page-density-relaxed h-full min-h-0 w-full flex flex-col">
    <div class="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
      <h2 class="flex items-center gap-2 text-2xl font-bold">
        <div class="i-carbon-user-multiple" />
        好友
        <span v-if="friends.length" class="glass-text-muted ml-2 text-sm font-normal">
          (共 {{ friends.length }} 人)
        </span>
      </h2>
      <div class="relative w-full shrink-0 sm:w-64">
        <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <div class="friends-search-icon i-carbon-search" />
        </div>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索好友昵称/备注..."
          class="friends-search-input glass-text-main block h-[38px] w-full rounded-lg py-2 pl-10 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
      </div>
    </div>

    <div class="friends-toolbar ui-mobile-sticky-toolbar mb-4">
      <div class="ui-bulk-actions">
        <button class="batch-btn" :class="{ active: selectionMode }" @click="toggleSelectionMode">
          {{ selectionMode ? '退出批量模式' : '批量模式' }}
        </button>
        <template v-if="selectionMode">
          <button class="batch-btn batch-btn-subtle" @click="selectAllFiltered">
            全选当前筛选
          </button>
          <button class="batch-btn batch-btn-subtle" @click="clearSelectedFriends">
            清空选择
          </button>
          <span class="friends-summary-note text-sm">
            已选 {{ selectedFriendCount }} 位
          </span>
        </template>
      </div>
    </div>

    <div v-if="selectionMode" class="glass-panel ui-mobile-action-panel mb-4 rounded-xl p-4 shadow">
      <div class="ui-bulk-actions">
        <button class="batch-action batch-blue" :disabled="batchRunning || selectedFriendCount === 0" @click="handleBatchOp('steal')">
          批量偷菜
        </button>
        <button class="batch-action batch-cyan" :disabled="batchRunning || selectedFriendCount === 0" @click="handleBatchOp('water')">
          批量浇水
        </button>
        <button class="batch-action batch-green" :disabled="batchRunning || selectedFriendCount === 0" @click="handleBatchOp('weed')">
          批量除草
        </button>
        <button class="batch-action batch-orange" :disabled="batchRunning || selectedFriendCount === 0" @click="handleBatchOp('bug')">
          批量除虫
        </button>
        <button class="batch-action batch-red" :disabled="batchRunning || selectedFriendCount === 0" @click="handleBatchOp('bad')">
          批量捣乱
        </button>
        <button class="batch-action batch-gray" :disabled="batchRunning || selectedFriendCount === 0" @click="handleBatchOp('blacklist_add')">
          批量拉黑
        </button>
        <button class="batch-action batch-gray" :disabled="batchRunning || selectedFriendCount === 0" @click="handleBatchOp('blacklist_remove')">
          批量移黑
        </button>
      </div>
      <div class="friends-summary-note mt-2 text-xs">
        批量操作默认串行执行，每个好友之间会插入保守冷却，避免瞬时请求过密。
      </div>
    </div>

    <div v-if="batchResult" class="glass-panel mb-4 rounded-xl p-4 shadow">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div class="text-sm font-semibold">
            批量结果
          </div>
          <div class="friends-summary-note mt-1 text-xs">
            成功 {{ batchResult.successCount || 0 }} · 失败 {{ batchResult.failCount || 0 }} · 影响 {{ batchResult.totalAffectedCount || 0 }}
          </div>
        </div>
        <button class="batch-btn batch-btn-subtle" @click="batchResult = null">
          收起
        </button>
      </div>
      <div class="mt-3 max-h-64 overflow-y-auto pr-1 space-y-2">
        <div
          v-for="row in batchResult.results || []"
          :key="`batch-${row.gid}-${row.opType}`"
          class="friends-result-row flex items-center justify-between rounded-lg px-3 py-2 text-sm"
        >
          <div>
            <div class="font-medium">
              GID {{ row.gid }}
            </div>
            <div class="friends-summary-note text-xs">
              {{ row.message || '已处理' }}
            </div>
          </div>
          <div class="text-xs" :class="getBatchResultStateClass(row)">
            {{ row.ok ? `成功 ${row.count || 0}` : (row.skipped ? '已跳过' : '失败') }}
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading || statusLoading" class="flex justify-center py-12">
      <div class="friends-spinner i-svg-spinners-90-ring-with-bg text-4xl" />
    </div>

    <div v-else-if="!currentAccountId" class="glass-panel glass-text-muted rounded-lg p-8 text-center shadow">
      请选择账号后查看好友
    </div>

    <div v-else-if="!status?.connection?.connected" class="glass-panel glass-text-muted flex flex-col items-center justify-center gap-4 rounded-lg p-12 text-center shadow">
      <div class="friends-offline-icon i-carbon-connection-signal-off text-4xl" />
      <div>
        <div class="glass-text-main text-lg font-medium">
          账号未登录
        </div>
        <div class="friends-summary-note mt-1 text-sm">
          请先运行账号或检查网络连接
        </div>
      </div>
    </div>

    <div v-else-if="friends.length === 0" class="glass-panel glass-text-muted rounded-lg p-8 text-center shadow">
      暂无好友或数据加载失败
    </div>

    <div v-else>
      <div v-if="filteredFriends.length === 0" class="glass-panel glass-text-muted mb-4 rounded-lg p-8 text-center shadow">
        没有匹配的好友
      </div>
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3 sm:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="friend in filteredFriends"
          :key="friend.gid"
          class="glass-panel flex flex-col overflow-hidden rounded-lg shadow"
        >
          <div
            class="friends-card-body flex flex-1 flex-col cursor-pointer gap-4 p-4 transition"
            :class="blacklist.includes(Number(friend.gid)) ? 'opacity-50' : ''"
            @click="toggleFriend(friend.gid)"
          >
            <!-- 头部：头像 + 名字 + 状态 -->
            <div class="flex items-center gap-3">
              <label
                v-if="selectionMode"
                class="friends-select-box h-5 w-5 flex shrink-0 items-center justify-center rounded"
                @click.stop
              >
                <input
                  :checked="selectedIdSet.has(Number(friend.gid))"
                  type="checkbox"
                  @change="toggleFriendSelection(friend.gid, $event)"
                >
              </label>
              <div class="friends-avatar-shell h-12 w-12 flex shrink-0 items-center justify-center overflow-hidden rounded-full">
                <img
                  v-if="canShowFriendAvatar(friend)"
                  :src="getFriendAvatar(friend)"
                  class="h-full w-full object-cover"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                  @error="handleFriendAvatarError(friend)"
                >
                <div v-else class="friends-avatar-fallback i-carbon-user text-xl" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 truncate font-bold">
                  <span class="truncate">{{ friend.name }}</span>
                  <BaseBadge v-if="friend.farmLevel != null && friend.farmLevel > 0" surface="meta" tone="warning" class="friends-level-pill whitespace-nowrap rounded px-1.5 py-0.5 text-[10px]">
                    Lv.{{ friend.farmLevel }}
                  </BaseBadge>
                  <BaseBadge v-if="blacklist.includes(Number(friend.gid))" surface="meta" tone="neutral" class="friends-blacklist-pill whitespace-nowrap rounded px-1.5 py-0.5 text-[10px]">
                    已屏蔽
                  </BaseBadge>
                </div>
                <div class="mt-0.5 truncate text-sm" :class="getFriendStatusClass(friend)">
                  {{ getFriendStatusText(friend) }}
                </div>
              </div>
            </div>

            <!-- 操作按钮：网格3列，强制不换行 -->
            <div class="friends-op-area grid grid-cols-3 mt-auto gap-1.5 pt-2">
              <button
                class="op-btn op-blue w-full whitespace-nowrap"
                @click="handleOp(friend.gid, 'steal', $event)"
              >
                偷取
              </button>
              <button
                class="op-btn op-cyan w-full whitespace-nowrap"
                @click="handleOp(friend.gid, 'water', $event)"
              >
                浇水
              </button>
              <button
                class="op-btn op-green w-full whitespace-nowrap"
                @click="handleOp(friend.gid, 'weed', $event)"
              >
                除草
              </button>
              <button
                class="op-btn op-orange w-full whitespace-nowrap"
                @click="handleOp(friend.gid, 'bug', $event)"
              >
                除虫
              </button>
              <button
                class="op-btn op-red w-full whitespace-nowrap"
                @click="handleOp(friend.gid, 'bad', $event)"
              >
                捣乱
              </button>
              <button
                class="op-btn op-gray w-full whitespace-nowrap"
                :class="{ 'opacity-80': blacklist.includes(Number(friend.gid)) }"
                @click="handleToggleBlacklist(friend, $event)"
              >
                {{ blacklist.includes(Number(friend.gid)) ? '取消' : '屏蔽' }}
              </button>
            </div>
          </div>

          <!-- 展开的土地详情 -->
          <div v-if="expandedFriends.has(friend.gid)" class="friends-expanded-panel border-t p-3">
            <div v-if="friendLandsLoading[friend.gid]" class="flex justify-center py-4">
              <div class="friends-spinner i-svg-spinners-90-ring-with-bg text-2xl" />
            </div>
            <div v-else-if="!friendLands[friend.gid] || friendLands[friend.gid]?.length === 0" class="glass-text-muted py-4 text-center text-sm">
              无土地数据
            </div>
            <div v-else class="grid grid-cols-3 gap-2 md:grid-cols-3 sm:grid-cols-4 xl:grid-cols-4">
              <LandCard
                v-for="land in friendLands[friend.gid]"
                :key="land.id"
                :land="land"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <ConfirmModal
      :show="showConfirm"
      :loading="confirmLoading"
      title="确认操作"
      :message="confirmMessage"
      @confirm="onConfirm"
      @cancel="!confirmLoading && (showConfirm = false)"
    />
  </div>
</template>

<style scoped>
.friends-page {
  color: var(--ui-text-1);
}

.friends-page :is([class*='text-'][class*='gray-400'], [class*='text-'][class*='gray-500'], .glass-text-muted) {
  color: var(--ui-text-2) !important;
}

.friends-search-icon,
.friends-avatar-fallback,
.friends-offline-icon {
  color: var(--ui-text-3) !important;
}

.friends-search-input {
  border: 1px solid var(--ui-border-subtle) !important;
  background: color-mix(in srgb, var(--ui-bg-surface) 60%, transparent) !important;
}

.friends-summary-note {
  color: var(--ui-text-2) !important;
}

.friends-toolbar {
  z-index: 12;
}

.friends-result-row {
  border: 1px solid var(--ui-border-subtle) !important;
  background: color-mix(in srgb, var(--ui-bg-surface) 72%, transparent) !important;
}

.friends-result-state-success {
  color: color-mix(in srgb, var(--ui-status-success) 82%, var(--ui-text-1)) !important;
}

.friends-result-state-skipped {
  color: color-mix(in srgb, var(--ui-status-warning) 82%, var(--ui-text-1)) !important;
}

.friends-result-state-error {
  color: color-mix(in srgb, var(--ui-status-danger) 82%, var(--ui-text-1)) !important;
}

.friends-card-body:hover {
  background: color-mix(in srgb, var(--ui-bg-surface) 72%, transparent) !important;
}

.friends-select-box,
.friends-avatar-shell {
  border: 1px solid var(--ui-border-subtle) !important;
  background: color-mix(in srgb, var(--ui-bg-surface) 78%, transparent) !important;
}

.friends-level-pill,
.friends-blacklist-pill {
  display: inline-flex;
  align-items: center;
  border-width: 1px;
  border-style: solid;
  line-height: 1;
}

.friends-status-text-active {
  color: color-mix(in srgb, var(--ui-status-success) 82%, var(--ui-text-1)) !important;
  font-weight: 600;
}

.friends-status-text-idle {
  color: var(--ui-text-2) !important;
}

.friends-expanded-panel {
  border-color: var(--ui-border-subtle) !important;
  background: color-mix(in srgb, var(--ui-bg-surface) 66%, transparent) !important;
}

.friends-spinner {
  color: var(--ui-status-info) !important;
}

.friends-page input[type='text'] {
  border-color: var(--ui-border-subtle) !important;
  background: color-mix(in srgb, var(--ui-bg-surface) 60%, transparent) !important;
  color: var(--ui-text-1) !important;
}

.friends-page input[type='text']:focus {
  border-color: var(--ui-brand-500) !important;
  background: var(--ui-bg-surface-raised) !important;
  box-shadow: 0 0 0 2px var(--ui-focus-ring) !important;
}

.friends-page [class*='border-'][class*='gray-200'],
.friends-page [class*='border-'][class*='gray-300'],
.friends-page [class*='dark:border-'][class*='gray-700'],
.friends-page [class*='dark:border-'][class*='gray-600'],
.friends-page [class*='dark:border-'][class*='white/5'] {
  border-color: var(--ui-border-subtle) !important;
}

.friends-page [class*='bg-'][class*='gray-50/50'],
.friends-page [class*='bg-'][class*='black/20'],
.friends-page [class*='bg-'][class*='black/5'],
.friends-page [class*='dark:bg-'][class*='black/20'] {
  background: color-mix(in srgb, var(--ui-bg-surface) 62%, transparent) !important;
}

/* 统一操作按钮基础样式 */
.op-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid transparent;
  cursor: pointer;
  line-height: 1.25;
}

.op-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.05);
}

.op-btn:active {
  transform: translateY(0);
}

.batch-btn {
  border-radius: 999px;
  border: 1px solid var(--ui-border-strong);
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 72%, transparent);
  padding: 0.5rem 0.95rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ui-text-2);
}

.batch-btn.active {
  border-color: transparent;
  background: linear-gradient(135deg, var(--ui-brand-700), var(--ui-brand-500));
  color: var(--ui-text-on-brand);
}

.batch-btn-subtle {
  background: color-mix(in srgb, var(--ui-bg-surface) 58%, transparent);
}

.batch-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 0.5rem 0.95rem;
  font-size: 0.875rem;
  font-weight: 600;
  border: 1px solid transparent;
}

.batch-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 颜色方案变体 - 浅色模式 */
.op-blue {
  background-color: color-mix(in srgb, var(--ui-brand-500) 12%, transparent);
  color: var(--ui-text-1);
}
.op-cyan {
  background-color: var(--ui-status-info-soft);
  color: var(--ui-status-info);
}
.op-green {
  background-color: var(--ui-status-success-soft);
  color: var(--ui-status-success);
}
.op-orange {
  background-color: var(--ui-status-warning-soft);
  color: var(--ui-status-warning);
}
.op-red {
  background-color: var(--ui-status-danger-soft);
  color: var(--ui-status-danger);
}
.op-gray {
  background-color: color-mix(in srgb, var(--ui-bg-surface) 68%, transparent);
  color: var(--ui-text-2);
  border: 1px solid var(--ui-border-subtle);
}
.batch-blue {
  background-color: color-mix(in srgb, var(--ui-brand-500) 12%, transparent);
  color: var(--ui-text-1);
}
.batch-cyan {
  background-color: var(--ui-status-info-soft);
  color: var(--ui-status-info);
}
.batch-green {
  background-color: var(--ui-status-success-soft);
  color: var(--ui-status-success);
}
.batch-orange {
  background-color: var(--ui-status-warning-soft);
  color: var(--ui-status-warning);
}
.batch-red {
  background-color: var(--ui-status-danger-soft);
  color: var(--ui-status-danger);
}
.batch-gray {
  background-color: color-mix(in srgb, var(--ui-bg-surface) 68%, transparent);
  color: var(--ui-text-2);
  border-color: var(--ui-border-subtle);
}
</style>

<!-- 非 scoped：深色模式需匹配 <html class="dark"> 祖先，用 .friends-op-area 前缀防泄漏 -->
<style>
.dark .friends-op-area .op-blue {
  color: var(--ui-text-1);
}
.dark .friends-op-area .op-cyan {
  color: var(--ui-status-info);
}
.dark .friends-op-area .op-green {
  color: var(--ui-status-success);
}
.dark .friends-op-area .op-orange {
  color: var(--ui-status-warning);
}
.dark .friends-op-area .op-red {
  color: var(--ui-status-danger);
}
.dark .friends-op-area .op-gray {
  color: var(--ui-text-2);
}
.dark .friends-op-area .op-btn:hover {
  box-shadow: 0 0 12px var(--ui-shadow-panel);
  border-color: currentColor;
}
.dark .batch-blue {
  color: var(--ui-text-1);
}
.dark .batch-cyan {
  color: var(--ui-status-info);
}
.dark .batch-green {
  color: var(--ui-status-success);
}
.dark .batch-orange {
  color: var(--ui-status-warning);
}
.dark .batch-red {
  color: var(--ui-status-danger);
}
.dark .batch-gray {
  color: var(--ui-text-2);
}
</style>
