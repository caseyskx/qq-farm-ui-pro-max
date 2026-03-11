<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'

const menuItems = ref([
  { id: 'calculator.html', title: '经验时间计算', icon: 'i-carbon-calculator', shortTitle: '经验计算' },
  { id: 'levels.html', title: '等级氪金模拟', icon: 'i-carbon-chart-evaluation', shortTitle: '氪金模拟' },
  { id: 'plants.html', title: '作物图鉴查询', icon: 'i-carbon-catalog', shortTitle: '作物图鉴' },
  { id: 'lands.html', title: '土地升级属性', icon: 'i-carbon-map', shortTitle: '土地属性' },
])

const route = useRoute()
const selectedArticle = ref('calculator.html')
const iframeRef = ref<HTMLIFrameElement | null>(null)
const presetArticle = computed(() => {
  const raw = String(route.meta?.farmToolsPreset || '').trim()
  return menuItems.value.some(item => item.id === raw) ? raw : ''
})
const standaloneMode = computed(() => Boolean(route.meta?.farmToolsStandalone && presetArticle.value))
const activeArticle = computed(() => presetArticle.value || selectedArticle.value)
const selectedMenuItem = computed(() => menuItems.value.find(item => item.id === activeArticle.value) ?? menuItems.value[0]!)

// 中屏侧栏折叠状态
const sidebarVisible = ref(false)
function toggleSidebar() {
  sidebarVisible.value = !sidebarVisible.value
}

function selectArticle(articleId: string) {
  if (presetArticle.value) {
    sidebarVisible.value = false
    return
  }
  selectedArticle.value = articleId
  // 中小屏下选中菜单项后自动关闭浮动侧栏
  sidebarVisible.value = false
}

// 🔧 优化 #1：将绝大部分不依赖 isDark 的静态系统样式提取出来
const BASE_STATIC_CSS = `
  html, body { 
    color: var(--text-main) !important;
  }
  
  /* 隐藏原本自带的内部侧边栏与顶部栏，使其作为纯粹的组件嵌入 */
  aside, header, #sidebar-backdrop { display: none !important; }
  
  /* =========== 卡片与全局玻璃质感同步 =========== */
  [class~="bg-white"], [class*="dark:bg-"][class*="slate-800"] { 
    background-color: var(--glass-bg) !important; 
    backdrop-filter: blur(12px) !important;
    border-color: var(--glass-border) !important;
  }
  
  /* =========== 渐变背景统一 =========== */
  /* 所有 Hero 区域渐变（保留渐变但用系统色） */
  .bg-gradient-to-br.from-primary-700,
  .bg-gradient-to-br[class*="from-primary-700"] {
    background-image: linear-gradient(135deg, var(--farm-brand-700-soft-85), var(--farm-brand-soft-70)) !important;
    --tw-gradient-from: transparent !important;
    --tw-gradient-to: transparent !important;
  }
  
  /* =========== 搜索/筛选栏背景 =========== */
  .backdrop-blur {
    background-color: transparent !important;
  }
  
  /* =========== 原色劫持兜底 =========== */
  .text-green-600, .text-green-500, .text-farm-500 { color: var(--farm-brand-500) !important; }
  .bg-green-500, .bg-green-600, .bg-farm-500 { background-color: var(--farm-brand-500) !important; }
  
  /* =========== 表单元素 =========== */
  input:active, input:focus, select:active, select:focus {
    border-color: var(--farm-brand-500) !important;
    outline: none !important;
    box-shadow: 0 0 0 2px var(--farm-brand-soft-20) !important;
  }

  /* =========== 表格 =========== */
  table, th, td { border-color: var(--glass-border) !important; }
  tr:hover td { background-color: var(--farm-brand-soft-05) !important; }
  
  /* =========== Modal 弹窗 =========== */
  .fixed.inset-0[class*="bg-"][class*="black"] {
     backdrop-filter: blur(8px) !important;
     background-color: var(--ui-overlay-backdrop) !important;
  }

  /* =========== 搜索框暗色适配 =========== */
  .border-slate-200 { border-color: var(--glass-border) !important; }
  [class*="dark:border-slate-700"] { border-color: var(--glass-border) !important; }

  /* =========== 隐藏 shadow-inner（土地图片区残留阴影） =========== */
  .shadow-inner { box-shadow: none !important; }

  /* =========== 土地卡片 bg-transparent 确保生效 =========== */
  .land-card, .plant-card {
    background-color: var(--glass-bg) !important;
    backdrop-filter: blur(12px) !important;
  }
  
  /* =========== 🏷️ 徽章 (bonus-tag) 底色 + 文字色柔化 =========== */
  .bonus-tag { backdrop-filter: blur(6px) !important; }
  
  /* =========== 🔗 特殊土地卡片底部信息区文字 =========== */
  .land-card .text-slate-700 { color: var(--text-main) !important; }

  /* =========== 文本颜色继承系统主题 =========== */
  .text-slate-800, [class*="dark:text-slate-200"] { color: var(--text-main) !important; }
  .text-slate-600, .text-slate-500, .text-slate-400,
  [class*="dark:text-slate-400"], [class*="dark:text-slate-500"],
  [class*="dark:text-slate-300"] { color: var(--text-muted) !important; }
  .text-slate-700, [class*="dark:text-slate-300"] { color: var(--text-main) !important; }
  
  /* =========== 🔘 按钮/交互组件 深浅色适配 =========== */
  /* 主按钮（开始计算等）—— 确保白字在任何主题色上可读 */
  .btn-calc {
    color: var(--ui-text-on-brand) !important;
    box-shadow: 0 2px 8px var(--farm-brand-soft-35) !important;
    text-shadow: 0 1px 2px var(--ui-shadow-text);
  }
  .btn-calc:hover { box-shadow: 0 4px 16px var(--farm-brand-soft-45) !important; }
  
  /* 验算按钮 —— 跟随主题色渐变 */
  .btn-verify {
    background: linear-gradient(135deg, var(--farm-brand-400), var(--farm-brand-600)) !important;
    color: var(--ui-text-on-brand) !important;
    box-shadow: 0 2px 8px var(--farm-brand-soft-30) !important;
    text-shadow: 0 1px 2px var(--ui-shadow-text);
  }
  
  /* 排行切换 active / 验算植物 Tab active */
  .rank-tab.active,
  .v-crop-tab.v-active {
    background: var(--farm-brand-500) !important;
    color: var(--ui-text-on-brand) !important;
    border-color: var(--farm-brand-500) !important;
    text-shadow: 0 1px 2px var(--ui-shadow-text);
  }
  
  /* 计算器模式切换 Tab active */
  .calc-mode-tab.active {
    background: var(--farm-brand-500) !important;
    color: var(--ui-text-on-brand) !important;
    text-shadow: 0 1px 2px var(--ui-shadow-text);
    box-shadow: 0 2px 8px var(--farm-brand-soft-25) !important;
  }
  .calc-mode-tab:hover:not(.active) {
    color: var(--farm-brand-600) !important;
    background: var(--farm-brand-soft-08) !important;
  }
  
  /* 开关 Toggle */
  .fert-toggle input[type="checkbox"]:checked { background: var(--farm-brand-500) !important; }
  .fert-toggle input[type="checkbox"]::after { background: var(--ui-text-on-brand) !important; box-shadow: 0 1px 3px var(--ui-shadow-text); }
  
  /* 施肥阶段选择按钮 selected */
  .tc-fert-phase-btn.selected {
    border-color: var(--farm-brand-500) !important;
    background: var(--farm-brand-soft-15) !important;
  }
  
  /* Spinner 加载圈白色可见 */
  .spinner { border-color: color-mix(in srgb, var(--ui-text-on-brand) 30%, transparent) !important; border-top-color: var(--ui-text-on-brand) !important; }
`

