<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { developmentProgress, helpArticles, helpCategories } from '@/data/help-articles'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()

// 从数据文件加载分类
const categories = ref(helpCategories.map((cat: any) => ({
  ...cat,
  expanded: cat.name === '新手入门', // 默认展开第一个
  items: helpArticles
    .filter((article: any) => article.category === cat.name && article.reviewStatus === 'published')
    .map((article: any) => ({
      id: article.id,
      title: article.title,
      icon: article.icon,
    })),
})))

// 当前选中
const selectedArticle = ref('quick-start')
const searchQuery = ref('')
const searchResults = ref<typeof helpArticles>([])
const isSearching = ref(false)

// 搜索功能
function handleSearch() {
  if (!searchQuery.value.trim()) {
    isSearching.value = false
    searchResults.value = []
    return
  }

  isSearching.value = true
  const query = searchQuery.value.toLowerCase()

  searchResults.value = helpArticles.filter((article: any) => {
    // 搜索标题
    if (article.title.toLowerCase().includes(query))
      return true
    // 搜索标签
    if (article.tags.some((tag: string) => tag.toLowerCase().includes(query)))
      return true
    // 搜索分类
    if (article.category.toLowerCase().includes(query))
      return true

    return false
  }).slice(0, 10) // 限制结果数量
}

function clearSearch() {
  searchQuery.value = ''
  isSearching.value = false
  searchResults.value = []
}

// 切换分类展开/收起
function toggleCategory(index: number) {
  categories.value.forEach((cat: any, i: number) => {
    if (i === index) {
      cat.expanded = !cat.expanded
    }
    else {
      cat.expanded = false
    }
  })
}

