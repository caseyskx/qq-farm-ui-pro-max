<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import api from '@/api'
import ConfirmModal from '@/components/ConfirmModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import { useAccountStore } from '@/stores/account'
import { useFarmStore } from '@/stores/farm'
import { useFriendStore } from '@/stores/friend'
import { useSettingStore } from '@/stores/setting'
import { localizeRuntimeText } from '@/utils/runtime-text'

const accountStore = useAccountStore()
const farmStore = useFarmStore()
const friendStore = useFriendStore()
const settingStore = useSettingStore()

const { currentAccountId, accounts } = storeToRefs(accountStore)
const { seeds } = storeToRefs(farmStore)
const { friends: liveFriends, cachedFriends, loading: friendsLoading } = storeToRefs(friendStore)
const { settings, loading: settingsLoading } = storeToRefs(settingStore)

const avatarErrorKeys = ref<Set<string>>(new Set())
const plantImageErrorKeys = ref<Set<number>>(new Set())
const plantImageFallbackIndex = ref<Record<number, number>>({})

function getSafeImageUrl(url: string) {
  const normalized = String(url || '').trim()
  if (!normalized)
    return ''
  if (normalized.startsWith('http://'))
    return normalized.replace('http://', 'https://')
  return normalized
}

function getFriendSelectionId(friend: any) {
  const candidates = [friend?.gid, friend?.friendGid, friend?.id]
  for (const candidate of candidates) {
    const resolved = Number(candidate || 0)
    if (Number.isFinite(resolved) && resolved > 0)
      return resolved
  }
  return 0
}

function getFriendDisplayName(friend: any) {
  const direct = String(friend?.name || friend?.remark || friend?.nick || friend?.userName || '').trim()
  if (direct)
    return direct
  const gid = getFriendSelectionId(friend)
  return gid > 0 ? `GID:${gid}` : '未命名好友'
}

function getFriendSecondaryLabel(friend: any) {
  const uin = String(friend?.uin || '').trim()
  if (uin)
    return `QQ ${uin}`
  const gid = getFriendSelectionId(friend)
  return gid > 0 ? `GID ${gid}` : '--'
}

const resolvedFriends = computed(() => {
  const merged = new Map<number, any>()
  for (const source of [liveFriends.value, cachedFriends.value]) {
    for (const friend of Array.isArray(source) ? source : []) {
      const gid = getFriendSelectionId(friend)
      if (!gid)
        continue
      const prev = merged.get(gid) || {}
      merged.set(gid, {
        ...prev,
        ...friend,
        gid,
        id: friend?.id ?? prev.id ?? gid,
        uin: String(friend?.uin || prev.uin || '').trim(),
        name: getFriendDisplayName({ ...prev, ...friend, gid }),
        avatarUrl: String(friend?.avatarUrl || friend?.avatar_url || prev.avatarUrl || '').trim(),
      })
    }
  }
  return Array.from(merged.values())
})

function getFriendAvatar(friend: any) {
  const direct = getSafeImageUrl(friend?.avatarUrl || friend?.avatar_url || '')
  if (direct)
    return direct
  const gid = String(getFriendSelectionId(friend) || '')
  const idCandidate = String(friend?.id || '').trim()
  const uin = String(friend?.uin || '').trim() || (idCandidate && idCandidate !== gid ? idCandidate : '')
  if (uin)
    return `https://q1.qlogo.cn/g?b=qq&nk=${uin}&s=100`
  return ''
}