// 🔧 优化 #2：持有一个 iframeObserver 引用用于在组件销毁时断开
let iframeObserver: MutationObserver | null = null

// 主题劫持逻辑：在同源策略下，直接注入 CSS 和监控
function syncThemeToIframe() {
  if (!iframeRef.value?.contentDocument)
    return

  try {
    const doc = iframeRef.value.contentDocument
    if (!doc)
      return

    // 如果已经注入过了就不再重复注入 `<style id="yunong-theme-override">`
    let styleEl = doc.getElementById('yunong-theme-override')
    if (!styleEl) {
      styleEl = doc.createElement('style')
      styleEl.id = 'yunong-theme-override'
      doc.head.appendChild(styleEl)

      // 🔥 MutationObserver：监听 iframe <head> 变化
      // 当 Tailwind CDN 异步插入 <style> 标签时，自动将我们的 override style 移到最后
      if (iframeObserver)
        iframeObserver.disconnect()
      iframeObserver = new MutationObserver(() => {
        const lastChild = doc.head.lastElementChild
        if (lastChild && lastChild.id !== 'yunong-theme-override' && styleEl) {
          doc.head.appendChild(styleEl) // 移到最后
        }
      })
      iframeObserver.observe(doc.head, { childList: true })
    }
    else {
      // 每次同步时确保 style 标签在 <head> 最后（覆盖后注入的 Tailwind 样式）
      doc.head.appendChild(styleEl)
    }

    // 探测当前父窗口的系统背景以及各个参数
    const isDark = document.documentElement.classList.contains('dark')
    const computed = getComputedStyle(document.documentElement)

    let cssVars = ''
    const varsToSync = [
      '--ui-brand-100',
      '--ui-brand-200',
      '--ui-brand-300',
      '--ui-brand-400',
      '--ui-brand-500',
      '--ui-brand-600',
      '--ui-brand-700',
      '--ui-brand-800',
      '--ui-brand-900',
      '--color-primary-50',
      '--color-primary-100',
      '--color-primary-200',
      '--color-primary-300',
      '--color-primary-400',
      '--color-primary-500',
      '--color-primary-600',
      '--color-primary-700',
      '--color-primary-800',
      '--color-primary-900',
      '--color-primary-950',
      '--glass-bg',
      '--glass-border',
      '--text-main',
      '--text-muted',
      '--theme-dark-bg',
      '--ui-bg-surface',
      '--ui-bg-surface-raised',
      '--ui-border-subtle',
      '--ui-border-strong',
      '--ui-text-on-brand',
      '--ui-status-success',
      '--ui-status-success-soft',
      '--ui-status-warning',
      '--ui-status-warning-soft',
      '--ui-status-danger',
      '--ui-status-danger-soft',
      '--ui-status-info',
      '--ui-status-info-soft',
      '--ui-shadow-text',
      '--ui-shadow-panel',
      '--ui-shadow-panel-strong',
      '--ui-shadow-inner',
      '--ui-overlay-backdrop',
    ]

    varsToSync.forEach((v) => {
      const val = computed.getPropertyValue(v).trim()
      if (val) {
        cssVars += `${v}: ${val};\n`
      }
      else {
        // 🔧 容错处理：确保取到的值不是空
        if (v === '--glass-bg') {
          cssVars += `${v}: color-mix(in srgb, var(--ui-bg-surface) 72%, transparent);\n`
        }
        else if (v === '--glass-border') {
          cssVars += `${v}: var(--ui-border-subtle);\n`
        }
        else if (v === '--text-main') {
          cssVars += `${v}: var(--ui-text-1);\n`
        }
        else if (v === '--text-muted') {
          cssVars += `${v}: var(--ui-text-2);\n`
        }
        else if (v === '--theme-dark-bg') {
          cssVars += `${v}: var(--ui-bg-canvas);\n`
        }
        else if (v === '--ui-bg-surface') {
          cssVars += `${v}: var(--ui-bg-surface);\n`
        }
        else if (v === '--ui-bg-surface-raised') {
          cssVars += `${v}: var(--ui-bg-surface-raised);\n`
        }
        else if (v === '--ui-border-subtle') {
          cssVars += `${v}: var(--ui-border-subtle);\n`
        }
        else if (v === '--ui-border-strong') {
          cssVars += `${v}: var(--ui-border-strong);\n`
        }
        else if (v === '--ui-text-on-brand') {
          cssVars += `${v}: var(--ui-text-on-brand);\n`
        }
        else if (v === '--ui-status-success') {
          cssVars += `${v}: var(--ui-status-success);\n`
        }
        else if (v === '--ui-status-success-soft') {
          cssVars += `${v}: var(--ui-status-success-soft);\n`
        }
        else if (v === '--ui-status-warning') {
          cssVars += `${v}: var(--ui-status-warning);\n`
        }
        else if (v === '--ui-status-warning-soft') {
          cssVars += `${v}: var(--ui-status-warning-soft);\n`
        }
        else if (v === '--ui-status-danger') {
          cssVars += `${v}: var(--ui-status-danger);\n`
        }
        else if (v === '--ui-status-danger-soft') {
          cssVars += `${v}: var(--ui-status-danger-soft);\n`
        }
        else if (v === '--ui-status-info') {
          cssVars += `${v}: var(--ui-status-info);\n`
        }
        else if (v === '--ui-status-info-soft') {
          cssVars += `${v}: var(--ui-status-info-soft);\n`
        }
        else if (v === '--ui-shadow-text') {
          cssVars += `${v}: var(--ui-shadow-text);\n`
        }
        else if (v === '--ui-shadow-panel') {
          cssVars += `${v}: var(--ui-shadow-panel);\n`
        }
        else if (v === '--ui-shadow-panel-strong') {
          cssVars += `${v}: var(--ui-shadow-panel-strong);\n`
        }
        else if (v === '--ui-shadow-inner') {
          cssVars += `${v}: var(--ui-shadow-inner);\n`
        }
        else if (v === '--ui-overlay-backdrop') {
          cssVars += `${v}: var(--ui-overlay-backdrop);\n`
        }
        else if (v.startsWith('--color-primary-')) {
          // 兜底一个蓝色的 primary 色系，防止空值
          const fallbackColors = {
            '--color-primary-50': '239 246 255',
            '--color-primary-100': '219 234 254',
            '--color-primary-200': '191 219 254',
            '--color-primary-300': '147 197 253',
            '--color-primary-400': '96 165 250',
            '--color-primary-500': '59 130 246',
            '--color-primary-600': '37 99 235',
            '--color-primary-700': '29 78 216',
            '--color-primary-800': '30 64 175',
            '--color-primary-900': '30 58 138',
            '--color-primary-950': '23 37 84',
          }
          cssVars += `${v}: ${fallbackColors[v as keyof typeof fallbackColors]};\n`
        }
      }
    })

    // 🔧 强制给内部 iframe 的 html 标签加上 dark 类，以便触发其内部自带的 tailwind 暗夜模式
    if (isDark) {
      doc.documentElement.classList.add('dark')
    }
    else {
      doc.documentElement.classList.remove('dark')
    }

    // 通用中性色层改为语义 token，降低主题漂移
    const subtleBg = 'var(--ui-bg-surface)'
    const stripeBg = 'var(--ui-bg-surface-raised)'

    // 🔧 仅注入真正受 isDark 影响的动态属性，包括背景色，拒绝白底透传
    styleEl.innerHTML = `
      :root {
        ${cssVars}
        --farm-brand-100: var(--ui-brand-100);
        --farm-brand-200: var(--ui-brand-200);
        --farm-brand-300: var(--ui-brand-300);
        --farm-brand-400: var(--ui-brand-400);
        --farm-brand-500: var(--ui-brand-500);
        --farm-brand-600: var(--ui-brand-600);
        --farm-brand-700: var(--ui-brand-700);
        --farm-brand-800: var(--ui-brand-800);
        --farm-brand-900: var(--ui-brand-900);
        --farm-brand-soft-05: color-mix(in srgb, var(--farm-brand-500) 5%, transparent);
        --farm-brand-soft-06: color-mix(in srgb, var(--farm-brand-500) 6%, transparent);
        --farm-brand-soft-08: color-mix(in srgb, var(--farm-brand-500) 8%, transparent);
        --farm-brand-soft-10: color-mix(in srgb, var(--farm-brand-500) 10%, transparent);
        --farm-brand-soft-12: color-mix(in srgb, var(--farm-brand-500) 12%, transparent);
        --farm-brand-soft-15: color-mix(in srgb, var(--farm-brand-500) 15%, transparent);
        --farm-brand-soft-20: color-mix(in srgb, var(--farm-brand-500) 20%, transparent);
        --farm-brand-soft-25: color-mix(in srgb, var(--farm-brand-500) 25%, transparent);
        --farm-brand-soft-30: color-mix(in srgb, var(--farm-brand-500) 30%, transparent);
        --farm-brand-soft-35: color-mix(in srgb, var(--farm-brand-500) 35%, transparent);
        --farm-brand-soft-45: color-mix(in srgb, var(--farm-brand-500) 45%, transparent);
        --farm-brand-soft-50: color-mix(in srgb, var(--farm-brand-500) 50%, transparent);
        --farm-brand-soft-70: color-mix(in srgb, var(--farm-brand-500) 70%, transparent);
        --farm-brand-soft-85: color-mix(in srgb, var(--farm-brand-500) 85%, transparent);
        --farm-brand-soft-90: color-mix(in srgb, var(--farm-brand-500) 90%, transparent);
        --farm-brand-700-soft-85: color-mix(in srgb, var(--farm-brand-700) 85%, transparent);
        --farm-brand-800-soft-25: color-mix(in srgb, var(--farm-brand-800) 25%, transparent);
        --farm-brand-900-soft-30: color-mix(in srgb, var(--farm-brand-900) 30%, transparent);
        --farm-brand-900-soft-40: color-mix(in srgb, var(--farm-brand-900) 40%, transparent);
        --farm-brand-300-soft-40: color-mix(in srgb, var(--farm-brand-300) 40%, transparent);
        --farm-brand-200-soft-30: color-mix(in srgb, var(--farm-brand-200) 30%, transparent);
        --farm-brand-100-soft-20: color-mix(in srgb, var(--farm-brand-100) 20%, transparent);
      }
      ${BASE_STATIC_CSS}
      
      /* =============== 🔥 终极防白底与系统深度融合补丁 =============== */
      :root, html, body {
        /* 深色模式：用不透明的 --theme-dark-bg 作为画布底色，防止半透明 --glass-bg 混合浏览器默认白色 */
        background: ${isDark ? 'var(--theme-dark-bg, var(--ui-bg-canvas))' : 'var(--glass-bg)'} !important;
        background-color: ${isDark ? 'var(--theme-dark-bg, var(--ui-bg-canvas))' : 'var(--glass-bg)'} !important;
        background-image: none !important;
        color: var(--text-main) !important;
      }
      
      /* 强制将所有文本类的颜色继承系统的字体色彩，不再局限于 dark class 的动态切换失效问题 */
      .text-slate-800, [class*="text-"][class*="gray-800"] {
        color: var(--text-main) !important;
      }
      .text-slate-500, [class*="text-"][class*="gray-500"] {
        color: var(--text-muted) !important;
      }
      
      /* 获取到计算器外层的大型包裹元素并强制剥离所有默认的底色，直接跟身体相同颜色避免断层 */
      #app, main, .home-container, .min-h-screen {
        background-color: transparent !important;
      }

      /* 核心卡片容器：取消自身背景，依赖父级玻璃渲染 */
      .calc-input-panel,
      .calc-mode-tabs,
      .result-card,
      .stat-box,
      .phase-timeline,
      .crop-table,
      .crop-detail-card,
      .sim-card,
      .info-popup-content,
      .tc-input-panel,
      .tc-timeline-card,
      .tc-summary-card {
        background-color: var(--ui-bg-surface) !important;
        backdrop-filter: blur(8px) !important;
        -webkit-backdrop-filter: blur(8px) !important;
        border-color: var(--glass-border) !important;
      }

      [class*="bg-"][class*="white/60"], [class*="dark:bg-"][class*="slate-800/60"] {
        background-color: var(--ui-bg-surface-raised) !important;
      }

      /* 土地卡片图片区 & 特殊土地状态区域的各种浅色渐变 → 彻底清除渐变 */
      .bg-gradient-to-br[class*="from-red-50"], .bg-gradient-to-br[class*="from-orange-50"],
      .bg-gradient-to-br[class*="from-slate-100"], .bg-gradient-to-br[class*="from-stone-100"],
      .bg-gradient-to-br[class*="from-stone-50"], .bg-gradient-to-br[class*="from-yellow-50"],
      .bg-gradient-to-br[class*="from-gray-50"] {
        background-image: none !important;
        background-color: var(--ui-bg-surface) !important;
        --tw-gradient-from: transparent !important; --tw-gradient-to: transparent !important;
      }

      /* 植物卡片种子缩略图区域 & 网格格子 */
      .bg-gradient-to-br.from-primary-50, .bg-gradient-to-br[class*="from-primary-50"] {
        background-image: none !important;
        background-color: ${isDark ? 'var(--farm-brand-soft-08)' : 'var(--farm-brand-soft-06)'} !important;
        --tw-gradient-from: transparent !important; --tw-gradient-to: transparent !important;
      }

      /* 网格格子 */
      .grid-cell.bg-gradient-to-br, .grid-cell[class*="from-primary-50"] {
        background-image: none !important;
        background-color: ${isDark ? 'var(--farm-brand-soft-10)' : 'var(--farm-brand-soft-08)'} !important;
      }
      
      /* 兜底：所有未被上面匹配的渐变容器，如果包含浅色 from-* 类名 */
      [class*="from-"][class*="-50"], [class*="from-"][class*="-100"]:not([class*="from-primary-700"]) {
        background-image: none !important; background-color: var(--ui-bg-surface) !important;
      }
      /* 🔥 暴力全局覆盖：高特异性复合选择器，确保所有浅色渐变被清除 */
      .bg-gradient-to-br[class*="-50"], .bg-gradient-to-br[class*="-100"]:not([class*="from-primary-700"]),
      .bg-gradient-to-r[class*="-50"], .bg-gradient-to-r[class*="-100"]:not([class*="from-primary-700"]) {
        --tw-gradient-from: transparent !important; --tw-gradient-to: transparent !important; --tw-gradient-stops: transparent !important;
        background-image: none !important; background-color: var(--ui-bg-surface) !important;
      }
      
      /* =========== 属性行的浅色背景条 =========== */
      .bg-primary-50, [class*="bg-primary-50"] { background-color: ${isDark ? 'var(--farm-brand-soft-08)' : 'var(--farm-brand-soft-06)'} !important; }
      .bg-blue-50, [class*="bg-blue-50"] { background-color: color-mix(in srgb, var(--ui-status-info-soft) ${isDark ? '44%' : '32%'}, transparent) !important; }
      .bg-purple-50, [class*="bg-purple-50"] { background-color: color-mix(in srgb, var(--ui-status-info-soft) ${isDark ? '36%' : '28%'}, transparent) !important; }
      .bg-red-50, [class*="bg-red-50"] { background-color: color-mix(in srgb, var(--ui-status-danger-soft) ${isDark ? '42%' : '30%'}, transparent) !important; }
      .bg-green-50, [class*="bg-green-50"] { background-color: color-mix(in srgb, var(--ui-status-success-soft) ${isDark ? '42%' : '30%'}, transparent) !important; }
      .bg-yellow-50, [class*="bg-yellow-50"] { background-color: color-mix(in srgb, var(--ui-status-warning-soft) ${isDark ? '44%' : '32%'}, transparent) !important; }
      .bg-stone-50, .bg-stone-100, [class*="bg-stone-50"], [class*="bg-stone-100"] { background-color: ${subtleBg} !important; }
      
      /* =========== 徽章底色统一 =========== */
      .bg-primary-100, [class*="bg-primary-100"] { background-color: ${isDark ? 'var(--farm-brand-soft-15)' : 'var(--farm-brand-soft-12)'} !important; }
      .bg-red-100 { background-color: color-mix(in srgb, var(--ui-status-danger-soft) ${isDark ? '70%' : '52%'}, transparent) !important; }
      .bg-yellow-100 { background-color: color-mix(in srgb, var(--ui-status-warning-soft) ${isDark ? '70%' : '52%'}, transparent) !important; }
      .bg-slate-200 { background-color: var(--ui-bg-surface-raised) !important; }
      .bg-amber-400 { background-color: var(--farm-brand-soft-90) !important; }
      
      /* =========== 表单元素动态背景 =========== */
      input, select, textarea {
        background: var(--ui-bg-surface-raised) !important;
        border: 1px solid var(--glass-border) !important; color: inherit !important;
      }
      
      /* =========== 表格条纹色 =========== */
      th { background-color: ${stripeBg} !important; color: var(--text-main) !important; }

      /* =========== 🎨 卡片边框色统一软化 =========== */
      .land-card, .plant-card { border-color: var(--ui-border-subtle) !important; }
      /* 特定颜色边框降噪 */
      .border-primary-200, .border-primary-400, [class*="border-primary-"] { border-color: ${isDark ? 'var(--farm-brand-soft-25)' : 'var(--farm-brand-soft-35)'} !important; }
      .border-red-300, [class*="border-red-"] { border-color: color-mix(in srgb, var(--ui-border-subtle) ${isDark ? '62%' : '52%'}, var(--ui-status-danger) ${isDark ? '38%' : '48%'}) !important; }
      .border-yellow-400, [class*="border-yellow-"] { border-color: color-mix(in srgb, var(--ui-border-subtle) ${isDark ? '58%' : '50%'}, var(--ui-status-warning) ${isDark ? '42%' : '50%'}) !important; }
      .border-green-300, [class*="border-green-"] { border-color: color-mix(in srgb, var(--ui-border-subtle) ${isDark ? '62%' : '52%'}, var(--ui-status-success) ${isDark ? '38%' : '48%'}) !important; }
      .border-slate-300, .border-slate-400, [class*="border-slate-3"], [class*="border-slate-4"] { border-color: var(--ui-border-subtle) !important; }
      
      /* =========== 🏷️ 徽章文字色柔化 =========== */
      .bonus-tag.bg-primary-100, .bonus-tag[class*="bg-primary-100"] {
        background-color: ${isDark ? 'var(--farm-brand-soft-15)' : 'var(--farm-brand-soft-12)'} !important;
        color: ${isDark ? 'var(--farm-brand-300)' : 'var(--farm-brand-700)'} !important;
      }
      .bonus-tag.bg-red-100 { background-color: color-mix(in srgb, var(--ui-status-danger-soft) ${isDark ? '70%' : '52%'}, transparent) !important; color: var(--ui-status-danger) !important; }
      .bonus-tag.bg-yellow-100 { background-color: color-mix(in srgb, var(--ui-status-warning-soft) ${isDark ? '70%' : '52%'}, transparent) !important; color: var(--ui-status-warning) !important; }
      .bonus-tag.bg-slate-200 { background-color: var(--ui-bg-surface-raised) !important; color: var(--text-muted) !important; }
      /* 通用 Lv 徽章（amber-400底色的那种） */
      .bg-amber-400 { background-color: ${isDark ? 'var(--farm-brand-soft-70)' : 'var(--farm-brand-soft-85)'} !important; }
      
      /* =========== 📊 属性值文字色降噪 =========== */
      .text-primary-600, .text-primary-700, [class*="text-primary-6"], [class*="text-primary-7"] { color: ${isDark ? 'var(--farm-brand-400)' : 'var(--farm-brand-600)'} !important; }
      .text-blue-600, [class*="text-blue-6"] { color: ${isDark ? 'var(--farm-brand-400)' : 'var(--farm-brand-600)'} !important; }
      .text-purple-600, [class*="text-purple-6"] { color: ${isDark ? 'var(--farm-brand-400)' : 'var(--farm-brand-600)'} !important; }
      .text-red-600, .text-red-700, [class*="text-red-6"], [class*="text-red-7"] { color: var(--ui-status-danger) !important; }
      .text-yellow-700, [class*="text-yellow-7"] { color: var(--ui-status-warning) !important; }
      
      /* =========== 🔲 网格格子边框与文字 =========== */
      .grid-cell { border-color: ${isDark ? 'var(--farm-brand-soft-20)' : 'var(--farm-brand-soft-30)'} !important; }
      .grid-cell[class*="border-amber"], .grid-cell[class*="border-yellow"] { border-color: color-mix(in srgb, var(--ui-border-subtle) ${isDark ? '68%' : '58%'}, var(--ui-status-warning) ${isDark ? '32%' : '42%'}) !important; }
      .grid-cell[class*="border-slate"], .grid-cell[class*="border-gray"] { border-color: var(--ui-border-subtle) !important; }
      .grid-cell .text-primary-700 { color: ${isDark ? 'var(--farm-brand-300)' : 'var(--farm-brand-700)'} !important; }
      .grid-cell .text-primary-600, .grid-cell [class*="text-primary-6"] { color: ${isDark ? 'var(--farm-brand-400)' : 'var(--farm-brand-600)'} !important; }
      .grid-cell [class*="text-amber"], .grid-cell [class*="text-yellow"] { color: var(--ui-status-warning) !important; }
      .grid-cell [class*="text-slate"] { color: var(--text-muted) !important; }
      
      /* 开关 Toggle */
      .fert-toggle input[type="checkbox"] { background: var(--ui-border-strong) !important; }
      
      /* 施肥阶段选择动态字色 */
      .tc-fert-phase-btn.selected { color: ${isDark ? 'var(--farm-brand-300)' : 'var(--farm-brand-700)'} !important; }
      .tc-fert-phase-btn:hover { border-color: ${isDark ? 'var(--farm-brand-400)' : 'var(--farm-brand-300)'} !important; }
      
      /* ⓘ 说明按钮 */
      .info-btn:hover { background: var(--farm-brand-soft-10) !important; color: ${isDark ? 'var(--farm-brand-300)' : 'var(--farm-brand-600)'} !important; }
      .info-btn[data-info-key="smart-fert"] { color: ${isDark ? 'var(--farm-brand-400)' : 'var(--farm-brand-600)'} !important; }
      
      /* =========== 🌙 深色模式下 Hero/Tab 亮度柔化 =========== */
      /* calc-hero 渐变区域：降低渐变不透明度，避免浅色系主题的 primary 色在深底上太亮 */
      .calc-hero, .level-hero, .plant-hero, .land-hero {
        background: ${isDark ? 'linear-gradient(135deg, var(--farm-brand-900-soft-40) 0%, var(--farm-brand-800-soft-25) 50%, transparent 100%)' : 'linear-gradient(135deg, var(--farm-brand-200-soft-30) 0%, var(--farm-brand-100-soft-20) 50%, var(--glass-bg) 100%)'} !important;
        border-bottom-color: ${isDark ? 'var(--farm-brand-soft-15)' : 'var(--farm-brand-300-soft-40)'} !important;
      }
      .calc-hero h1, .level-hero h1, .plant-hero h1, .land-hero h1 {
        color: ${isDark ? 'var(--farm-brand-300)' : 'var(--farm-brand-800)'} !important;
      }
      
      /* Tab 激活态：使用深色系主题色替代原始 primary-500 纯色 */
      .calc-mode-tab.active {
        background: ${isDark ? 'var(--farm-brand-900)' : 'var(--farm-brand-500)'} !important;
        color: ${isDark ? 'var(--farm-brand-200)' : 'var(--ui-text-on-brand)'} !important;
        border-color: ${isDark ? 'var(--farm-brand-soft-30)' : 'var(--farm-brand-500)'} !important;
      }
      .rank-tab.active, .v-crop-tab.v-active, .level-tab.active {
        background: ${isDark ? 'var(--farm-brand-900)' : 'var(--farm-brand-500)'} !important;
        color: ${isDark ? 'var(--farm-brand-200)' : 'var(--ui-text-on-brand)'} !important;
        border-color: ${isDark ? 'var(--farm-brand-soft-30)' : 'var(--farm-brand-500)'} !important;
      }

      /* 计算摘要条 */
      .calc-summary {
        background: ${isDark ? 'var(--farm-brand-900-soft-30)' : 'var(--farm-brand-100-soft-20)'} !important;
        border-color: ${isDark ? 'var(--farm-brand-soft-15)' : 'var(--farm-brand-300-soft-40)'} !important;
        color: ${isDark ? 'var(--text-main)' : 'var(--farm-brand-800)'} !important;
      }
      
      /* 推荐卡左侧彩条降低亮度 */
      .rec-card.card-no-fert {
        border-left-color: ${isDark ? 'var(--farm-brand-soft-50)' : 'var(--farm-brand-500)'} !important;
      }
      
      /* 主按钮在深色模式下使用更深的底色 */
      .btn-calc {
        background: ${isDark ? 'linear-gradient(135deg, var(--farm-brand-800), var(--farm-brand-900))' : 'linear-gradient(135deg, var(--farm-brand-500), var(--farm-brand-600))'} !important;
        color: ${isDark ? 'var(--farm-brand-200)' : 'var(--ui-text-on-brand)'} !important;
        box-shadow: ${isDark ? '0 2px 8px var(--farm-brand-soft-20)' : '0 2px 8px var(--farm-brand-soft-35)'} !important;
      }
      
      /* 验算按钮 */
      .btn-verify {
        background: ${isDark ? 'linear-gradient(135deg, var(--farm-brand-800), var(--farm-brand-900))' : 'linear-gradient(135deg, var(--farm-brand-400), var(--farm-brand-600))'} !important;
        color: ${isDark ? 'var(--farm-brand-200)' : 'var(--ui-text-on-brand)'} !important;
      }
      
      /* 开关激活态柔化 */
      .fert-toggle input[type="checkbox"]:checked { 
        background: ${isDark ? 'var(--farm-brand-800)' : 'var(--farm-brand-500)'} !important;
      }
      
      /* land-info 信息条 */
      .land-info {
        background: ${isDark ? 'var(--farm-brand-900-soft-30)' : 'var(--farm-brand-100-soft-20)'} !important;
        color: ${isDark ? 'var(--farm-brand-300)' : 'var(--farm-brand-600)'} !important;
      }
    `

    // 强制同步深色类
    if (isDark) {
      doc.documentElement.classList.add('dark')
    }
    else {
      doc.documentElement.classList.remove('dark')
    }

    // 🔥 终极兜底：JavaScript DOM 遍历，强制覆盖所有浅色渐变元素的内联样式
    const forceOverrideGradients = () => {
      const lightGradientKeywords = [
        'from-red-50',
        'from-orange-50',
        'from-stone-100',
        'from-stone-50',
        'from-yellow-50',
        'from-gray-50',
        'from-slate-100',
        'from-primary-50',
        'to-primary-100',
        'to-yellow-50',
        'to-orange-50',
        'to-stone-50',
        'to-gray-50',
      ]
      const heroKeywords = ['from-primary-700', 'from-primary-600']

      doc.querySelectorAll('.bg-gradient-to-br, [class*="from-"]').forEach((rawEl) => {
        const el = rawEl as HTMLElement
        const cls = el.className || ''
        // 跳过 Hero 区域渐变
        if (heroKeywords.some(k => cls.includes(k)))
          return
        // 检测是否包含浅色渐变类
        if (lightGradientKeywords.some(k => cls.includes(k))) {
          el.style.setProperty('background-image', 'none', 'important')
          el.style.setProperty('background-color', 'var(--ui-bg-surface)', 'important')
        }
      })
    }
    // 🔧 优化 #3: 缩减延迟同步轮次，从 6 次减轻到 3 次
    forceOverrideGradients()
    setTimeout(forceOverrideGradients, 400)
    setTimeout(forceOverrideGradients, 1200)

    // 🔥 解决白屏闪烁：主题应用完毕后，再解除 iframe 内部的透明遮罩
    doc.documentElement.style.opacity = '1'
  }
  catch (e) {
    console.warn('Iframe 样式劫持失败:', e)
  }
}

