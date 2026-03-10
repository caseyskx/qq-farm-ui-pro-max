#!/usr/bin/env bash
# QQ 农场 Bot - 一键开发启动脚本 (ARM Mac)
# 先关闭旧进程 → 编译前端 → 启动后端，方便改代码和测试

set -e

# 切换到脚本所在目录（项目根目录）
cd "$(dirname "$0")"

DEV_WEB_DIST_DIR="$PWD/web/.dist-dev"

# 关闭占用指定端口的进程
kill_port() {
    local port=$1
    local pids
    pids=$(lsof -ti:"$port" 2>/dev/null) || true
    if [ -n "$pids" ]; then
        echo "  → 关闭端口 $port 上的进程 (PID: $pids)"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
}

# 预处理前端构建目录，开发环境默认使用独立目录，避免被历史产物权限污染
prepare_web_dist() {
    local dist_dir="${WEB_DIST_DIR:-web/dist}"

    if [ ! -e "$dist_dir" ]; then
        return
    fi

    echo "🧹 预处理前端产物目录: $dist_dir"

    if rm -rf "$dist_dir" 2>/dev/null; then
        echo "✅ 已清理旧产物目录"
        return
    fi

    echo "❌ 产物目录不可写: $dist_dir"
    echo "   请检查该目录权限后重试。"
    exit 1
}

echo "=========================================="
echo "  QQ 农场 Bot - 开发环境启动"
echo "  (ARM Mac 适用)"
echo "=========================================="

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    echo "❌ 未检测到 pnpm，请先安装: npm install -g pnpm"
    exit 1
fi

echo ""
echo "🛑 步骤 0: 关闭已运行的前后端进程..."
kill_port 3000   # 后端管理面板
kill_port 5173  # Vite 前端开发服务器（若单独运行过）
echo "✅ 端口已释放"
echo ""

# 检查依赖是否已安装
if [ ! -d "node_modules" ]; then
    echo "📦 首次运行，正在安装依赖..."
    pnpm install -r
fi

echo "🔨 步骤 1/2: 编译前端..."
export WEB_DIST_DIR="$DEV_WEB_DIST_DIR"
echo "📁 开发环境前端输出目录: $WEB_DIST_DIR"
prepare_web_dist
pnpm build:web
if [ $? -ne 0 ]; then
    echo "❌ 前端编译失败"
    exit 1
fi
echo "✅ 前端编译完成"
echo ""

echo "🚀 步骤 2/2: 启动后端..."
echo "🔁 启动前再次确认 3000 端口未被抢占..."
kill_port 3000
echo "   (按 Ctrl+C 停止)"
echo "=========================================="
pnpm dev:core