function getFriendAvatarKey(friend: any) {
  const key = String(getFriendSelectionId(friend) || friend?.uin || friend?.id || '').trim()
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

const saving = ref(false)

const modalVisible = ref(false)
const modalConfig = ref({
  title: '',
  message: '',
  type: 'primary' as 'primary' | 'danger',
  isAlert: true,
})

function showAlert(message: string, type: 'primary' | 'danger' = 'primary') {
  modalConfig.value = {
    title: type === 'danger' ? '错误' : '提示',
    message,
    type,
    isAlert: true,
  }
  modalVisible.value = true
}

const localSettings = ref({
  automation: {
    stealFilterEnabled: false,
    stealFilterMode: 'blacklist' as 'blacklist' | 'whitelist',
    stealFilterPlantIds: [] as number[],
    stealFriendFilterEnabled: false,
    stealFriendFilterMode: 'blacklist' as 'blacklist' | 'whitelist',
    stealFriendFilterIds: [] as number[],
    skipStealRadishEnabled: false,
  } as Record<string, any>,
})

// === UI State ===
const activeTab = ref<'friends' | 'plants'>('friends')
const searchQuery = ref('')
const selectedAccount = ref<string>(currentAccountId.value || '')
const footerSelectionSummary = computed(() => activeTab.value === 'friends'
  ? `当前名单 ${localSettings.value.automation.stealFriendFilterIds.length}/${resolvedFriends.value.length || 0}`
  : `当前作物 ${localSettings.value.automation.stealFilterPlantIds.length}/${seeds.value?.length || 0}`)

function syncLocalSettings() {
  if (settings.value && settings.value.automation) {
    const s = settings.value.automation as any
    // 后端返回的 plantIds/friendIds 为字符串，需转为数字以便与 seed.seedId 等正确匹配
    localSettings.value.automation = {
      stealFilterEnabled: s.stealFilterEnabled ?? false,
      stealFilterMode: s.stealFilterMode ?? 'blacklist',
      stealFilterPlantIds: (s.stealFilterPlantIds || []).map((id: any) => Number(id)),
      stealFriendFilterEnabled: s.stealFriendFilterEnabled ?? false,
      stealFriendFilterMode: s.stealFriendFilterMode ?? 'blacklist',
      stealFriendFilterIds: (s.stealFriendFilterIds || []).map((id: any) => Number(id)),
      skipStealRadishEnabled: s.skipStealRadishEnabled ?? false,
    }
  }
}

const cropAnalytics = ref<Record<string, any>>({})

async function loadData() {
  if (selectedAccount.value) {
    if (currentAccountId.value !== selectedAccount.value) {
      accountStore.setCurrentAccount({ id: selectedAccount.value } as any)
    }
    avatarErrorKeys.value.clear()
    plantImageErrorKeys.value.clear()
    plantImageFallbackIndex.value = {}
    cropAnalytics.value = {}
    liveFriends.value = []
    cachedFriends.value = []
    await settingStore.fetchSettings(selectedAccount.value)
    syncLocalSettings()

    // 加载全部种子和好友(使用本地缓存避免风控)
    await farmStore.fetchSeeds(selectedAccount.value)
    await friendStore.fetchCachedFriends(selectedAccount.value)
    if (!cachedFriends.value.length) {
      await friendStore.fetchFriends(selectedAccount.value)
    }

    try {
      const res = await api.get('/api/analytics', {
        headers: { 'x-account-id': selectedAccount.value },
        params: { sort: 'level' },
      })
      if (res.data && res.data.ok) {
        const map: Record<string, any> = {}
        for (const item of res.data.data) {
          map[item.seedId] = item
        }
        cropAnalytics.value = map
      }
    }
    catch (e) {
      console.error('获取作物分析数据失败:', e)
    }
  }
}

onMounted(() => {
  if (!selectedAccount.value && accounts.value.length > 0) {
    selectedAccount.value = String(accounts.value[0]?.id || accounts.value[0]?.uin || '')
  }
  loadData()
})

watch(() => accounts.value, (nextAccounts) => {
  if (!selectedAccount.value && nextAccounts.length > 0) {
    selectedAccount.value = String(nextAccounts[0]?.id || nextAccounts[0]?.uin || '')
  }
})

watch(() => selectedAccount.value, () => {
  searchQuery.value = ''
  loadData()
})

// 【修复闪烁】监听 accountId 字符串值而非 currentAccount 对象引用
watch(() => currentAccountId.value, (newId) => {
  if (newId && newId !== selectedAccount.value) {
    selectedAccount.value = newId
  }
})

// === Plants Logic ===

const filteredPlants = computed(() => {
  if (!seeds.value)
    return []
  let res = [...seeds.value]
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    res = res.filter(s => s.name.toLowerCase().includes(q))
  }
  return res
})

function isPlantSelected(seedId: number) {
  return localSettings.value.automation.stealFilterPlantIds.includes(seedId)
}

function togglePlant(seedId: number) {
  const arr = localSettings.value.automation.stealFilterPlantIds
  const idx = arr.indexOf(seedId)
  if (idx > -1) {
    arr.splice(idx, 1)
  }
  else {
    arr.push(seedId)
  }
}