function onIframeLoad() {
  syncThemeToIframe()
  // 🔧 优化 #3: 初始重载时缩减多轮定时，仅执行一次后续兜底即可
  setTimeout(() => syncThemeToIframe(), 600)
}

// 监听 html class 属性变化 (主题切换)
let observer: MutationObserver | null = null
onMounted(() => {
  observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        syncThemeToIframe()
      }
    })
  })
  observer.observe(document.documentElement, { attributes: true })
})

onUnmounted(() => {
  if (observer) {
    observer.disconnect()
  }
  // 🔧 优化 #2: 清理 iframe 内部的 observer 控制器，避免内存泄漏
  if (iframeObserver) {
    iframeObserver.disconnect()
    iframeObserver = null
  }
})
</script>

<template>
  <div class="farm-tools-page ui-page-shell ui-page-density-relaxed h-full min-h-0 w-full flex flex-col overflow-hidden">
    <!-- ═══ 移动端/中屏 顶部工具选择栏（< lg 时可见） ═══ -->
    <div v-if="!standaloneMode" class="farm-tools-mobile-toolbar ui-mobile-sticky-panel ui-mobile-action-panel lg:hidden">
      <div class="farm-tools-mobile-toolbar-head">
        <button
          class="farm-tools-menu-trigger"
          :title="sidebarVisible ? '收起目录' : '展开目录'"
          @click="toggleSidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 transition-transform duration-200" :class="{ 'rotate-180': !sidebarVisible }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
          <span>{{ sidebarVisible ? '收起目录' : '打开目录' }}</span>
        </button>
        <div class="farm-tools-mobile-toolbar-current">
          <div class="farm-tools-mobile-toolbar-eyebrow">
            农场百科工具
          </div>
          <div class="farm-tools-mobile-toolbar-title">
            <div class="shrink-0 text-base" :class="selectedMenuItem.icon" />
            <span>{{ selectedMenuItem.title }}</span>
          </div>
        </div>
      </div>

      <div class="farm-tools-tab-bar ui-bulk-actions flex flex-shrink-0 items-center gap-1.5 overflow-x-auto px-0 py-0">
        <button
          v-for="item in menuItems"
          :key="`tab-${item.id}`"
          class="farm-tool-tab flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition-all"
          :class="[
            activeArticle === item.id
              ? 'farm-tool-tab--active'
              : 'farm-tool-tab--inactive',
          ]"
          @click="selectArticle(item.id)"
        >
          <div class="text-base" :class="item.icon" />
          <span class="font-medium">{{ item.shortTitle }}</span>
        </button>
      </div>
    </div>

    <div class="farm-tools-shell h-full min-h-0 w-full flex gap-4">
      <!-- ═══ 左侧分类导航（≥lg 固定显示；<lg 通过折叠按钮浮动显示）═══ -->

      <!-- 中小屏遮罩层 -->
      <div
        v-if="!standaloneMode && sidebarVisible"
        class="farm-tools-backdrop fixed inset-0 z-20 backdrop-blur-sm lg:hidden"
        @click="sidebarVisible = false"
      />

      <aside
        v-if="!standaloneMode"
        class="farm-tools-sidebar glass-panel h-full shrink-0 flex-col rounded-2xl p-4 shadow-sm transition-all duration-300 lg:flex"
        :class="[
          // ≥lg：固定显示
          sidebarVisible ? 'flex fixed inset-y-4 left-4 z-30 lg:static lg:inset-auto' : 'hidden lg:flex',
        ]"
      >
        <h2 class="farm-tools-page-title mb-6 bg-clip-text px-2 text-xl text-transparent font-bold tracking-wide">
          农场百科工具
        </h2>

        <nav class="min-h-0 flex-1 overflow-y-auto pr-1 space-y-2">
          <div class="pt-2 space-y-2">
            <button
              v-for="item in menuItems"
              :key="item.id"
              class="w-full flex items-center justify-between rounded-xl px-4 py-3.5 text-left transition-all"
              :class="[
                activeArticle === item.id
                  ? 'farm-tools-nav-active theme-glow-soft scale-100'
                  : 'farm-tools-nav-idle',
              ]"
              @click="selectArticle(item.id)"
            >
              <div class="flex items-center gap-3">
                <div class="text-xl" :class="[item.icon, activeArticle === item.id ? 'farm-tools-nav-icon-active' : 'farm-tools-nav-icon-idle']" />
                <span class="tracking-wide">{{ item.title }}</span>
              </div>
              <div v-if="activeArticle === item.id" class="theme-glow-dot h-1.5 w-1.5 rounded-full bg-primary-500" />
            </button>
          </div>
        </nav>
      </aside>

      <!-- ═══ 右侧自适应无边界容器 ═══ -->
      <main class="farm-tools-main glass-panel relative m-0 h-full min-w-0 flex flex-1 flex-col overflow-hidden rounded-2xl p-0">
        <iframe
          ref="iframeRef"
          :src="`/nc_local_version/${activeArticle}`"
          class="h-full w-full flex-1 border-none bg-transparent outline-none"
          @load="onIframeLoad"
        />
      </main>
    </div>
  </div>
