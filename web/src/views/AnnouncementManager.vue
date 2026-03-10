<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import api from '@/api'
import ConfirmModal from '@/components/ConfirmModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import { localizeRuntimeText } from '@/utils/runtime-text'

// 权限控制
const isAdmin = computed(() => {
  try {
    const u = JSON.parse(localStorage.getItem('current_user') || 'null')
    return u?.role === 'admin'
  }
  catch { return false }
})

interface Announcement {
  id?: number
  title: string
  content: string
  version: string
  publish_date: string
  enabled: boolean
  createdAt?: string
  updatedAt?: string
}

const announcements = ref<Announcement[]>([])
const loading = ref(false)
const syncing = ref(false)

// 当前编辑对象
const currentEdit = ref<Announcement | null>(null)

const modalVisible = ref(false)
const modalConfig = ref({
  title: '',
  message: '',
  type: 'primary' as 'primary' | 'danger',
  isAlert: true,
})
const pendingAction = ref<(() => void) | null>(null)

function showAlert(message: string, type: 'primary' | 'danger' = 'primary') {
  pendingAction.value = null
  modalConfig.value = {
    title: type === 'danger' ? '错误' : '提示',
    message,
    type,
    isAlert: true,
  }
  modalVisible.value = true
}

function showConfirm(message: string, onConfirm: () => void, type: 'primary' | 'danger' = 'danger') {
  pendingAction.value = onConfirm
  modalConfig.value = {
    title: '确认操作',
    message,
    type,
    isAlert: false,
  }
  modalVisible.value = true
}

function handleModalConfirm() {
  modalVisible.value = false
  if (pendingAction.value) {
    pendingAction.value()
    pendingAction.value = null
  }
}

function handleModalCancel() {
  modalVisible.value = false
  pendingAction.value = null
}

async function loadAnnouncements() {
  if (!isAdmin.value)
    return
  loading.value = true
  try {
    const res = await api.get('/api/announcement')
    if (res.data.ok && Array.isArray(res.data.data)) {
      announcements.value = res.data.data
    }
  }
  catch { /* 静默 */ }
  finally {
    loading.value = false
  }
}

function openCreateForm() {
  currentEdit.value = {
    title: '',
    content: '',
    version: '',
    publish_date: new Date().toISOString().slice(0, 10),
    enabled: true,
  }
}

function openEditForm(item: Announcement) {
  currentEdit.value = { ...item }
}

function cancelEdit() {
  currentEdit.value = null
}

async function saveAnnouncement() {
  if (!currentEdit.value)
    return
  loading.value = true
  try {
    const res = await api.put('/api/announcement', currentEdit.value)
    if (res.data.ok) {
      showAlert('保存成功！用户端下次刷新时将看到最新状态。')
      currentEdit.value = null
      await loadAnnouncements()
    }
    else {
      showAlert(`保存失败: ${localizeRuntimeText(res.data.error || '未知错误')}`, 'danger')
    }
  }
  catch (e: any) {
    showAlert(`保存失败: ${localizeRuntimeText(e.message || '未知错误')}`, 'danger')
  }
  finally {
    loading.value = false
  }
}

function deleteAnnouncement(id: number) {
  showConfirm('确定要彻底删除此公告吗？操作不可恢复。', async () => {
    loading.value = true
    try {
      const res = await api.delete(`/api/announcement?id=${id}`)
      if (res.data.ok) {
        showAlert('公告已删除')
        await loadAnnouncements()
      }
      else {
        showAlert(`删除失败: ${localizeRuntimeText(res.data.error || '未知错误')}`, 'danger')
      }
    }
    catch (e: any) {
      showAlert(`删除失败: ${localizeRuntimeText(e.message || '未知错误')}`, 'danger')
    }
    finally {
      loading.value = false
    }
  })
}