// 选择文章
function selectArticle(articleId: string) {
  selectedArticle.value = articleId
  clearSearch()
  // 滚动到顶部
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function getCategoryButtonClasses(expanded: boolean) {
  return expanded
    ? 'hc-cat-active help-nav-category help-nav-category-active'
    : 'help-nav-category help-nav-category-idle'
}

function getCategoryIconClasses(expanded: boolean) {
  return expanded
    ? 'help-nav-icon help-nav-icon-active'
    : 'help-nav-icon help-nav-icon-idle'
}

function getArticleButtonClasses(active: boolean) {
  return active
    ? 'help-article-link help-article-link-active'
    : 'help-article-link help-article-link-idle'
}

// Vue template usage is not always reflected in the TS unused analysis for this page.
void getCategoryButtonClasses
void getCategoryIconClasses
void getArticleButtonClasses

// 获取当前文章
function getCurrentArticle() {
  return helpArticles.find((article: any) => article.id === selectedArticle.value)
}

// 获取文章标题
function getArticleTitle() {
  const article = getCurrentArticle()
  return article ? article.title : '帮助中心'
}

// 获取开发进度
const progress = developmentProgress
const siteTitle = computed(() => appStore.siteTitle)
const supportQqGroup = computed(() => appStore.supportQqGroup)
const supportQqGroupLink = computed(() => `tencent://message/?uin=${supportQqGroup.value}&Site=&Menu=yes`)

onMounted(() => {
  appStore.fetchUIConfig()
})
</script>

<template>
  <div class="help-center-page ui-page-shell ui-page-density-reading glass-text-main h-full min-h-0 w-full flex flex-col overflow-hidden">
    <div class="help-center-shell h-full min-h-0 w-full flex flex-col gap-4 xl:flex-row xl:gap-5">
      <!-- 左侧分类导航 -->
      <aside class="help-center-sidebar glass-panel min-h-0 w-full flex shrink-0 flex-col rounded-2xl p-4 shadow-sm transition-all">
        <h2 class="help-page-title mb-6 bg-clip-text px-2 text-xl text-transparent font-bold tracking-wide">
          {{ siteTitle }} Help
        </h2>

        <nav class="min-h-0 flex-1 overflow-y-auto pr-1 space-y-2">
          <div
            v-for="(category, index) in categories"
            :key="category.name"
            class="space-y-1"
          >
            <button
              class="group w-full flex items-center justify-between rounded-xl px-4 py-3 text-left transition-colors"
              :class="getCategoryButtonClasses(category.expanded)"
              @click="toggleCategory(index)"
            >
              <div class="flex items-center gap-3">
                <div :class="[category.icon, getCategoryIconClasses(category.expanded)]" />
                <span>{{ category.name }}</span>
              </div>
              <div
                class="i-carbon-chevron-down transition-transform duration-300"
                :class="{ 'rotate-180': category.expanded, 'opacity-50': !category.expanded }"
              />
            </button>

            <transition
              enter-active-class="transition-all duration-300 ease-out overflow-hidden"
              enter-from-class="opacity-0 max-h-0 -translate-y-2"
              enter-to-class="opacity-100 max-h-96 translate-y-0"
              leave-active-class="transition-all duration-200 ease-in overflow-hidden"
              leave-from-class="opacity-100 max-h-96 translate-y-0"
              leave-to-class="opacity-0 max-h-0 -translate-y-2"
            >
              <div v-if="category.expanded" class="mt-1 pl-4 space-y-1">
                <button
                  v-for="item in category.items"
                  :key="item.id"
                  class="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-all"
                  :class="getArticleButtonClasses(selectedArticle === item.id)"
                  @click="selectArticle(item.id)"
                >
                  <div :class="item.icon" class="opacity-80" />
                  <span class="truncate">{{ item.title }}</span>
                </button>
              </div>
            </transition>
          </div>
        </nav>

        <!-- 开发进度信息 -->
        <div class="glass-panel mt-4 rounded-xl p-4 shadow-sm">
          <div class="glass-text-main mb-3 flex items-center gap-2 text-xs font-bold">
            <div class="i-carbon-in-progress text-primary-600 dark:text-primary-400" />
            <span>核心库补完计划</span>
          </div>
          <div class="help-progress-track h-1.5 overflow-hidden rounded-full">
            <div
              class="h-full from-primary-500 to-primary-600 bg-gradient-to-r transition-all duration-1000 ease-out"
              :style="{ width: `${(progress.completedArticles / progress.totalArticles) * 100}%` }"
            />
          </div>
          <div class="glass-text-muted mt-2 text-right text-[10px] font-bold tracking-wider font-mono">
            {{ progress.completedArticles }} / {{ progress.totalArticles }} DOCS
          </div>
        </div>
      </aside>

      <!-- 右侧主内容区 -->
      <main class="help-center-main min-h-0 min-w-0 flex flex-1 flex-col gap-4 xl:gap-5">
        <div class="relative min-h-0 flex flex-1 flex-col">
          <!-- 创作者与搜索卡片 (固定在顶部) -->
          <div class="glass-panel group sticky top-0 z-20 mb-6 flex shrink-0 flex-col justify-between gap-4 overflow-hidden rounded-3xl p-4 shadow-sm sm:flex-row sm:items-center lg:p-5">
            <!-- 底部氛围光 -->
            <div class="pointer-events-none absolute h-64 w-64 rounded-full bg-primary-500/5 blur-[40px] transition-all duration-700 -bottom-10 -right-10 group-hover:bg-primary-500/10" />

            <!-- 左侧作者信息 -->
            <div class="relative z-10 flex items-center gap-4">
              <div class="hc-author-orb help-author-orb-shell relative h-12 w-12 rounded-full p-[2px] shadow-md transition-all duration-500">
                <div class="help-author-core h-full w-full flex items-center justify-center rounded-full">
                  <div class="i-carbon-code text-xl text-primary-700 dark:text-primary-400" />
                </div>
              </div>
              <div>
                <div class="mb-0.5 flex items-center gap-2">
                  <h3 class="glass-text-main text-base font-extrabold tracking-wide">
                    官方核心创作者
                  </h3>
                  <span class="help-verified-badge flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase">
                    <div class="i-carbon-checkmark-filled text-[10px]" /> VERIFIED
                  </span>
                </div>
                <p class="help-author-subtitle text-xs font-medium">
                  系统架构与底座开发：<span class="glass-text-main font-bold">smdk000</span>
                </p>
              </div>
            </div>

            <!-- 右侧搜索与联系方式 -->
            <div class="relative z-10 w-full flex items-center gap-3 sm:w-auto">
              <!-- 搜索框 -->
              <div class="help-search-shell flex flex-1 cursor-text items-center rounded-xl p-2.5 shadow-inner backdrop-blur-md transition-all sm:w-64">
                <span class="glass-text-muted i-carbon-search ml-2 mr-2 text-lg transition-colors group-hover:text-primary-600 dark:group-hover:text-primary-400" />
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="搜索所有文档..."
                  class="help-search-input glass-text-main w-full border-none bg-transparent text-sm font-medium outline-none"
                  @keyup.enter="handleSearch"
                >
                <button v-show="searchQuery" class="help-search-clear glass-text-muted mx-1 rounded-full p-1 transition-colors" @click="clearSearch">
                  <div class="i-carbon-close text-sm" />
                </button>
              </div>

              <!-- QQ群按钮 -->
              <a :href="supportQqGroupLink" class="glass-panel glass-text-main flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm transition-all hover:shadow-md">
                <div class="i-carbon-chat text-lg text-primary-600 dark:text-primary-400" />
                <span class="hidden sm:inline">支持QQ群 {{ supportQqGroup }}</span>
              </a>
            </div>
          </div>

          <!-- 文档内容卡片 -->
          <div class="glass-panel relative flex-1 overflow-y-auto overscroll-contain scroll-smooth rounded-3xl p-5 shadow-sm lg:p-8">
            <div class="help-document-sheen pointer-events-none absolute right-0 top-0 h-32 w-full" />

            <!-- 搜索结果视图 -->
            <div v-if="isSearching" class="relative z-10">
              <h2 class="glass-text-main mb-6 flex items-center gap-3 text-2xl font-extrabold">
                <div class="i-carbon-search text-primary-600 dark:text-primary-400" />
                搜索 "{{ searchQuery }}"
              </h2>
              <div v-if="searchResults.length > 0" class="space-y-3">
                <button
                  v-for="result in searchResults"
                  :key="result.id"
                  class="help-result-card group glass-panel w-full flex items-start gap-4 rounded-xl p-4 text-left shadow-sm transition-all hover:shadow-md"
                  @click="selectArticle(result.id)"
                >
                  <div class="help-result-icon h-10 w-10 flex shrink-0 items-center justify-center rounded-lg shadow-sm group-hover:shadow-md">
                    <div :class="result.icon" class="text-xl" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <h3 class="glass-text-main mb-1 text-base font-bold transition-colors group-hover:text-primary-700 dark:group-hover:text-primary-300">
                      {{ result.title }}
                    </h3>
                    <div class="flex items-center gap-2">
                      <span class="help-result-tag glass-text-main rounded px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase">{{ result.category }}</span>
                    </div>
                  </div>
                </button>
              </div>
              <div v-else class="py-20 text-center">
                <div class="help-empty-icon i-carbon-search-locate mx-auto mb-4 text-6xl" />
                <p class="glass-text-main text-lg font-bold">
                  未找到相关内容
                </p>
                <p class="glass-text-muted mt-2 text-sm font-medium">
                  尝试使用更短的关键词，或者浏览左侧的分类目录
                </p>
              </div>
            </div>

            <!-- 正常文章视图 -->
            <div v-else class="relative z-10">
              <h2 class="glass-text-main mb-8 flex items-center gap-3 text-3xl font-black tracking-tight">
                <div class="i-carbon-document text-primary-600 dark:text-primary-400" />
                {{ getArticleTitle() }}
              </h2>

              <div class="article-markdown-body glass-text-main font-medium leading-relaxed space-y-4">
                <div v-html="getCurrentArticle()?.content || '<div class=\'text-center py-10 opacity-50\'>内容加载中...</div>'" />
              </div>

              <!-- Meta Footer -->
              <div class="help-article-footer mt-12 flex flex-wrap items-center justify-between gap-4 pt-6">
                <div class="glass-text-muted flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium">
                  <div class="flex items-center gap-2">
                    <div class="i-carbon-calendar" />
                    <span>更新于：{{ getCurrentArticle()?.updatedAt }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <div class="i-carbon-tag" />
                    <span>版本：{{ getCurrentArticle()?.version }}</span>
                  </div>
                </div>

                <div class="flex items-center gap-3">
                  <span class="glass-text-muted text-sm font-bold">文档有帮助吗？</span>
                  <div class="flex gap-2">
                    <button class="help-feedback-btn help-feedback-btn-like glass-text-muted h-9 w-9 flex items-center justify-center rounded-full shadow-sm transition-all">
                      <div class="i-carbon-thumbs-up" />
                    </button>
                    <button class="help-feedback-btn help-feedback-btn-dislike glass-text-muted h-9 w-9 flex items-center justify-center rounded-full shadow-sm transition-all">
                      <div class="i-carbon-thumbs-down" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.help-center-page {
  color: var(--ui-text-1);
}

.help-center-shell {
  align-items: stretch;
  gap: var(--ui-page-gap-current);
}

.help-center-sidebar {
  flex-basis: 100%;
  max-height: min(22rem, 42vh);
}

.help-center-main {
  min-width: 0;
  gap: calc(var(--ui-page-gap-current) + 0.125rem);
}

@media (min-width: 1280px) {
  .help-center-sidebar {
    width: 18.5rem;
    flex-basis: 18.5rem;
    max-height: none;
  }
}

.help-center-page
  :is(
    [class*='text-'][class*='gray-300'],
    [class*='text-'][class*='gray-400'],
    [class*='text-'][class*='gray-500'],
    .glass-text-muted
  ) {
  color: var(--ui-text-2) !important;
}

.help-center-page :is([class*='text-'][class*='gray-200'], [class*='text-'][class*='gray-100']) {
  color: var(--ui-text-1) !important;
}

.help-page-title {
  background-image: linear-gradient(
    90deg,
    color-mix(in srgb, var(--ui-brand-700) 88%, var(--ui-text-1) 12%),
    color-mix(in srgb, var(--ui-brand-500) 92%, var(--ui-text-1) 8%)
  );
}

.help-author-orb-shell {
  background-image: linear-gradient(
    135deg,
    color-mix(in srgb, var(--ui-brand-500) 88%, white 12%),
    color-mix(in srgb, var(--ui-brand-700) 82%, black 18%)
  );
}

.help-nav-category,
.help-article-link,
.help-search-shell,
.help-result-icon,
.help-result-tag,
.help-feedback-btn,
.help-author-core,
.help-verified-badge {
  border: 1px solid var(--ui-border-subtle) !important;
}

.help-nav-category-active,
.help-article-link-active,
.help-verified-badge {
  background: var(--ui-brand-soft-12) !important;
  color: color-mix(in srgb, var(--ui-brand-700) 76%, var(--ui-text-1)) !important;
}

.help-nav-category-idle,
.help-article-link-idle {
  color: var(--ui-text-1) !important;
}

.help-nav-category-idle:hover,
.help-article-link-idle:hover {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 82%, transparent) !important;
}

.help-nav-icon-active {
  color: var(--ui-brand-600) !important;
}

.help-nav-icon-idle {
  color: var(--ui-text-2) !important;
  transition: transform 0.2s ease;
}

.group:hover .help-nav-icon-idle {
  transform: scale(1.1);
}

.help-progress-track {
  background: color-mix(in srgb, var(--ui-bg-surface) 72%, transparent) !important;
}

.help-author-core,
.help-search-shell,
.help-result-icon,
.help-result-tag,
.help-feedback-btn {
  background: color-mix(in srgb, var(--ui-bg-surface) 68%, transparent) !important;
}

.help-author-subtitle {
  color: var(--ui-text-2) !important;
}

.help-document-sheen {
  background: linear-gradient(
    to bottom,
    color-mix(in srgb, var(--ui-brand-500) 10%, transparent),
    transparent
  ) !important;
}

.help-search-shell {
  border-radius: 0.75rem;
}

.group:hover .help-search-shell {
  border-color: color-mix(in srgb, var(--ui-brand-500) 28%, var(--ui-border-subtle)) !important;
}

.help-search-input::placeholder {
  color: var(--ui-text-3);
}

.help-search-clear:hover {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 84%, transparent) !important;
  color: var(--ui-text-1) !important;
}