</template>

<style scoped>
.farm-tools-shell {
  align-items: stretch;
  gap: var(--ui-page-gap-current);
}

.farm-tools-sidebar {
  width: min(18.5rem, calc(100vw - 2rem));
  max-width: calc(100vw - 2rem);
}

.farm-tools-page-title {
  background-image: linear-gradient(
    90deg,
    color-mix(in srgb, var(--ui-brand-700) 88%, var(--ui-text-1) 12%),
    color-mix(in srgb, var(--ui-brand-500) 92%, var(--ui-text-1) 8%)
  );
}

.farm-tools-main {
  min-width: 0;
}

.farm-tools-mobile-toolbar {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  padding: 0.875rem;
  border: 1px solid var(--ui-border-subtle);
  border-radius: 1.25rem;
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 86%, transparent);
  box-shadow:
    0 12px 24px -24px var(--ui-shadow-panel),
    inset 0 1px 0 var(--ui-shadow-inner);
}

.farm-tools-mobile-toolbar-head {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  min-width: 0;
}

.farm-tools-mobile-toolbar-current {
  min-width: 0;
  flex: 1 1 auto;
}

.farm-tools-mobile-toolbar-eyebrow {
  color: var(--ui-text-3);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.farm-tools-mobile-toolbar-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.3rem;
  min-width: 0;
  color: var(--ui-text-1);
  font-size: 0.95rem;
  line-height: 1.4;
  font-weight: 700;
}

