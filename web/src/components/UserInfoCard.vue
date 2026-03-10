<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import api from '@/api'
import ConfirmModal from '@/components/ConfirmModal.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import { useAppStore } from '@/stores/app'
import { useSettingStore } from '@/stores/setting'
import { clearAuth } from '@/utils/auth'
import { localizeRuntimeText } from '@/utils/runtime-text'

const currentUser = ref<any>(null)
const appStore = useAppStore()
const settingStore = useSettingStore()

const THEME_ICON_CLASS = {
  light: 'i-carbon-sun',
  dark: 'i-carbon-moon',
  auto: 'i-carbon-brightness-contrast',
} as const

// 从 localStorage 加载用户信息
function loadCurrentUser() {
  try {
    const userStr = localStorage.getItem('current_user')
    if (userStr) {
      currentUser.value = JSON.parse(userStr)
    }
  }
  catch {
    currentUser.value = null
  }
}

// 安全地保存用户信息
function saveCurrentUser(user: any) {
  if (user) {
    currentUser.value = user
    localStorage.setItem('current_user', JSON.stringify(user))
  }
  else {
    currentUser.value = null
    localStorage.removeItem('current_user')
  }
}

onMounted(() => {
  loadCurrentUser()
  settingStore.fetchTrialCardConfig()
})

const showRenewModal = ref(false)
const showPasswordModal = ref(false)
const renewCardCode = ref('')
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const renewLoading = ref(false)
const passwordLoading = ref(false)
const renewError = ref('')
const passwordError = ref('')

// 格式化卡密类型（带颜色标签）
const cardTypeDetail = computed(() => {
  if (!currentUser.value?.card)
    return { label: '无卡密', color: 'gray' }

  const typeMap: Record<string, { label: string, color: string }> = {
    D: { label: '天卡', color: 'blue' },
    W: { label: '周卡', color: 'green' },
    M: { label: '月卡', color: 'purple' },
    F: { label: '永久卡', color: 'amber' },
    T: { label: '体验卡', color: 'orange' },
  }

  return typeMap[currentUser.value.card.type] || { label: '未知', color: 'gray' }
})

// 格式化到期时间
const expiryDate = computed(() => {
  if (!currentUser.value?.card?.expiresAt)
    return '永久'
  if (currentUser.value.card.type === 'F')
    return '永久'
  const date = new Date(currentUser.value.card.expiresAt)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
})

// 计算剩余时间
const remainingTime = computed(() => {
  if (!currentUser.value?.card?.expiresAt)
    return '永久有效'
  if (currentUser.value.card.type === 'F')
    return '永久有效'

  const now = Date.now()
  const expires = currentUser.value.card.expiresAt
  const diff = expires - now

  if (diff <= 0)
    return '已过期'

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

  if (days > 0) {
    return `剩余${days}天${hours}小时`
  }
  else if (hours > 0) {
    return `剩余${hours}小时`
  }
  else {
    return '即将过期'
  }
})

// 用户状态
const userStatus = computed(() => {
  if (!currentUser.value?.card)
    return { label: '正常', class: 'user-info-status user-info-status-brand' }
  if (currentUser.value.card.enabled === false) {
    return { label: '已封禁', class: 'user-info-status user-info-status-danger' }
  }
  if (currentUser.value.card.expiresAt && currentUser.value.card.expiresAt < Date.now()) {
    return { label: '已过期', class: 'user-info-status user-info-status-warning' }
  }
  return { label: '正常', class: 'user-info-status user-info-status-brand' }
})

// 到期预警
const expiryWarning = computed(() => {
  if (!currentUser.value?.card?.expiresAt)
    return null
  if (currentUser.value.card.type === 'F')
    return null

  const now = Date.now()
  const expires = currentUser.value.card.expiresAt
  const diff = expires - now

  if (diff <= 0) {
    return { message: '您的账号已过期，请尽快续费', class: 'user-info-warning-danger' }
  }
  else if (diff < 3 * 24 * 60 * 60 * 1000) {
    return { message: '您的账号即将过期，请及时续费', class: 'user-info-warning-warning' }
  }
  else if (diff < 7 * 24 * 60 * 60 * 1000) {
    return { message: '您的账号将在7天内到期', class: 'user-info-warning-warning' }
  }
  return null
})