// 批量设置植物选中状态
function selectAllPlants() {
  const currentSet = new Set(localSettings.value.automation.stealFilterPlantIds)
  filteredPlants.value.forEach(s => currentSet.add(s.seedId))
  localSettings.value.automation.stealFilterPlantIds = Array.from(currentSet)
}

function clearAllPlants() {
  const currentSet = new Set(localSettings.value.automation.stealFilterPlantIds)
  filteredPlants.value.forEach(s => currentSet.delete(s.seedId))
  localSettings.value.automation.stealFilterPlantIds = Array.from(currentSet)
}

function invertAllPlants() {
  const currentArr = localSettings.value.automation.stealFilterPlantIds
  const filteredIds = filteredPlants.value.map(s => s.seedId)
  const newArr = currentArr.filter((id: number) => !filteredIds.includes(id))
  filteredIds.forEach((id: number) => {
    if (!currentArr.includes(id))
      newArr.push(id)
  })
  localSettings.value.automation.stealFilterPlantIds = newArr
}

// === Friends Logic ===

const filteredFriends = computed(() => {
  if (!resolvedFriends.value.length)
    return []
  let res = [...resolvedFriends.value]
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    res = res.filter((f) => {
      const keywords = [
        getFriendDisplayName(f),
        getFriendSecondaryLabel(f),
        String(f?.remark || ''),
        String(f?.nick || ''),
      ]
      return keywords.some(keyword => keyword.toLowerCase().includes(q))
    })
  }
  return res
})

function isFriendSelected(id: number) {
  return localSettings.value.automation.stealFriendFilterIds.includes(id)
}

function toggleFriend(id: number) {
  const arr = localSettings.value.automation.stealFriendFilterIds
  const idx = arr.indexOf(id)
  if (idx > -1) {
    arr.splice(idx, 1)
  }
  else {
    arr.push(id)
  }
}

function selectAllFriends() {
  const currentSet = new Set(localSettings.value.automation.stealFriendFilterIds)
  filteredFriends.value.forEach(f => currentSet.add(getFriendSelectionId(f)))
  localSettings.value.automation.stealFriendFilterIds = Array.from(currentSet)
}

function clearAllFriends() {
  const currentSet = new Set(localSettings.value.automation.stealFriendFilterIds)
  filteredFriends.value.forEach(f => currentSet.delete(getFriendSelectionId(f)))
  localSettings.value.automation.stealFriendFilterIds = Array.from(currentSet)
}

function invertAllFriends() {
  const currentArr = localSettings.value.automation.stealFriendFilterIds
  const filteredIds = filteredFriends.value.map(f => getFriendSelectionId(f))
  const newArr = currentArr.filter((id: number) => !filteredIds.includes(id))
  filteredIds.forEach((id: number) => {
    if (!currentArr.includes(id))
      newArr.push(id)
  })
  localSettings.value.automation.stealFriendFilterIds = newArr
}

function getPlantImageCandidates(seed: any) {
  const seedId = Number(seed?.seedId || 0)
  return [
    getSafeImageUrl(seed?.seedImage || ''),
    getSafeImageUrl(seed?.image || ''),
    getSafeImageUrl(cropAnalytics.value[seedId]?.image || ''),
    seedId > 0 ? `https://qzonestyle.gtimg.cn/qzone/sngapp/app/appstore/app_100371286/crop/${seedId}.png` : '',
  ].filter((item, index, list) => !!item && list.indexOf(item) === index)
}

function getPlantImage(seed: any) {
  const seedId = Number(seed?.seedId || 0)
  const fallbackIndex = plantImageFallbackIndex.value[seedId] || 0
  return getPlantImageCandidates(seed)[fallbackIndex] || ''
}

function canShowPlantImage(seed: any) {
  const seedId = Number(seed?.seedId || 0)
  return !!getPlantImage(seed) && !plantImageErrorKeys.value.has(seedId)
}

function handlePlantImageError(seed: any, event: Event) {
  const seedId = Number(seed?.seedId || 0)
  if (!seedId)
    return
  const candidates = getPlantImageCandidates(seed)
  const currentIndex = plantImageFallbackIndex.value[seedId] || 0
  if (currentIndex < candidates.length - 1) {
    plantImageFallbackIndex.value = {
      ...plantImageFallbackIndex.value,
      [seedId]: currentIndex + 1,
    }
    const nextImage = candidates[currentIndex + 1]
    if (event.target instanceof HTMLImageElement && nextImage) {
      event.target.src = nextImage
      return
    }
  }
  plantImageErrorKeys.value.add(seedId)
}