.help-result-card:hover {
  box-shadow: 0 14px 28px var(--ui-shadow-panel) !important;
}

.help-result-icon {
  color: var(--ui-brand-600) !important;
}

.help-feedback-btn-like:hover {
  border-color: color-mix(in srgb, var(--ui-brand-500) 36%, transparent) !important;
  background: var(--ui-brand-soft-10) !important;
  color: color-mix(in srgb, var(--ui-brand-700) 76%, var(--ui-text-1)) !important;
}

.help-feedback-btn-dislike:hover {
  border-color: color-mix(in srgb, var(--ui-status-danger) 30%, transparent) !important;
  background: color-mix(in srgb, var(--ui-status-danger) 8%, transparent) !important;
  color: color-mix(in srgb, var(--ui-status-danger) 78%, var(--ui-text-1)) !important;
}

.help-empty-icon {
  color: color-mix(in srgb, var(--ui-text-3) 78%, transparent) !important;
}

.help-article-footer {
  border-top: 1px solid var(--ui-border-subtle) !important;
}

.help-center-page [class*='border-'][class*='white/20'],
.help-center-page [class*='border-'][class*='white/10'],
.help-center-page [class*='border-'][class*='gray-200/50'],
.help-center-page [class*='dark:border-'][class*='white/10'] {
  border-color: var(--ui-border-subtle) !important;
}

