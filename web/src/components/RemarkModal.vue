<script setup lang="ts">
import { ref, watch } from 'vue'
import api from '@/api'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import { localizeRuntimeText } from '@/utils/runtime-text'

const props = defineProps<{
  show: boolean
  account?: any
}>()

const emit = defineEmits(['close', 'saved'])

const name = ref('')
const loading = ref(false)
const errorMessage = ref('')

watch(() => props.show, (val) => {
  errorMessage.value = ''
  if (val && props.account) {
    name.value = props.account.name || ''
  }
})

async function save() {
  if (!props.account)
    return
  loading.value = true
  errorMessage.value = ''
  try {
    // 使用 name 字段存储备注
    const payload = {
      ...props.account,
      name: name.value,
    }
    // 确保不发送 nick
    delete payload.nick

    const res = await api.post('/api/accounts', payload)
    if (res.data.ok) {
      emit('saved')
      emit('close')
    }
    else {
      errorMessage.value = `保存失败: ${localizeRuntimeText(res.data.error || '未知错误')}`
    }
  }
  catch (e: any) {
    errorMessage.value = `保存失败: ${localizeRuntimeText(e.response?.data?.error || e.message || '未知错误')}`
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div v-if="show" class="remark-modal-backdrop fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm" @click="$emit('close')">
    <div class="remark-modal-panel glass-panel max-w-sm w-full overflow-hidden rounded-lg shadow-xl" @click.stop>
      <div class="remark-modal-header flex items-center justify-between p-4">
        <h3 class="glass-text-main text-lg font-semibold">
          修改备注
        </h3>
        <BaseButton variant="ghost" class="!p-1" @click="$emit('close')">
          <div class="i-carbon-close text-xl" />
        </BaseButton>
      </div>

      <div class="p-4 space-y-4">
        <div v-if="errorMessage" class="remark-modal-error rounded p-3 text-sm">
          {{ errorMessage }}
        </div>
        <BaseInput
          v-model="name"
          label="备注名称"
          placeholder="请输入备注名称"
          @keyup.enter="save"
        />

        <div class="flex justify-end gap-2">
          <BaseButton
            variant="outline"
            @click="$emit('close')"
          >
            取消
          </BaseButton>
          <BaseButton
            variant="primary"
            :loading="loading"
            @click="save"
          >
            保存
          </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.remark-modal-backdrop {
  background: var(--ui-overlay-backdrop) !important;
}

.remark-modal-panel,
.remark-modal-header,
.remark-modal-error {
  border: 1px solid var(--ui-border-subtle) !important;
}

.remark-modal-header {
  border-left: none !important;
  border-right: none !important;
  border-top: none !important;
}

.remark-modal-error {
  background: color-mix(in srgb, var(--ui-status-danger) 8%, var(--ui-bg-surface)) !important;
  color: color-mix(in srgb, var(--ui-status-danger) 78%, var(--ui-text-1)) !important;
}
</style>
