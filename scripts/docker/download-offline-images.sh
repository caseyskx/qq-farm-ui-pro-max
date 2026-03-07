#!/bin/bash

# QQ 农场助手 - 生成离线镜像包
# 该脚本从远端 Docker Hub 拉取已构建好的架构镜像并导出，规避本地交叉网络受限或编译卡死问题。

VERSION=${1:-"v4.2.0"}
IMAGE="smdk000/qq-farm-bot-ui:${VERSION}"

echo "🔄 正在从云端拉取 AMD64 架构镜像..."
docker pull --platform linux/amd64 ${IMAGE}
echo "📦 正在导出 AMD64 离线包..."
docker save ${IMAGE} -o qq-farm-ui-pro-max_${VERSION}_amd64.tar

echo "🔄 正在从云端拉取 ARM64 架构镜像..."
docker pull --platform linux/arm64 ${IMAGE}
echo "📦 正在导出 ARM64 离线包..."
docker save ${IMAGE} -o qq-farm-ui-pro-max_${VERSION}_arm64.tar

echo "✅ 离线打包双架构完成！生成了以下文件："
ls -lh qq-farm-ui-pro-max_${VERSION}_amd64.tar qq-farm-ui-pro-max_${VERSION}_arm64.tar