.help-center-page [class*='bg-'][class*='black/5'],
.help-center-page [class*='bg-'][class*='black/10'],
.help-center-page [class*='bg-'][class*='white/10'],
.help-center-page [class*='dark:bg-'][class*='black/20'],
.help-center-page [class*='dark:bg-'][class*='black/30'] {
  background-color: var(--ui-bg-surface) !important;
}

/* 深邃层次感玻璃底板 - 仅增强 box-shadow，backdrop-filter 由全局 style.css 统一管控 */
.glass-panel {
  box-shadow:
    0 8px 32px 0 var(--ui-shadow-panel),
    inset 0 1px 0 var(--ui-shadow-inner);
}

.dark .glass-panel {
  box-shadow:
    0 8px 32px 0 var(--ui-shadow-panel-strong),
    inset 0 1px 0 var(--ui-shadow-inner);
}

/* --------------- 动态内容内部样式调整 --------------- */
:deep(.article-markdown-body) {
  font-size: 0.95rem;
  color: var(--ui-text-1);
  line-height: 1.8;
  max-width: 78ch;
}
.dark :deep(.article-markdown-body) {
  color: var(--ui-text-1);
}

:deep(.article-markdown-body h3) {
  font-size: 1.25rem;
  font-weight: 800;
  margin-bottom: 0.75rem;
  color: var(--ui-text-1);
}
.dark :deep(.article-markdown-body h3) {
  color: var(--ui-text-1);
}