// === Save Logic ===

async function saveAccountSettings() {
  if (!selectedAccount.value)
    return

  saving.value = true
  try {
    // We must merge with existing full settings so we don't wipe other automation configs
    const fullSettingsToSave = JSON.parse(JSON.stringify(settings.value))
    if (!fullSettingsToSave.automation)
      fullSettingsToSave.automation = {}

    Object.assign(fullSettingsToSave.automation, localSettings.value.automation)

    const res = await settingStore.saveSettings(selectedAccount.value, fullSettingsToSave)
    if (res.ok) {
      showAlert('偷菜设置已成功同步至云端')
    }
    else {
      showAlert(`保存失败: ${localizeRuntimeText(res.error || '未知错误')}`, 'danger')
    }
  }
  finally {
    saving.value = false
  }
}

function getStealTabClasses(active: boolean) {
  return active
    ? 'steal-tab steal-tab-active'
    : 'steal-tab steal-tab-idle'
}

function getStealBulkButtonClasses(kind: 'brand' | 'neutral' | 'danger') {
  return `steal-bulk-button steal-bulk-button-${kind}`
}

function getFriendCardClasses(selected: boolean) {
  return selected
    ? 'steal-list-card steal-friend-active'
    : 'steal-list-card steal-list-card-idle'
}

function getFriendCheckClasses(selected: boolean) {
  return selected
    ? 'steal-check-indicator steal-check-indicator-active'
    : 'steal-check-indicator steal-check-indicator-idle'
}

function getPlantCardClasses(selected: boolean) {
  return selected
    ? 'steal-plant-card steal-plant-active'
    : 'steal-plant-card steal-list-card-idle'
}

function getPlantCheckClasses(selected: boolean) {
  return selected
    ? 'steal-check-box steal-check-box-active'
    : 'steal-check-box steal-check-box-idle'
}

// Vue template usage is not always reflected in the TS unused analysis for this page.
void getStealTabClasses
void getStealBulkButtonClasses
void getFriendCardClasses
void getFriendCheckClasses
void getPlantCardClasses
void getPlantCheckClasses
</script>

