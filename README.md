# 快速阅读应用

## 项目结构

```
.
├── backend/                 # FastAPI后端
│   ├── app/
│   │   ├── api/            # API路由
│   │   ├── core/           # 核心配置
│   │   ├── db/             # 数据库
│   │   ├── models/         # 数据模型
│   │   ├── services/       # 业务逻辑
│   │   └── utils/          # 工具函数
│   ├── requirements.txt
│   └── .env
├── frontend/               # React前端
│   ├── src/
│   │   ├── components/     # 组件
│   │   ├── pages/          # 页面
│   │   ├── services/       # API服务
│   │   └── styles/         # 样式
│   └── package.json
└── README.md
```

## 快速开始

### 1. 安装MySQL和Redis

确保本地已安装MySQL和Redis，并创建数据库：

```sql
CREATE DATABASE speed_reading CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. 配置后端

```bash
cd backend

# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
copy .env.example .env
# 编辑 .env 文件，填入你的配置

# 启动服务器
uvicorn app.main:app --reload
```

后端将在 http://localhost:8000 运行

### 3. 配置前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm start
```

前端将在 http://localhost:3000 运行

## 使用说明

1. **注册/登录**：创建账户或登录已有账户
2. **上传书籍**：支持.txt和.docx格式，系统自动处理分段
3. **选择书籍**：从书库中选择想要阅读的书籍
4. **开始测试**：系统会记录阅读时间，生成5道选择题
5. **查看结果**：测试完成后查看阅读速度和理解程度