:deep(.article-markdown-body h4) {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: var(--ui-text-1);
}
.dark :deep(.article-markdown-body h4) {
  color: var(--ui-text-1);
}

:deep(.article-markdown-body p) {
  font-weight: 500;
  max-width: 72ch;
}

:deep(.article-markdown-body ul),
:deep(.article-markdown-body ol) {
  list-style-type: disc;
  padding-left: 1.5rem;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

:deep(.article-markdown-body pre) {
  background: var(--ui-bg-surface-raised);
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  font-family: monospace;
  font-size: 0.85rem;
  margin-top: 0.5rem;
  color: var(--ui-text-1);
  font-weight: 600;
  border: 1px solid var(--ui-border-subtle);
}

.dark :deep(.article-markdown-body pre) {
  background: var(--ui-bg-surface-raised);
  color: var(--ui-text-1);
  border: 1px solid var(--ui-border-subtle);
}

/* 统一拟态卡片样式 */
:deep(.info-card),
:deep(.step-card),
:deep(.tip-card),
:deep(.feature-card),
:deep(.practice-card),
:deep(.strategy-card),
:deep(.mode-card),
:deep(.tip-section),
:deep(.interaction-card),
:deep(.task-type),
:deep(.gift-list),
:deep(.solution-card),
:deep(.checklist),
:deep(.config-template),
:deep(.faq-item) {
  background: var(--ui-bg-surface);
  border: 1px solid var(--ui-border-subtle);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow:
    0 4px 6px -1px var(--ui-shadow-panel),
    0 2px 4px -2px var(--ui-shadow-panel);
  transition: all 0.3s ease;
  color: var(--ui-text-1);
  backdrop-filter: blur(10px);
}

.dark :deep(.info-card),
.dark :deep(.step-card),
.dark :deep(.tip-card),
.dark :deep(.feature-card),
.dark :deep(.practice-card),
.dark :deep(.strategy-card),
.dark :deep(.mode-card),
.dark :deep(.tip-section),
.dark :deep(.interaction-card),
.dark :deep(.task-type),
.dark :deep(.gift-list),
.dark :deep(.solution-card),
.dark :deep(.checklist),
.dark :deep(.config-template),
.dark :deep(.faq-item) {
  background: var(--ui-bg-surface);
  box-shadow: 0 4px 6px -1px var(--ui-shadow-panel-strong);
}

/* 特殊卡片增强 */
:deep(.tip-success) {
  border-left: 4px solid var(--ui-status-success) !important;
}
:deep(.tip-warning) {
  border-left: 4px solid var(--ui-status-warning) !important;
}
:deep(.tip-info) {
  border-left: 4px solid var(--ui-status-info) !important;
}
:deep(.tip-error) {
  border-left: 4px solid var(--ui-status-danger) !important;
}

:deep(.tip-success) .tip-icon {
  color: var(--ui-status-success);
}
.dark :deep(.tip-success) .tip-icon {
  color: var(--ui-status-success);
}

:deep(.tip-warning) .tip-icon {
  color: var(--ui-status-warning);
}
.dark :deep(.tip-warning) .tip-icon {
  color: var(--ui-status-warning);
}

:deep(.tip-info) .tip-icon {
  color: var(--ui-status-info);
}
.dark :deep(.tip-info) .tip-icon {
  color: var(--ui-status-info);
}

:deep(.feature-grid) {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

:deep(.step-number) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: var(--ui-status-info);
  color: var(--ui-text-on-brand);
  border-radius: 50%;
  font-size: 0.9rem;
  font-weight: 800;
  margin-right: 12px;
  margin-bottom: 12px;
  box-shadow: 0 2px 4px var(--ui-shadow-panel);
}

.dark :deep(.step-number) {
  background: var(--ui-status-info);
  box-shadow: 0 2px 4px var(--ui-shadow-panel-strong);
}

.hc-cat-active {
  box-shadow: 0 0 15px color-mix(in srgb, var(--ui-brand-500) 18%, transparent);
}

.group:hover .hc-author-orb {
  box-shadow: 0 0 15px color-mix(in srgb, var(--ui-brand-500) 30%, transparent);
}

:deep(.tip-header) {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 8px;
}
</style>
