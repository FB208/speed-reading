import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import auth, books, reading, bookshelf
from app.core.config import settings
from app.core.security import hash_password
from app.db.database import Base, SessionLocal, engine
from app.models import models


def sync_admin_user() -> None:
    """同步管理员账号（每次启动执行）"""
    admin_username = settings.ADMIN_USERNAME.strip()
    admin_password = settings.ADMIN_PASSWORD.strip()
    admin_email = settings.ADMIN_EMAIL.strip()

    if not admin_username or not admin_password or not admin_email:
        raise RuntimeError(
            "管理员配置不完整，请检查 ADMIN_USERNAME/ADMIN_PASSWORD/ADMIN_EMAIL"
        )

    db = SessionLocal()
    try:
        admin_users = db.query(models.User).filter(models.User.is_admin == True).all()

        if len(admin_users) > 1:
            raise RuntimeError("检测到多个管理员账号，请清理数据后重试")

        target_admin = admin_users[0] if admin_users else None
        target_admin_id = target_admin.id if target_admin else None

        username_conflict_query = db.query(models.User).filter(
            models.User.username == admin_username
        )
        if target_admin_id is not None:
            username_conflict_query = username_conflict_query.filter(
                models.User.id != target_admin_id
            )
        username_conflict = username_conflict_query.first()
        if username_conflict:
            raise RuntimeError(
                f"管理员用户名冲突：{admin_username} 已被普通用户占用，请调整 .env 后重试"
            )

        email_conflict_query = db.query(models.User).filter(
            models.User.email == admin_email
        )
        if target_admin_id is not None:
            email_conflict_query = email_conflict_query.filter(
                models.User.id != target_admin_id
            )
        email_conflict = email_conflict_query.first()
        if email_conflict:
            raise RuntimeError(
                f"管理员邮箱冲突：{admin_email} 已被普通用户占用，请调整 .env 后重试"
            )

        if target_admin:
            target_admin.username = admin_username
            target_admin.email = admin_email
            target_admin.hashed_password = hash_password(admin_password)
            target_admin.is_admin = True
        else:
            db.add(
                models.User(
                    username=admin_username,
                    email=admin_email,
                    hashed_password=hash_password(admin_password),
                    is_admin=True,
                )
            )

        db.commit()
    finally:
        db.close()


# 创建数据库表（如果不存在）
Base.metadata.create_all(bind=engine)
sync_admin_user()

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
app.include_router(bookshelf.router)

# 静态文件服务（封面图片）
uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
covers_dir = os.path.join(uploads_dir, "covers")
book_images_dir = os.path.join(uploads_dir, "book_images")
os.makedirs(covers_dir, exist_ok=True)
os.makedirs(book_images_dir, exist_ok=True)
app.mount("/covers", StaticFiles(directory=covers_dir), name="covers")
app.mount("/book-images", StaticFiles(directory=book_images_dir), name="book-images")


@app.get("/")
def root():
    return {"message": "欢迎使用快速阅读 API", "docs": "/docs", "version": "1.0.0"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}