<template>
  <div class="steal-settings-page ui-page-shell ui-page-density-relaxed ui-page-with-fixed-footer relative min-h-full w-full">
    <!-- Header -->
    <div class="steal-page-header mb-6 flex flex-col justify-between gap-4 pb-4 md:flex-row md:items-center">
      <div>
        <h1 class="glass-text-main flex items-center gap-2 text-2xl font-bold">
          <span class="text-primary-500 font-normal">🌱</span> 偷菜设置
        </h1>
        <p class="glass-text-muted mt-1 text-sm">
          精细化控制偷菜行为：选择哪些好友不偷、哪些作物不偷，定制专属自动化监控网。
        </p>
      </div>
      <div class="w-full shrink-0 md:w-64">
        <BaseSelect
          v-model="selectedAccount"
          :options="accounts.map(a => ({ label: String(a.name || a.nick || a.id || a.uin || ''), value: String(a.id || a.uin || '') }))"
        />
      </div>
    </div>

    <div v-if="settingsLoading" class="steal-empty-state flex flex-1 items-center justify-center py-20">
      <div class="i-svg-spinners-ring-resize text-3xl" />
    </div>

    <div v-else-if="!selectedAccount" class="steal-empty-state flex flex-1 flex-col items-center justify-center py-20">
      <div class="i-carbon-user-settings mb-4 text-4xl" />
      <p>请先在右上角选择指定账号</p>
    </div>

    <template v-else>
      <!-- 跳过白萝卜偷菜 -->
      <div class="steal-top-card glass-panel mb-3 flex flex-col items-start justify-between gap-4 p-3 sm:flex-row sm:items-center">
        <div class="flex items-center gap-2">
          <span class="glass-text-main text-sm font-medium">🥕 跳过白萝卜偷菜</span>
          <span class="glass-text-muted text-xs">开启后偷菜时自动跳过白萝卜，不偷取该作物</span>
        </div>
        <BaseSwitch v-model="localSettings.automation.skipStealRadishEnabled" size="sm" />
      </div>

      <div class="steal-controls-panel ui-mobile-sticky-panel mb-3">
        <!-- Tabs -->
        <div class="steal-tab-bar ui-bulk-actions flex shrink-0 gap-4 overflow-x-auto">
          <button
            class="steal-tab whitespace-nowrap border-b-2 px-4 py-2 font-medium transition-colors"
            :class="getStealTabClasses(activeTab === 'friends')"
            @click="activeTab = 'friends'; searchQuery = ''"
          >
            👥 好友偷菜名单 ({{ localSettings.automation.stealFriendFilterIds.length }}/{{ resolvedFriends.length }})
          </button>
          <button
            class="steal-tab whitespace-nowrap border-b-2 px-4 py-2 font-medium transition-colors"
            :class="getStealTabClasses(activeTab === 'plants')"
            @click="activeTab = 'plants'; searchQuery = ''"
          >
            🌾 作物偷菜过滤 ({{ localSettings.automation.stealFilterPlantIds.length }}/{{ seeds.length }})
          </button>
        </div>

        <div class="steal-toolbar glass-panel p-3 shadow-sm">
          <div class="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div class="relative min-w-0 flex-1 xl:max-w-xl">
              <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
                <div class="steal-search-icon i-carbon-search text-sm" />
              </div>
              <input
                v-model="searchQuery"
                type="text"
                :placeholder="activeTab === 'friends' ? '搜索好友昵称/备注...' : '搜索作物名称...'"
                class="steal-search-input glass-text-main m-0 box-border block h-[36px] w-full py-1.5 pl-9 pr-3 text-sm font-medium leading-5 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
            </div>

            <div class="steal-toolbar-actions flex flex-col gap-2 xl:ml-auto xl:items-end">
              <div class="ui-bulk-actions">
                <div class="steal-toolbar-chip flex items-center gap-2 px-3 py-1.5">
                  <span class="glass-text-muted text-xs font-medium">总控:</span>
                  <BaseSwitch v-if="activeTab === 'friends'" v-model="localSettings.automation.stealFriendFilterEnabled" size="sm" />
                  <BaseSwitch v-else v-model="localSettings.automation.stealFilterEnabled" size="sm" />
                </div>

                <div class="steal-toolbar-chip flex items-center gap-2 px-2 py-1">
                  <span class="glass-text-muted text-xs font-medium">模式:</span>
                  <select
                    v-if="activeTab === 'friends'"
                    v-model="localSettings.automation.stealFriendFilterMode"
                    class="steal-inline-select glass-text-main py-1.5 pl-2 pr-6 text-xs font-medium shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="blacklist" class="steal-select-option">
                      黑名单
                    </option>
                    <option value="whitelist" class="steal-select-option">
                      白名单
                    </option>
                  </select>
                  <select
                    v-else
                    v-model="localSettings.automation.stealFilterMode"
                    class="steal-inline-select glass-text-main py-1.5 pl-2 pr-6 text-xs font-medium shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="blacklist" class="steal-select-option">
                      黑名单
                    </option>
                    <option value="whitelist" class="steal-select-option">
                      白名单
                    </option>
                  </select>
                </div>
              </div>

              <div class="ui-bulk-actions xl:ml-2">
                <BaseButton
                  v-if="activeTab === 'friends'"
                  size="sm"
                  :class="getStealBulkButtonClasses('brand')"
                  @click="selectAllFriends"
                >
                  <div class="i-carbon-checkmark-outline mr-1.5 text-sm" /> 全选
                </BaseButton>
                <BaseButton
                  v-else
                  size="sm"
                  :class="getStealBulkButtonClasses('brand')"
                  @click="selectAllPlants"
                >
                  <div class="i-carbon-checkmark-outline mr-1.5 text-sm" /> 全选
                </BaseButton>

                <BaseButton
                  v-if="activeTab === 'friends'"
                  size="sm"
                  :class="getStealBulkButtonClasses('neutral')"
                  @click="invertAllFriends"
                >
                  反选
                </BaseButton>
                <BaseButton
                  v-else
                  size="sm"
                  :class="getStealBulkButtonClasses('neutral')"
                  @click="invertAllPlants"
                >
                  反选
                </BaseButton>

                <BaseButton
                  v-if="activeTab === 'friends'"
                  size="sm"
                  :class="getStealBulkButtonClasses('danger')"
                  @click="clearAllFriends"
                >
                  <div class="i-carbon-close-outline mr-1.5 text-sm" /> 清空
                </BaseButton>
                <BaseButton
                  v-else
                  size="sm"
                  :class="getStealBulkButtonClasses('danger')"
                  @click="clearAllPlants"
                >
                  <div class="i-carbon-close-outline mr-1.5 text-sm" /> 清空
                </BaseButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="steal-list-shell glass-panel min-h-[360px] p-4">
        <!-- Friends Grid -->
        <div v-if="activeTab === 'friends'" class="grid grid-cols-1 gap-3 lg:grid-cols-3 sm:grid-cols-2 xl:grid-cols-4">
          <div v-if="friendsLoading" class="glass-text-muted col-span-full flex flex-col items-center justify-center py-20">
            <div class="i-svg-spinners-ring-resize mb-3 text-4xl text-primary-500" />
            <p>正在加载好友列表...</p>
          </div>
          <div v-else-if="filteredFriends.length === 0" class="glass-text-muted col-span-full flex flex-col items-center justify-center py-20">
            <div class="i-carbon-search mx-auto mb-3 text-5xl opacity-30" />
            <p class="text-lg">
              没有匹配的好友数据
            </p>
          </div>

          <div
            v-for="friend in filteredFriends"
            :key="getFriendSelectionId(friend)"
            class="group flex cursor-pointer select-none items-center justify-between border rounded-lg p-3 transition-all"
            :class="getFriendCardClasses(isFriendSelected(getFriendSelectionId(friend)))"
            @click="toggleFriend(getFriendSelectionId(friend))"
          >
            <div class="flex items-center gap-3 overflow-hidden">
              <div class="steal-avatar-shell relative h-10 w-10 flex shrink-0 items-center justify-center overflow-hidden rounded-full shadow-sm">
                <img
                  v-if="canShowFriendAvatar(friend)"
                  :src="getFriendAvatar(friend)"
                  class="z-10 h-full w-full object-cover"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                  @error="handleFriendAvatarError(friend)"
                >
                <div v-else class="steal-avatar-fallback i-carbon-user absolute inset-0 z-0 flex items-center justify-center text-xl" />
              </div>
              <div class="min-w-0 flex flex-col">
                <span class="glass-text-main w-full truncate text-sm font-bold" :title="getFriendDisplayName(friend)">
                  {{ getFriendDisplayName(friend) }}
                </span>
                <span class="glass-text-muted mt-0.5 text-xs font-mono" title="QQ/uId">
                  {{ getFriendSecondaryLabel(friend) }}
                </span>
              </div>
            </div>
            <div class="flex shrink-0 flex-col items-end pl-2">
              <div
                class="h-[22px] w-[22px] flex items-center justify-center rounded-full transition-colors"
                :class="getFriendCheckClasses(isFriendSelected(getFriendSelectionId(friend)))"
              >
                <div v-if="isFriendSelected(getFriendSelectionId(friend))" class="i-carbon-checkmark text-sm" />
              </div>
            </div>
          </div>
        </div>

        <!-- Plants Grid (Rich View) -->
        <div v-if="activeTab === 'plants'" class="grid grid-cols-1 gap-3 lg:grid-cols-3 sm:grid-cols-2 xl:grid-cols-4">
          <div v-if="!seeds || seeds.length === 0" class="glass-text-muted col-span-full flex flex-col items-center justify-center py-20">
            <div class="i-carbon-search mx-auto mb-3 text-5xl opacity-30" />
            <p class="text-lg">
              没有加载到作物数据
            </p>
          </div>
          <div v-else-if="filteredPlants.length === 0" class="glass-text-muted col-span-full flex flex-col items-center justify-center py-20">
            <div class="i-carbon-search mx-auto mb-3 text-5xl opacity-30" />
            <p class="text-lg">
              未搜到匹配的作物
            </p>
          </div>

          <div
            v-for="seed in filteredPlants"
            :key="seed.seedId"
            class="group flex cursor-pointer select-none items-start justify-between border rounded-xl p-3.5 transition-all"
            :class="getPlantCardClasses(isPlantSelected(seed.seedId))"
            @click="togglePlant(seed.seedId)"
          >
            <div class="min-w-0 flex flex-1 items-start gap-3">
              <div class="steal-plant-thumb relative h-12 w-12 flex shrink-0 items-center justify-center overflow-hidden rounded-lg p-1 shadow-sm">
                <img
                  v-if="canShowPlantImage(seed)"
                  :src="getPlantImage(seed)"
                  class="z-10 max-h-full max-w-full object-contain drop-shadow-sm"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                  @error="handlePlantImageError(seed, $event)"
                >
                <div class="steal-plant-thumb-icon i-carbon-sprout absolute inset-0 z-0 flex items-center justify-center text-2xl" />
              </div>
              <div class="min-w-0 flex flex-1 flex-col">
                <div class="min-w-0 w-full flex items-center justify-between pr-1">
                  <div class="min-w-0 flex items-center gap-1.5">
                    <span class="glass-text-main truncate text-[15px] font-extrabold" :title="seed.name">
                      {{ seed.name }}
                    </span>
                    <span class="steal-level-pill ui-meta-chip--neutral shrink-0 rounded px-1.5 py-0.5 text-xs font-bold">
                      Lv {{ cropAnalytics[seed.seedId]?.level || seed.requiredLevel }}
                    </span>
                  </div>
                </div>

                <div class="mt-1.5 space-y-1.5">
                  <div class="flex items-center gap-1.5 text-xs">
                    <div class="steal-metric-pill ui-meta-chip--info whitespace-nowrap rounded-sm px-1.5 py-0.5 font-medium">
                      时经: <span class="font-bold">{{ cropAnalytics[seed.seedId]?.expPerHour ?? '-' }}</span>
                    </div>
                    <div class="steal-metric-pill ui-meta-chip--warning whitespace-nowrap rounded-sm px-1.5 py-0.5 font-medium">
                      时润: <span class="font-bold">{{ cropAnalytics[seed.seedId]?.profitPerHour ?? '-' }}</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5 text-[11px] opacity-70">
                    <div class="steal-metric-text-info font-medium">
                      普时经: <span class="font-bold">{{ cropAnalytics[seed.seedId]?.normalFertilizerExpPerHour ?? '-' }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              class="ml-2 mt-1 h-[22px] w-[22px] flex shrink-0 items-center justify-center border rounded transition-colors"
              :class="getPlantCheckClasses(isPlantSelected(seed.seedId))"
            >
              <div v-if="isPlantSelected(seed.seedId)" class="i-carbon-checkmark text-sm" />
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Action -->
      <div class="steal-footer-bar ui-fixed-footer-bar glass-panel flex flex-col items-stretch gap-3 border-t-0 p-4 sm:flex-row sm:items-center sm:justify-end">
        <div class="steal-footer-meta min-w-0 flex items-center justify-between gap-3 sm:mr-auto sm:justify-start">
          <span class="glass-text-muted truncate text-sm font-medium">
            {{ footerSelectionSummary }}
          </span>
          <span class="glass-text-muted hidden text-sm font-medium transition-opacity sm:inline-flex" :class="saving ? 'opacity-100' : 'opacity-0'">
            正在上传修改到服务器...
          </span>
        </div>
        <BaseButton
          variant="primary"
          class="relative shadow-lg shadow-primary-500/30 !px-8 !py-2.5 !font-bold"
          :loading="saving"
          @click="saveAccountSettings"
        >
          <div class="i-carbon-save mr-2 text-lg" /> 保存过滤配置
        </BaseButton>
      </div>
    </template>

    <ConfirmModal
      :show="modalVisible"
      :title="modalConfig.title"
      :message="modalConfig.message"
      :type="modalConfig.type"
      :is-alert="modalConfig.isAlert"
      confirm-text="知道了"
      @confirm="modalVisible = false"
      @cancel="modalVisible = false"
    />
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: var(--ui-scrollbar-thumb);
  border-radius: 3px;
}
.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background-color: var(--ui-scrollbar-thumb-hover);
}