const iconClass = computed(() => {
  return THEME_ICON_CLASS[appStore.themeMode] || THEME_ICON_CLASS.dark
})

const modeLabel = computed(() => {
  switch (appStore.themeMode) {
    case 'light': return '浅色'
    case 'dark': return '深色'
    case 'auto': return '自动'
    default: return '主题'
  }
})

const tooltip = computed(() => {
  switch (appStore.themeMode) {
    case 'light': return '当前：浅色模式（点击切换到深色）'
    case 'dark': return '当前：深色模式（点击切换到自动）'
    case 'auto': return '当前：自动模式（点击切换到浅色）'
    default: return '切换主题'
  }
})

async function handleLogout() {
  await clearAuth()
  window.location.href = '/login'
}

// ============ 体验卡一键自助续费 ============
const trialRenewing = ref(false)

// 是否显示一键续费按钮
const showTrialRenew = computed(() => {
  if (!currentUser.value?.card)
    return false
  if (currentUser.value.card.type !== 'T')
    return false
  if (!settingStore.settings.trialConfig.userRenewEnabled)
    return false
  // 已过期 或 剩余≤24小时
  const expires = currentUser.value.card.expiresAt
  if (!expires)
    return false
  const diff = expires - Date.now()
  return diff <= 24 * 60 * 60 * 1000
})

// 已整合至 Pinia Store

async function handleTrialSelfRenew() {
  trialRenewing.value = true
  try {
    const res = await api.post('/api/auth/trial-renew')
    if (res.data.ok) {
      const user = { ...currentUser.value, card: res.data.data.card }
      saveCurrentUser(user)
    }
    else {
      console.warn(localizeRuntimeText(res.data.error || '续费失败'))
    }
  }
  catch (e: any) {
    console.warn(localizeRuntimeText(e.response?.data?.error || e.message || '续费异常'))
  }
  finally {
    trialRenewing.value = false
  }
}

async function handleRenew() {
  renewLoading.value = true
  renewError.value = ''
  try {
    const res = await api.post('/api/auth/renew', { cardCode: renewCardCode.value })
    if (res.data.ok) {
      // 更新本地用户信息中的卡密
      const user = { ...currentUser.value, card: res.data.data.card }
      saveCurrentUser(user)
      showRenewModal.value = false
      renewCardCode.value = ''
    }
    else {
      renewError.value = localizeRuntimeText(res.data.error || '续费失败')
    }
  }
  catch (e: any) {
    renewError.value = localizeRuntimeText(e.response?.data?.error || e.message || '续费异常')
  }
  finally {
    renewLoading.value = false
  }
}

async function handleChangePassword() {
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = '两次输入的新密码不一致'
    return
  }

  if (newPassword.value.length < 6) {
    passwordError.value = '新密码长度至少为 6 位'
    return
  }

  if (!/[a-z]/i.test(newPassword.value) || !/\d/.test(newPassword.value)) {
    passwordError.value = '密码须同时包含字母和数字'
    return
  }

  passwordLoading.value = true
  passwordError.value = ''
  try {
    // 不需要传 username，后端从 token 中获取
    const res = await api.post('/api/auth/change-password', {
      oldPassword: oldPassword.value,
      newPassword: newPassword.value,
    })

    if (res.data.ok) {
      showPasswordModal.value = false
      oldPassword.value = ''
      newPassword.value = ''
      confirmPassword.value = ''
      // 显示成功提示
      console.warn('密码修改成功！')
    }
    else {
      passwordError.value = localizeRuntimeText(res.data.error || '修改失败')
    }
  }
  catch (e: any) {
    passwordError.value = localizeRuntimeText(e.response?.data?.error || e.message || '修改失败')
  }
  finally {
    passwordLoading.value = false
  }
}
</script>

