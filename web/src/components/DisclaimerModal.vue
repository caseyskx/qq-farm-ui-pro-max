<script setup lang="ts">
defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'agree'): void
  (e: 'decline'): void
}>()

const disclaimerHtml = `
欢迎使用御农·QQ农场智能助手（以下简称“本软件”）。在您开始使用本软件之前，请务必仔细阅读并理解以下全部内容。您点击“同意”、继续安装或使用本软件的行为，即视为您完全知情并自愿接受本声明的全部约束。如果您不同意本声明的任何条款，请立即拒绝并彻底删除本软件。

<b>1. 仅供学习与研究用途</b>
本软件仅作为个人编程学习、技术研究、自动化测试交流之用。开发者不鼓励、不支持将其用于任何破坏游戏公平性的日常游玩中。请在下载试用后24小时内自行删除，严禁将本软件用于任何商业用途或非法盈利。

<b>2. 账号风险与免责（重要）</b>
腾讯公司官方服务条款严格禁止使用任何第三方辅助工具、外挂或破坏游戏平衡的软件。<b>使用本软件操作“QQ农场”可能面临包括但不限于：警告、农场作物被清空、金币/经验扣除、甚至QQ账号被永久封禁的风险。</b>
用户须自行承担使用本软件带来的所有风险及后果。对于因使用本软件造成的任何账号降权、封禁、虚拟财产损失或数据异常，本软件开发者概不负责，也不承担任何直接或间接的赔偿责任。

<b>3. 版权及知识产权声明</b>
“QQ”、“QQ农场”及相关游戏的商标、美术素材、版权、知识产权均归属于深圳市腾讯计算机系统有限公司所有。本软件为独立的第三方交流工具，与腾讯公司无任何官方关联、赞助或授权关系。本软件不对游戏本体代码进行破解或恶意篡改，仅模拟常规操作。

<b>4. 软件“现状”提供（无担保）</b>
本软件按“现状”提供，开发者不提供任何形式的明示或暗示担保。受限于网络环境、游戏官方的更新维护、不可抗力及软件自身可能存在的Bug，开发者不保证本软件的绝对稳定、安全、无错或持续可用。因游戏官方更新导致本软件失效，开发者没有义务必须提供后续更新服务。

<b>5. 用户行为规范</b>
用户承诺在使用本软件时遵守国家相关法律法规。严禁利用本软件进行任何违法犯罪活动，严禁将本软件进行反向工程、恶意修改、植入木马病毒或进行二次打包售卖。如因用户的非法使用行为引发的法律纠纷，由用户单方承担全部法律责任。

<b>6. 声明修改权</b>
开发者保留随时修改本免责声明的权利。修改后的条款一旦公布即刻生效，若您继续使用本软件，则视为接受修改后的声明。

<b>我已仔细阅读并完全理解以上内容，自愿承担使用本软件产生的所有风险。</b>
`
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden px-4">
      <!-- Apple风格超强高斯模糊背景遮罩 -->
      <div
        class="disclaimer-overlay absolute inset-0 transition-opacity"
        @click.stop
      />

      <!-- 弹窗本体 (仿苹果空间悬浮感) -->
      <div
        class="disclaimer-shell relative max-h-[90vh] max-w-2xl w-full flex flex-col transform overflow-hidden border rounded-3xl shadow-2xl backdrop-blur-2xl transition-all"
        @click.stop
      >
        <!-- 头部标题 -->
        <div class="disclaimer-header shrink-0 px-6 pb-4 pt-6 text-center">
          <div class="disclaimer-badge-shell mx-auto mb-3 h-12 w-12 flex items-center justify-center rounded-xl shadow-lg">
            <div class="disclaimer-warning-icon i-carbon-warning-alt text-2xl drop-shadow-md" />
          </div>
          <h3 class="glass-text-main text-xl font-bold tracking-tight">
            软件使用免责声明与条款
          </h3>
          <p class="glass-text-muted mt-1.5 text-xs font-medium">
            请仔细阅读并同意以下条款以继续使用
          </p>
        </div>

        <!-- 可滚动内容区 -->
        <div class="custom-scrollbar flex-1 overflow-y-auto overscroll-contain px-6 py-4">
          <div class="disclaimer-prose prose prose-sm max-w-none text-[14px] leading-relaxed space-y-3">
            <template v-for="(paragraph, index) in disclaimerHtml.split('\n\n')" :key="index">
              <p v-if="paragraph.trim()" class="apple-text mb-4 text-justify" v-html="paragraph.replace(/\n/g, '<br/>')" />
            </template>
          </div>
        </div>

        <!-- 底部作者版权声明 -->
        <div class="disclaimer-meta shrink-0 px-6 py-2.5 text-center">
          <p class="glass-text-muted text-xs font-medium tracking-wide">
            © {{ new Date().getFullYear() }} 御农 System | 架构与开发：<span class="text-primary font-semibold">smdk000</span>
          </p>
        </div>

        <!-- 底部毛玻璃悬浮操作栏 -->
        <div class="disclaimer-footer-bar flex shrink-0 flex-col items-center justify-between gap-3 border-t px-6 py-4 sm:flex-row">
          <!-- 左侧：社区互动卡片 -->
          <div class="order-last w-full flex items-center justify-between gap-3 sm:order-first sm:w-auto sm:justify-start">
            <a
              href="https://qm.qq.com/cgi-bin/qm/qr?k=&group_code=227916149"
              target="_blank"
              rel="noopener noreferrer"
              class="disclaimer-link group flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold no-underline shadow-sm transition-all sm:flex-none"
            >
              <div class="disclaimer-link-icon disclaimer-link-icon--chat i-carbon-chat text-sm transition-transform group-hover:scale-110" />
              <span>加入技术群</span>
            </a>
            <a
              href="https://github.com/smdk000/qq-farm-bot-ui"
              target="_blank"
              rel="noopener noreferrer"
              class="disclaimer-link group flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold no-underline shadow-sm transition-all sm:flex-none"
            >
              <div class="disclaimer-link-icon disclaimer-link-icon--star i-carbon-star text-sm transition-transform group-hover:scale-110" />
              <span>给作者点赞</span>
            </a>
          </div>

          <!-- 右侧：主要操作按钮 -->
          <div class="w-full flex flex-1 items-center gap-3 sm:w-auto sm:flex-none">
            <button
              type="button"
              class="disclaimer-secondary order-2 w-full flex-1 rounded-2xl px-6 py-2.5 text-sm font-semibold transition-colors sm:order-1 sm:w-auto sm:py-3 sm:text-[15px] focus:outline-none"
              @click="emit('decline')"
            >
              拒绝并退出
            </button>
            <button
              type="button"
              class="disclaimer-primary order-1 w-full flex-1 rounded-2xl px-6 py-2.5 text-sm font-semibold shadow-md transition-all sm:order-2 sm:w-auto active:scale-[0.98] sm:py-3 sm:text-[15px] focus:outline-none"
              @click="emit('agree')"
            >
              同意并继续
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.96) translateY(10px);
  opacity: 0;
}