.farm-tools-mobile-toolbar-title span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (min-width: 1024px) {
  .farm-tools-sidebar {
    width: 18.5rem;
    max-width: none;
  }
}

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

/* iframe 内部背景透明，以便透出 Vue 系统的真实玻璃背景 */
iframe {
  color-scheme: light dark;
}

/* ═══ 移动端/中屏顶部 Tab 栏 ═══ */
.farm-tools-tab-bar {
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE */
}
.farm-tools-tab-bar::-webkit-scrollbar {
  display: none; /* Chrome/Safari */
}

.farm-tools-menu-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.5rem;
  padding: 0.625rem 0.875rem;
  border-radius: 0.95rem;
  border: 1px solid color-mix(in srgb, var(--ui-border-subtle) 55%, var(--farm-brand-500) 45%);
  background: color-mix(in srgb, var(--farm-brand-500) 10%, transparent);
  color: var(--ui-text-1);
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.farm-tools-menu-trigger:hover {
  background: color-mix(in srgb, var(--farm-brand-500) 16%, transparent);
  box-shadow: 0 0 12px color-mix(in srgb, var(--farm-brand-500) 24%, transparent);
}

.farm-tool-tab--active {
  background: color-mix(in srgb, var(--farm-brand-500) 14%, transparent);
  color: var(--ui-text-1);
  border: 1px solid color-mix(in srgb, var(--ui-border-subtle) 55%, var(--farm-brand-500) 45%);
  box-shadow: 0 0 12px color-mix(in srgb, var(--farm-brand-500) 22%, transparent);
}

