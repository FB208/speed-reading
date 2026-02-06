#!/bin/bash
set -e

# 创建上传目录（如果不存在）
mkdir -p /app/uploads/covers

# 启动后端服务（后台运行）
cd /app
uvicorn app.main:app --host 0.0.0.0 --port 8000 &

# 启动 nginx（前台运行，保持容器存活）
nginx -g 'daemon off;'