/* 苹果风文字排版 */
.apple-text :deep(b) {
  display: block;
  font-size: 15px;
  font-weight: 700;
  color: var(--ui-text-1); /* 针对浅色模式 */
  margin-top: 1rem;
  margin-bottom: 0.25rem;
  letter-spacing: -0.01em;
}

.dark .apple-text :deep(b) {
  color: var(--ui-text-1); /* 针对深色模式 */
}

/* iOS 风格的滚动条 */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
  margin-top: 8px;
  margin-bottom: 8px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: var(--ui-scrollbar-thumb);
  border-radius: 20px;
  border: 2px solid transparent;
  background-clip: content-box;
}
.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background-color: var(--ui-scrollbar-thumb-hover);
}

.disclaimer-overlay {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 18%, var(--ui-overlay-backdrop));
  backdrop-filter: blur(14px);
}

.disclaimer-shell {
  background: color-mix(in srgb, var(--ui-bg-surface) 88%, transparent);
  border-color: color-mix(in srgb, var(--ui-border-subtle) 92%, transparent);
  box-shadow: 0 28px 56px var(--ui-shadow-panel-strong);
}

.dark .disclaimer-shell {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 86%, transparent);
}

.disclaimer-header,
.disclaimer-meta,
.disclaimer-footer-bar {
  border-color: var(--ui-border-subtle);
}

.disclaimer-badge-shell {
  background: linear-gradient(
    135deg,
    var(--ui-brand-600),
    color-mix(in srgb, var(--ui-brand-500) 62%, var(--ui-status-info) 38%)
  );
}

.disclaimer-warning-icon {
  color: var(--ui-text-on-brand);
}

.disclaimer-prose {
  color: var(--ui-text-2);
}

.disclaimer-meta {
  background: color-mix(in srgb, var(--ui-bg-surface) 64%, transparent);
}

.disclaimer-footer-bar {
  background: color-mix(in srgb, var(--ui-bg-surface) 72%, transparent);
}

.dark .disclaimer-footer-bar {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 72%, transparent);
}

.disclaimer-link {
  border: 1px solid var(--ui-border-subtle);
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 76%, transparent);
  color: var(--ui-text-2);
}

.disclaimer-link-icon--chat {
  color: var(--ui-status-info);
}

.disclaimer-link-icon--star {
  color: var(--ui-status-warning);
}

.disclaimer-link:hover {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 92%, transparent);
  color: var(--ui-text-1);
}

.disclaimer-link:focus-visible,
.disclaimer-secondary:focus-visible,
.disclaimer-primary:focus-visible {
  box-shadow: 0 0 0 2px var(--ui-focus-ring);
}

.disclaimer-secondary {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 84%, transparent);
  color: var(--ui-text-2);
}

.disclaimer-secondary:hover {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 96%, transparent);
  color: var(--ui-text-1);
}

.disclaimer-primary {
  background: linear-gradient(135deg, var(--ui-brand-600), var(--ui-brand-500));
  color: var(--ui-text-on-brand);
  box-shadow: 0 14px 24px color-mix(in srgb, var(--ui-brand-500) 24%, transparent);
}

.disclaimer-primary:hover {
  filter: brightness(1.04);
}
</style>
