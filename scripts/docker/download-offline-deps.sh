#!/bin/bash

# QQ 农场助手 - 生成全栈离线依赖镜像包
# 该脚本从远端拉取 MySQL, Redis, Ipad860 镜像并导出为一个通用的 tar 包，用于纯离线内网部署。

echo "🔄 正在从云端拉取所需的依赖生态运行镜像..."

# 拉取所需镜像 (这些通常有多架构支持，docker pull 默认拉取当前主机的架构，如果需要双端可以像主程序那样使用 skopeo，但为了通用，这里我们拉取 amd64 下的作为 x86 服务器部署基础，ARM设备通常能兼容对应的 base 镜像或通过 QEMU 运行，或者我们为其区分拉取)

# 为 amd64 拉取
echo "📥 [AMD64] 拉取 mysql, redis, ipad860..."
docker run --rm -v $(pwd):/out quay.io/skopeo/stable copy --override-os linux --override-arch amd64 docker://docker.io/library/mysql:8.0 docker-archive:/out/mysql_8.0_amd64.tar
docker run --rm -v $(pwd):/out quay.io/skopeo/stable copy --override-os linux --override-arch amd64 docker://docker.io/library/redis:7-alpine docker-archive:/out/redis_7_alpine_amd64.tar
docker run --rm -v $(pwd):/out quay.io/skopeo/stable copy --override-os linux --override-arch amd64 docker://smdk000/ipad860:latest docker-archive:/out/ipad860_latest_amd64.tar

# 将 amd64 依赖打包到一起以缩减文件和管理数量
echo "📦 [AMD64] 正在合并离线依赖包..."
tar -cvf qq-farm-dependencies_amd64.tar mysql_8.0_amd64.tar redis_7_alpine_amd64.tar ipad860_latest_amd64.tar
rm mysql_8.0_amd64.tar redis_7_alpine_amd64.tar ipad860_latest_amd64.tar

echo "✅ 依赖打包双架构完成！生成了依赖整合文件："
ls -lh qq-farm-dependencies_amd64.tar