.steal-friend-active {
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--ui-status-success) 30%, transparent);
}

.steal-plant-active {
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--ui-status-info) 30%, transparent);
}

.steal-settings-page {
  color: var(--ui-text-1);
}

.steal-settings-page
  :is(
    [class*='text-'][class*='gray-500'],
    [class*='text-'][class*='gray-400'],
    [class*='dark:text-'][class*='gray-400'],
    .glass-text-muted
  ) {
  color: var(--ui-text-2) !important;
}

.steal-page-header,
.steal-tab-bar {
  border-color: var(--ui-border-subtle) !important;
}

.steal-empty-state {
  color: var(--ui-text-2) !important;
}

.steal-top-card,
.steal-toolbar,
.steal-list-shell,
.steal-toolbar-chip {
  border: 1px solid var(--ui-border-subtle) !important;
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 92%, transparent) !important;
  box-shadow: 0 18px 44px -30px var(--ui-shadow-panel) !important;
}

.steal-controls-panel {
  z-index: 12;
  display: grid;
  gap: 0.75rem;
}

.steal-tab {
  border-color: transparent !important;
}

.steal-tab-active {
  border-color: var(--ui-brand-500) !important;
  color: var(--ui-text-1) !important;
  text-shadow: 0 1px 0 color-mix(in srgb, var(--ui-text-on-brand) 22%, transparent);
}

