import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from app.api import auth, books, reading
from app.db.database import engine, Base

# 创建数据库表（如果不存在）
Base.metadata.create_all(bind=engine)


# 自动更新数据库结构（添加缺失的字段）
def update_database_schema():
    """检查并添加缺失的数据库字段"""
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    # books 表需要添加的新字段
    schema_updates = [
        ("books", "cover_image", "VARCHAR(255) NULL"),
    ]

    for table_name, col_name, col_def in schema_updates:
        if table_name not in existing_tables:
            continue

        existing_columns = inspector.get_columns(table_name)
        existing_column_names = [c["name"] for c in existing_columns]

        if col_name not in existing_column_names:
            try:
                with engine.connect() as conn:
                    alter_stmt = f"ALTER TABLE {table_name} ADD COLUMN {col_def}"
                    conn.execute(text(alter_stmt))
                    conn.commit()
                print(f"✓ 已添加字段: {table_name}.{col_name}")
            except Exception as e:
                print(f"✗ 添加字段失败 {table_name}.{col_name}: {e}")


update_database_schema()

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

# 静态文件服务（封面图片）
import os

uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
covers_dir = os.path.join(uploads_dir, "covers")
os.makedirs(covers_dir, exist_ok=True)
app.mount("/covers", StaticFiles(directory=covers_dir), name="covers")


@app.get("/")
def root():
    return {"message": "欢迎使用快速阅读 API", "docs": "/docs", "version": "1.0.0"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}