.farm-tool-tab--inactive {
  background: var(--ui-bg-surface);
  color: var(--ui-text-2);
  border: 1px solid var(--ui-border-subtle);
}
.farm-tool-tab--inactive:hover {
  background: var(--ui-bg-surface-raised);
  color: var(--ui-text-1);
}

.farm-tools-backdrop {
  background: var(--ui-overlay-backdrop) !important;
}

.farm-tools-nav-active {
  background: color-mix(in srgb, var(--farm-brand-500) 12%, var(--ui-bg-surface-raised) 88%) !important;
  border: 1px solid color-mix(in srgb, var(--ui-border-subtle) 55%, var(--farm-brand-500) 45%) !important;
  color: color-mix(in srgb, var(--farm-brand-700) 76%, var(--ui-text-1)) !important;
  font-weight: 700;
}

.farm-tools-nav-idle {
  border: 1px solid transparent !important;
  background: color-mix(in srgb, var(--ui-bg-surface) 66%, transparent) !important;
  color: var(--ui-text-1) !important;
  font-weight: 500;
  opacity: 0.84;
}

.farm-tools-nav-idle:hover {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 82%, transparent) !important;
  color: var(--ui-text-1) !important;
  opacity: 1;
}

.farm-tools-nav-icon-active {
  color: var(--farm-brand-600) !important;
}

.farm-tools-nav-icon-idle {
  color: var(--ui-text-2) !important;
}

.theme-glow-soft {
  box-shadow: 0 0 15px color-mix(in srgb, var(--farm-brand-500) 22%, transparent);
}

.theme-glow-dot {
  box-shadow: 0 0 8px color-mix(in srgb, var(--farm-brand-500) 70%, transparent);
}
</style>