function syncFromLog() {
  showConfirm('是否从系统后端的 Update.log 解析并导入缺失的内容作为公告？', async () => {
    syncing.value = true
    try {
      const res = await api.post('/api/announcement/sync')
      if (res.data.ok) {
        showAlert(`同步成功！在 Update.log 共发现 ${res.data.totalParsed} 条系统日志，实际新增插入了 ${res.data.added} 条（已去重）。`)
        await loadAnnouncements()
      }
      else {
        showAlert(`同步失败: ${localizeRuntimeText(res.data.error || '未知错误')}`, 'danger')
      }
    }
    catch (e: any) {
      showAlert(`同步操作失败: ${localizeRuntimeText(e.message || '未知错误')}`, 'danger')
    }
    finally {
      syncing.value = false
    }
  }, 'primary')
}

onMounted(() => {
  loadAnnouncements()
})
</script>

<template>
  <div class="announcement-manager-page ui-page-shell ui-page-stack ui-page-density-relaxed relative min-h-full w-full pb-28">
    <div class="announcement-manager-header ui-page-header pb-4">
      <div class="ui-page-header__main">
        <h1 class="ui-page-title glass-text-main flex items-center gap-2">
          <span class="announcement-header-icon font-normal"><div class="i-carbon-notification" /></span>
          系统公告管理
        </h1>
        <p class="ui-page-desc">
          管理系统展示的多个历史版本公告，并允许与物理 Update.log 日志联动。
        </p>
      </div>
      <div v-if="isAdmin && !currentEdit" class="announcement-manager-actions ui-mobile-sticky-panel">
        <div class="ui-page-actions ui-bulk-actions">
          <BaseButton variant="outline" :loading="syncing" @click="syncFromLog">
            <div class="i-carbon-repo-source-code mr-1.5" />
            同步 Update.log
          </BaseButton>
          <BaseButton variant="primary" @click="openCreateForm">
            <div class="i-carbon-add mr-1.5" />
            编写新公告
          </BaseButton>
        </div>
      </div>
    </div>

    <div v-if="!isAdmin" class="announcement-empty-state flex flex-1 flex-col items-center justify-center py-20">
      <div class="i-carbon-locked mb-4 text-4xl" />
      <p>仅超级管理员可访问该页面</p>
    </div>

    <!-- 编辑表单区块 -->
    <div v-else-if="currentEdit" class="w-full space-y-6">
      <div class="card glass-panel flex flex-col rounded-lg shadow">
        <div class="announcement-panel-divider px-4 py-3">
          <h3 class="glass-text-main flex items-center gap-2 text-base font-bold">
            <div class="i-carbon-edit" />
            {{ currentEdit.id ? '编辑历史公告' : '编写全新发布' }}
          </h3>
        </div>

        <div class="p-6 space-y-5">
          <div class="flex items-center gap-3">
            <span class="glass-text-main text-sm font-medium">通告展示开关</span>
            <BaseSwitch v-model="currentEdit.enabled" hint="开启时将在客户端可见，关闭可作草稿" />
          </div>

          <BaseInput
            v-model="currentEdit.title"
            label="主标题"
            placeholder="例如：农场机器人架构底座升级"
          />

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <BaseInput
              v-model="currentEdit.version"
              label="版本徽章标识（可选）"
              placeholder="如：v4.3.0"
            />
            <BaseInput
              v-model="currentEdit.publish_date"
              label="发版日志日期（可选）"
              placeholder="如：2026-03-07"
            />
          </div>

          <div>
            <label class="glass-text-main mb-1.5 block text-sm font-medium">公告内容详情 <span class="glass-text-muted text-xs font-normal">（支持直接排版与换行）</span></label>
            <textarea
              v-model="currentEdit.content"
              class="announcement-editor w-full px-4 py-3 text-sm"
              rows="8"
              placeholder="记录您为程序修复和带来的改进细节..."
            />
          </div>

          <!-- Preview Area -->
          <div v-if="currentEdit.title || currentEdit.content" class="announcement-preview-shell mt-4 rounded-xl p-5 shadow-sm">
            <div class="mb-3 flex items-center gap-2">
              <div class="announcement-header-icon i-carbon-view" />
              <p class="announcement-preview-heading text-xs font-bold tracking-wider uppercase">
                前端视距回显
              </p>
            </div>
            <div class="announcement-preview-card rounded-lg p-4 shadow-sm">
              <p class="announcement-preview-title text-center text-lg font-bold">
                {{ currentEdit.title || '（未输入主标题）' }}
              </p>
              <div class="mt-3 flex items-center justify-center gap-2 text-xs">
                <span v-if="currentEdit.version" class="announcement-preview-badge rounded-full px-2 py-0.5">{{ currentEdit.version }}</span>
                <span v-if="currentEdit.publish_date" class="announcement-preview-date">{{ currentEdit.publish_date }}</span>
              </div>
              <div class="announcement-preview-content mt-4 whitespace-pre-wrap text-sm leading-relaxed">
                {{ currentEdit.content || '（暂无详情文本输入，仅骨架）' }}
              </div>
            </div>
          </div>
        </div>

        <div class="announcement-panel-footer announcement-editor-actions ui-mobile-action-panel mt-auto flex flex-wrap justify-end gap-3 px-6 py-4">
          <BaseButton
            variant="secondary"
            :loading="loading"
            class="!px-6"
            @click="cancelEdit"
          >
            取消修改返回
          </BaseButton>
          <BaseButton
            variant="primary"
            :loading="loading"
            class="shadow-blue-500/20 shadow-md !px-8"
            @click="saveAnnouncement"
          >
            <div class="i-carbon-send-alt mr-1.5" /> 确认保存发布
          </BaseButton>
        </div>
      </div>
    </div>

    <!-- 列表展示区块 -->
    <div v-else class="w-full">
      <div v-if="loading" class="flex items-center justify-center p-12">
        <div class="announcement-empty-state i-carbon-circle-dash h-8 w-8 animate-spin" />
      </div>
      <div v-else-if="announcements.length === 0" class="announcement-empty-state card glass-panel flex flex-col items-center justify-center py-20">
        <div class="announcement-empty-icon i-carbon-catalog mb-3 text-4xl" />
        <p>目前没有已发布的记录或可查看的历史版本，试着从日志同步一下？</p>
      </div>
      <div v-else class="announcement-list ui-mobile-record-list">
        <article
          v-for="item in announcements"
          :key="item.id"
          class="announcement-record card glass-panel ui-mobile-record-card transition-shadow hover:shadow-md"
          :class="item.enabled ? '' : 'opacity-60 grayscale-[30%]'"
        >
          <div class="announcement-record-main">
            <div class="ui-mobile-record-head">
              <div class="ui-mobile-record-body">
                <div class="ui-mobile-record-badges">
                  <span v-if="item.version" class="announcement-preview-badge rounded px-2 py-0.5 text-xs">{{ item.version }}</span>
                  <span class="announcement-item-status rounded px-2 py-0.5 text-xs">
                    {{ item.enabled ? '已启用' : '已禁用 / 草稿' }}
                  </span>
                </div>
                <h3 class="announcement-item-title ui-mobile-record-title">
                  {{ item.title || '（无题）' }}
                </h3>
                <p class="announcement-item-date ui-mobile-record-subtitle font-mono">
                  {{ item.publish_date || item.createdAt || '未知追踪时间' }}
                </p>
              </div>
            </div>

            <div class="ui-mobile-record-grid announcement-record-grid">
              <div class="ui-mobile-record-field">
                <div class="ui-mobile-record-label">
                  展示状态
                </div>
                <div class="ui-mobile-record-value">
                  {{ item.enabled ? '客户端可见' : '草稿 / 暂停展示' }}
                </div>
              </div>

              <div class="ui-mobile-record-field">
                <div class="ui-mobile-record-label">
                  最近更新时间
                </div>
                <div class="ui-mobile-record-value ui-mobile-record-value--muted">
                  {{ item.updatedAt || '未记录' }}
                </div>
              </div>

              <div class="ui-mobile-record-field ui-mobile-record-field--full">
                <div class="ui-mobile-record-label">
                  内容预览
                </div>
                <div class="announcement-item-content ui-mobile-record-value ui-mobile-record-value--muted line-clamp-3 break-words">
                  {{ item.content || '暂无内容' }}
                </div>
              </div>
            </div>
          </div>

          <div class="announcement-record-actions ui-mobile-record-actions ui-bulk-actions">
            <BaseButton variant="outline" class="text-sm !px-3 !py-1" @click="openEditForm(item)">
              <div class="i-carbon-edit mr-1" /> 编辑
            </BaseButton>
            <BaseButton variant="outline" class="announcement-delete-button text-sm !px-3 !py-1" @click="deleteAnnouncement(item.id!)">
              <div class="i-carbon-trash-can" />
            </BaseButton>
          </div>
        </article>
      </div>
    </div>

    <!-- 弹窗回馈 -->
    <ConfirmModal
      :show="modalVisible"
      :title="modalConfig.title"
      :message="modalConfig.message"
      :type="modalConfig.type"
      :is-alert="modalConfig.isAlert"
      :confirm-text="modalConfig.isAlert ? '知道了' : '确定'"
      @confirm="handleModalConfirm"
      @cancel="handleModalCancel"
    />
  </div>
