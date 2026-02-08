from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models import models
from app.core.security import verify_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> models.User:
    """获取当前登录用户"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无效的认证凭证",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = verify_token(token)
    if payload is None:
        raise credentials_exception

    username: str = payload.get("sub")
    if username is None:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise credentials_exception

    return user


async def get_current_active_user(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    """获取当前活跃用户"""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="用户已被禁用"
        )
    return current_user


def can_manage_book(current_user: models.User, book: models.Book) -> bool:
    """判断当前用户是否有管理书籍权限"""
    return current_user.is_admin or book.uploaded_by_user_id == current_user.id


def ensure_book_in_bookshelf(db: Session, user_id: int, book_id: int) -> None:
    """确保书籍在用户书架中（幂等）"""
    bookshelf_item = (
        db.query(models.BookshelfItem)
        .filter(
            models.BookshelfItem.user_id == user_id,
            models.BookshelfItem.book_id == book_id,
        )
        .first()
    )
    if bookshelf_item:
        return

    db.add(models.BookshelfItem(user_id=user_id, book_id=book_id))
    db.commit()