.steal-tab-idle {
  color: color-mix(in srgb, var(--ui-text-1) 72%, var(--ui-text-3)) !important;
}

.steal-tab-idle:hover {
  color: var(--ui-text-1) !important;
}

.steal-search-icon,
.steal-avatar-fallback,
.steal-plant-thumb-icon {
  color: var(--ui-text-3) !important;
}

.steal-search-input,
.steal-inline-select {
  border: 1px solid var(--ui-border-subtle) !important;
  border-radius: 0.375rem;
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 96%, transparent) !important;
}

.steal-bulk-button {
  border-radius: 999px !important;
  font-weight: 700 !important;
}

.steal-bulk-button-brand {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--ui-brand-500) 90%, white 10%),
    var(--ui-brand-600)
  ) !important;
  color: var(--ui-text-on-brand) !important;
}

.steal-bulk-button-neutral {
  border: 1px solid var(--ui-border-subtle) !important;
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 86%, transparent) !important;
  color: var(--ui-text-1) !important;
}

.steal-bulk-button-danger {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--ui-status-danger) 88%, white 12%),
    color-mix(in srgb, var(--ui-status-danger) 76%, black 24%)
  ) !important;
  color: var(--ui-text-on-brand) !important;
}

.steal-list-card,
.steal-plant-card {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 96%, transparent) !important;
}