</template>

<style scoped>
.announcement-manager-page {
  color: var(--ui-text-1);
}

.announcement-manager-header,
.announcement-panel-divider,
.announcement-panel-footer {
  border-color: var(--ui-border-subtle);
}

.announcement-manager-header {
  border-bottom: 1px solid var(--ui-border-subtle);
}

.announcement-manager-actions {
  z-index: 12;
}

.announcement-panel-divider {
  border-bottom: 1px solid var(--ui-border-subtle);
}

.announcement-panel-footer {
  border-top: 1px solid var(--ui-border-subtle);
  background: color-mix(in srgb, var(--ui-bg-surface) 72%, transparent);
}

.announcement-header-icon,
.announcement-preview-heading {
  color: var(--ui-status-info);
}

.announcement-empty-state,
.announcement-item-date,
.announcement-item-content {
  color: var(--ui-text-2);
}

.announcement-empty-icon {
  color: color-mix(in srgb, var(--ui-text-2) 48%, transparent);
}

.announcement-editor {
  border: 1px solid var(--ui-border-strong);
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 90%, transparent);
  color: var(--ui-text-1);
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    background-color 160ms ease;
}

.announcement-editor::placeholder {
  color: var(--ui-text-2);
}

.announcement-editor:focus-visible {
  outline: none;
  border-color: var(--ui-border-strong);
  box-shadow: 0 0 0 2px var(--ui-focus-ring);
}

