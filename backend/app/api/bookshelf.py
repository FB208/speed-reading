from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models import models, schemas

router = APIRouter(prefix="/bookshelf", tags=["我的书架"])


@router.get("/", response_model=List[schemas.BookshelfBookResponse])
def get_my_bookshelf(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """获取当前用户书架"""
    items = (
        db.query(models.BookshelfItem)
        .filter(models.BookshelfItem.user_id == current_user.id)
        .order_by(models.BookshelfItem.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    response = []
    for item in items:
        book = item.book
        if not book:
            continue

        completed_paragraphs = (
            db.query(func.count(models.ReadingProgress.id))
            .filter(
                models.ReadingProgress.user_id == current_user.id,
                models.ReadingProgress.book_id == book.id,
                models.ReadingProgress.is_completed == True,
            )
            .scalar()
        )
        completed_paragraphs = int(completed_paragraphs or 0)
        total_paragraphs = int(book.total_paragraphs or 0)
        progress_percentage = (
            round((completed_paragraphs / total_paragraphs) * 100, 2)
            if total_paragraphs > 0
            else 0.0
        )

        is_uploaded_by_me = book.uploaded_by_user_id == current_user.id
        response.append(
            {
                "id": book.id,
                "title": book.title,
                "author": book.author,
                "filename": book.filename,
                "cover_image": book.cover_image,
                "total_paragraphs": total_paragraphs,
                "created_at": book.created_at,
                "uploaded_by_user_id": book.uploaded_by_user_id,
                "uploaded_by_username": book.uploader.username
                if book.uploader
                else None,
                "is_uploaded_by_me": is_uploaded_by_me,
                "can_manage": current_user.is_admin or is_uploaded_by_me,
                "completed_paragraphs": completed_paragraphs,
                "progress_percentage": progress_percentage,
                "bookshelf_added_at": item.created_at,
            }
        )

    return response


@router.delete("/{book_id}")
def remove_from_bookshelf(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """将书籍从我的书架移除"""
    bookshelf_item = (
        db.query(models.BookshelfItem)
        .filter(
            models.BookshelfItem.user_id == current_user.id,
            models.BookshelfItem.book_id == book_id,
        )
        .first()
    )
    if not bookshelf_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="该书籍不在你的书架中",
        )

    db.delete(bookshelf_item)
    db.commit()
    return {"message": "已移出书架", "book_id": book_id}