.steal-list-card-idle {
  border-color: var(--ui-border-subtle) !important;
}

.steal-list-card-idle:hover {
  border-color: color-mix(in srgb, var(--ui-brand-500) 24%, var(--ui-border-subtle)) !important;
}

.steal-avatar-shell,
.steal-plant-thumb {
  border: 1px solid var(--ui-border-subtle) !important;
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 94%, transparent) !important;
}

.steal-check-indicator,
.steal-check-box {
  border-radius: 999px;
}

.steal-check-indicator-active,
.steal-check-box-active {
  border-color: var(--ui-brand-500) !important;
  background: var(--ui-brand-500) !important;
  color: var(--ui-text-on-brand) !important;
  box-shadow: 0 10px 24px var(--ui-shadow-panel) !important;
}

.steal-check-indicator-idle,
.steal-check-box-idle {
  border: 1px solid var(--ui-border-subtle) !important;
  background: color-mix(in srgb, var(--ui-bg-surface) 72%, transparent) !important;
}

.steal-level-pill,
.steal-metric-pill {
  display: inline-flex;
  align-items: center;
  border-width: 1px;
  border-style: solid;
  line-height: 1;
}

.steal-metric-text-info {
  color: color-mix(in srgb, var(--ui-status-info) 76%, var(--ui-text-1)) !important;
}

.steal-settings-page [class*='border-'][class*='gray-300/'],
.steal-settings-page [class*='border-'][class*='gray-300'],
.steal-settings-page [class*='border-'][class*='white/20'],
.steal-settings-page [class*='dark:border-'][class*='white/10'] {
  border-color: var(--ui-border-subtle) !important;
}

.steal-settings-page [class*='bg-'][class*='black/5'],
.steal-settings-page [class*='bg-'][class*='white/20'],
.steal-settings-page [class*='dark:bg-'][class*='black/20'],
.steal-settings-page [class*='dark:bg-'][class*='white/5'] {
  background-color: color-mix(in srgb, var(--ui-bg-surface) 62%, transparent) !important;
}

.steal-select-option {
  background: var(--ui-bg-surface) !important;
  color: var(--ui-text-1) !important;
}

.steal-toolbar-actions {
  min-width: 0;
}

.steal-footer-bar {
  border-top: 1px solid var(--glass-border);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

@media (max-width: 767px) {
  .steal-footer-bar {
    padding-bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
  }
}
</style>
