# ============================================
# Stage 1: 构建前端
# ============================================
FROM node:18-alpine AS frontend-build

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ .

# 生产环境使用空的 API base URL（通过 nginx 同源代理）
RUN REACT_APP_API_BASE_URL="" npm run build

# ============================================
# Stage 2: 生产镜像（Python + Nginx）
# ============================================
FROM python:3.11-slim

# 安装 nginx
RUN apt-get update && \
    apt-get install -y --no-install-recommends nginx && \
    rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端代码
COPY backend/ .

# 复制前端构建产物到 nginx 目录
COPY --from=frontend-build /app/build /usr/share/nginx/html

# 配置 nginx
RUN rm -f /etc/nginx/sites-enabled/default
COPY docker/nginx.conf /etc/nginx/conf.d/speed-reading.conf

# 创建上传目录
RUN mkdir -p /app/uploads/covers

# 复制启动脚本
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