<template>
  <div v-if="currentUser" class="user-info-card glass-panel overflow-hidden rounded-xl shadow-md">
    <!-- 卡片头部及详情合并 -->
    <div class="user-info-card-header px-4 py-3 backdrop-blur-sm sm:px-6 sm:py-4">
      <div class="flex flex-col items-start justify-between gap-4 xl:flex-row xl:items-center">
        <!-- 第1部分：头像和用户名 -->
        <div class="flex shrink-0 items-center gap-3">
          <div class="user-info-avatar h-10 w-10 flex items-center justify-center rounded-full">
            <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
          <div>
            <h3 class="user-info-title text-base font-semibold leading-tight">
              {{ currentUser.username }}
            </h3>
            <div class="mt-1 flex items-center gap-2">
              <span class="rounded-full px-1.5 py-0.5 text-[10px] leading-none" :class="userStatus.class">
                {{ userStatus.label }}
              </span>
              <span class="user-info-role text-[10px] leading-none">
                {{ currentUser.role === 'admin' ? '管理员' : '普通用户' }}
              </span>
            </div>
          </div>
        </div>

        <!-- 第2部分：卡密详情 -->
        <div class="user-info-meta flex flex-1 flex-wrap items-center gap-x-6 gap-y-2 text-sm xl:justify-center">
          <div class="flex items-center gap-1.5">
            <span class="user-info-meta-label">卡密:</span>
            <span class="user-info-meta-value font-medium">{{ cardTypeDetail.label }}</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="user-info-meta-label">到期:</span>
            <span class="user-info-meta-value font-medium">{{ expiryDate }}</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="user-info-meta-label">剩余:</span>
            <span class="font-medium" :class="remainingTime.includes('过期') || remainingTime.includes('即将') ? 'user-info-meta-value-danger' : 'user-info-meta-value-brand'">
              {{ remainingTime }}
            </span>
          </div>
        </div>

        <!-- 第3部分：按钮组 -->
        <div class="flex shrink-0 items-center gap-2">
          <button class="user-info-action flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors" @click="showRenewModal = true">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            续费
          </button>
          <button class="user-info-action flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors" @click="showPasswordModal = true">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            改密
          </button>
          <!-- 主题切换按钮 -->
          <button
            :title="tooltip"
            class="user-info-action flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
            @click="appStore.toggleDark()"
          >
            <div class="h-4 w-4" :class="[iconClass]" />
            <span>{{ modeLabel }}</span>
          </button>
          <div class="user-info-divider mx-1 h-6 w-px" />
          <button class="user-info-action-icon rounded-lg p-1.5 transition-colors" title="退出登录" @click="handleLogout">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>

      <!-- 到期预警提示 -->
      <div v-if="expiryWarning" class="user-info-warning mt-3 flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-medium sm:text-sm" :class="expiryWarning.class">
        <div class="flex items-center gap-2">
          <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
          </svg>
          <span>{{ expiryWarning.message }}</span>
        </div>
        <button
          v-if="showTrialRenew"
          :disabled="trialRenewing"
          class="user-info-warning-action shrink-0 rounded-md px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50"
          @click="handleTrialSelfRenew"
        >
          {{ trialRenewing ? '续费中...' : '🔄 一键续费' }}
        </button>
      </div>
    </div>
  </div>

  <!-- 续费弹窗 -->
  <ConfirmModal
    v-model:show="showRenewModal"
    title="账号续费"
    confirm-text="确认续费"
    cancel-text="取消"
    :show-cancel="true"
    @confirm="handleRenew"
    @cancel="showRenewModal = false"
  >
    <div class="space-y-4">
      <BaseInput
        v-model="renewCardCode"
        type="text"
        label="卡密"
        placeholder="请输入卡密"
        required
      >
        <template #prefix>
          <svg class="glass-text-muted h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </template>
      </BaseInput>
      <div v-if="renewError" class="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
        <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        {{ renewError }}
      </div>
    </div>
  </ConfirmModal>

  <!-- 修改密码弹窗 -->
  <ConfirmModal
    v-model:show="showPasswordModal"
    title="修改密码"
    confirm-text="确认修改"
    cancel-text="取消"
    :show-cancel="true"
    @confirm="handleChangePassword"
    @cancel="showPasswordModal = false"
  >
    <div class="space-y-4">
      <BaseInput
        v-model="oldPassword"
        type="password"
        label="旧密码"
        autocomplete="current-password"
        placeholder="请输入旧密码"
        required
      />
      <BaseInput
        v-model="newPassword"
        type="password"
        label="新密码"
        autocomplete="new-password"
        placeholder="请输入新密码"
        required
      />
      <BaseInput
        v-model="confirmPassword"
        type="password"
        label="确认新密码"
        autocomplete="new-password"
        placeholder="请再次输入新密码"
        required
      />
      <div v-if="passwordError" class="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
        <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        {{ passwordError }}
      </div>
    </div>
  </ConfirmModal>