.announcement-preview-shell {
  border: 1px solid color-mix(in srgb, var(--ui-status-info) 22%, var(--ui-border-subtle));
  background: color-mix(in srgb, var(--ui-status-info-soft) 72%, var(--ui-bg-surface-raised));
}

.announcement-preview-card {
  border: 1px solid var(--ui-border-subtle);
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 92%, transparent);
}

.announcement-preview-title,
.announcement-item-title {
  color: var(--ui-text-1);
}

.announcement-item-title {
  margin-top: 0;
}

.announcement-preview-badge {
  background: color-mix(in srgb, var(--ui-status-info) 12%, transparent);
  color: var(--ui-status-info);
}

.announcement-preview-date {
  color: var(--ui-text-2);
}

.announcement-preview-content {
  color: var(--ui-text-2);
}

.announcement-item-status {
  background: color-mix(in srgb, var(--ui-bg-surface) 88%, transparent);
  color: var(--ui-text-2);
}

.announcement-list {
  gap: 1rem;
}

.announcement-record {
  gap: 1rem;
}

.announcement-record-main {
  min-width: 0;
  flex: 1 1 auto;
}

.announcement-record-grid {
  margin-top: 0.25rem;
}

.announcement-record-actions {
  align-items: center;
}

.announcement-delete-button {
  border-color: color-mix(in srgb, var(--ui-status-danger) 22%, var(--ui-border-subtle));
  color: var(--ui-status-danger);
}

.announcement-delete-button:hover {
  background: color-mix(in srgb, var(--ui-status-danger) 10%, transparent);
}

@media (max-width: 767px) {
  .announcement-editor-actions {
    position: sticky;
    bottom: 0;
    z-index: 14;
    padding-bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
  }
}

@media (min-width: 768px) {
  .announcement-record {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .announcement-record-actions {
    justify-content: flex-end;
  }
}
</style>
