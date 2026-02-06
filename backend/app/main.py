from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, books, reading
from app.db.database import engine, Base

# 创建数据库表
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="快速阅读 API",
    description="一个测试阅读速度和理解程度的应用",
    version="1.0.0",
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth.router)
app.include_router(books.router)
app.include_router(reading.router)


@app.get("/")
def root():
    return {"message": "欢迎使用快速阅读 API", "docs": "/docs", "version": "1.0.0"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}