</template>

<style scoped>
.user-info-card {
  border: 1px solid color-mix(in srgb, var(--ui-text-on-brand) 18%, var(--ui-border-subtle));
  color: var(--ui-text-1);
}

.user-info-card-header {
  background: linear-gradient(
    120deg,
    color-mix(in srgb, var(--ui-brand-600) 78%, rgba(15, 23, 42, 0.2)) 0%,
    color-mix(in srgb, var(--ui-brand-800) 72%, rgba(30, 41, 59, 0.28)) 100%
  );
}

.user-info-avatar,
.user-info-action,
.user-info-action-icon,
.user-info-warning,
.user-info-warning-action {
  border: 1px solid color-mix(in srgb, var(--ui-text-on-brand) 22%, transparent);
  background: color-mix(in srgb, var(--ui-text-on-brand) 14%, transparent);
  color: color-mix(in srgb, var(--ui-text-on-brand) 94%, var(--ui-text-1) 6%);
}

.user-info-title,
.user-info-meta-value,
.user-info-action,
.user-info-action-icon {
  color: color-mix(in srgb, var(--ui-text-on-brand) 96%, var(--ui-text-1) 4%);
}

.user-info-role,
.user-info-meta,
.user-info-meta-label {
  color: color-mix(in srgb, var(--ui-text-on-brand) 84%, var(--ui-text-2) 16%);
}

.user-info-meta-value-brand {
  color: color-mix(in srgb, var(--ui-brand-200) 88%, white 12%);
}

.user-info-meta-value-danger {
  color: color-mix(in srgb, var(--ui-status-danger-soft) 66%, white 34%);
}

.user-info-action:hover,
.user-info-action-icon:hover,
.user-info-warning-action:hover {
  background: color-mix(in srgb, var(--ui-text-on-brand) 22%, transparent);
}

.user-info-divider {
  background: color-mix(in srgb, var(--ui-text-on-brand) 24%, transparent);
}

.user-info-status {
  display: inline-flex;
  align-items: center;
  border: 1px solid transparent;
  border-radius: 999px;
}

.user-info-status-brand {
  background: color-mix(in srgb, var(--ui-brand-100) 84%, transparent);
  color: var(--ui-brand-800);
}

.user-info-status-danger {
  background: color-mix(in srgb, var(--ui-status-danger-soft) 82%, transparent);
  color: var(--ui-status-danger);
}

.user-info-status-warning {
  background: color-mix(in srgb, var(--ui-status-warning-soft) 84%, transparent);
  color: var(--ui-status-warning);
}

.user-info-warning {
  color: color-mix(in srgb, var(--ui-text-on-brand) 94%, var(--ui-text-1) 6%);
}

.user-info-warning-danger {
  border-color: color-mix(in srgb, var(--ui-status-danger) 26%, rgba(255, 255, 255, 0.18));
  background: color-mix(in srgb, var(--ui-status-danger) 16%, rgba(255, 255, 255, 0.14));
}

.user-info-warning-warning {
  border-color: color-mix(in srgb, var(--ui-status-warning) 26%, rgba(255, 255, 255, 0.18));
  background: color-mix(in srgb, var(--ui-status-warning) 16%, rgba(255, 255, 255, 0.14));
}

.user-info-warning-action {
  color: color-mix(in srgb, var(--ui-text-on-brand) 98%, white 2%);
}

.user-info-card :is(.text-red-600, .dark\:text-red-400) {
  color: var(--ui-status-danger);
}
</style>
