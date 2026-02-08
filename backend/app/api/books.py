import os
import shutil
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import can_manage_book, ensure_book_in_bookshelf, get_current_user
from app.db.database import get_db
from app.models import models, schemas
from app.services.book_processor import BookProcessor
from app.utils.cover_extractor import CoverExtractor

router = APIRouter(prefix="/books", tags=["书籍"])

# 确保上传目录存在
UPLOAD_DIR = "uploads"
COVERS_DIR = os.path.join(UPLOAD_DIR, "covers")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(COVERS_DIR, exist_ok=True)


def serialize_book(book: models.Book, current_user: models.User) -> dict:
    """构建书籍响应数据"""
    uploaded_by_username = book.uploader.username if book.uploader else None
    is_uploaded_by_me = book.uploaded_by_user_id == current_user.id
    return {
        "id": book.id,
        "title": book.title,
        "author": book.author,
        "filename": book.filename,
        "cover_image": book.cover_image,
        "total_paragraphs": book.total_paragraphs,
        "created_at": book.created_at,
        "uploaded_by_user_id": book.uploaded_by_user_id,
        "uploaded_by_username": uploaded_by_username,
        "is_uploaded_by_me": is_uploaded_by_me,
        "can_manage": current_user.is_admin or is_uploaded_by_me,
    }


@router.get("/", response_model=List[schemas.BookResponse])
def get_books(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """获取书籍列表"""
    books = db.query(models.Book).offset(skip).limit(limit).all()
    return [serialize_book(book, current_user) for book in books]


@router.get("/{book_id}", response_model=schemas.BookResponse)
def get_book(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """获取单本书籍信息"""
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="书籍不存在")
    return serialize_book(book, current_user)


@router.post("/upload", response_model=schemas.BookResponse)
async def upload_book(
    file: UploadFile = File(...),
    title: Optional[str] = None,
    author: Optional[str] = None,
    cover: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """上传书籍文件（支持手动上传封面或自动提取）"""
    allowed_extensions = (".txt", ".docx", ".epub", ".mobi", ".pdf")
    if not file.filename or not file.filename.lower().endswith(allowed_extensions):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"仅支持 {', '.join(allowed_extensions)} 格式的文件",
        )

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_filename = f"{timestamp}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"文件保存失败: {str(e)}",
        )
    finally:
        file.file.close()

    if not title:
        title = os.path.splitext(file.filename)[0]

    cover_extractor = CoverExtractor(COVERS_DIR)
    cover_image = None

    try:
        manual_cover_data = None
        manual_cover_filename = None
        if cover and cover.filename:
            manual_cover_data = await cover.read()
            manual_cover_filename = cover.filename
            cover.file.close()

        cover_image = cover_extractor.extract_cover(
            file_path,
            manual_cover=manual_cover_data,
            manual_filename=manual_cover_filename,
        )
    except Exception as e:
        print(f"封面处理失败: {str(e)}")

    db_book = models.Book(
        title=title,
        author=author,
        filename=safe_filename,
        cover_image=cover_image,
        total_paragraphs=0,
        uploaded_by_user_id=current_user.id,
    )
    db.add(db_book)
    db.commit()
    db.refresh(db_book)

    try:
        processor = BookProcessor(db)
        await processor.process_book(db_book.id, file_path)
    except Exception as e:
        db.delete(db_book)
        db.commit()
        os.remove(file_path)
        if cover_image:
            cover_extractor.delete_cover(cover_image)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"书籍处理失败: {str(e)}",
        )

    ensure_book_in_bookshelf(db, current_user.id, db_book.id)
    db.refresh(db_book)
    return serialize_book(db_book, current_user)


@router.get("/{book_id}/paragraphs", response_model=List[schemas.ParagraphResponse])
def get_paragraphs(
    book_id: int,
    skip: int = 0,
    limit: int = 1000,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """获取书籍的所有段落列表"""
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="书籍不存在")

    paragraphs = (
        db.query(models.Paragraph)
        .filter(models.Paragraph.book_id == book_id)
        .order_by(models.Paragraph.sequence)
        .offset(skip)
        .limit(limit)
        .all()
    )

    return paragraphs


@router.get(
    "/{book_id}/paragraphs/{paragraph_id}", response_model=schemas.ParagraphResponse
)
def get_paragraph(
    book_id: int,
    paragraph_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """获取单个段落"""
    paragraph = (
        db.query(models.Paragraph)
        .filter(
            models.Paragraph.id == paragraph_id, models.Paragraph.book_id == book_id
        )
        .first()
    )

    if not paragraph:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="段落不存在")

    return paragraph


@router.put(
    "/{book_id}/paragraphs/{paragraph_id}", response_model=schemas.ParagraphResponse
)
def update_paragraph(
    book_id: int,
    paragraph_id: int,
    content: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """更新段落内容"""
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="书籍不存在")
    if not can_manage_book(current_user, book):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="无权限修改此书籍"
        )

    paragraph = (
        db.query(models.Paragraph)
        .filter(
            models.Paragraph.id == paragraph_id, models.Paragraph.book_id == book_id
        )
        .first()
    )

    if not paragraph:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="段落不存在")

    paragraph.content = content
    paragraph.word_count = len(content)
    db.commit()
    db.refresh(paragraph)

    return paragraph


@router.delete(
    "/{book_id}/paragraphs/{paragraph_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_paragraph(
    book_id: int,
    paragraph_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """删除段落"""
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="书籍不存在")
    if not can_manage_book(current_user, book):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="无权限删除此书籍"
        )

    paragraph = (
        db.query(models.Paragraph)
        .filter(
            models.Paragraph.id == paragraph_id, models.Paragraph.book_id == book_id
        )
        .first()
    )

    if not paragraph:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="段落不存在")

    deleted_sequence = paragraph.sequence

    db.query(models.TestResult).filter(
        models.TestResult.paragraph_id == paragraph_id
    ).delete(synchronize_session=False)

    db.query(models.ReadingProgress).filter(
        models.ReadingProgress.paragraph_id == paragraph_id
    ).delete(synchronize_session=False)

    db.query(models.Question).filter(
        models.Question.paragraph_id == paragraph_id
    ).delete(synchronize_session=False)

    db.delete(paragraph)

    db.query(models.Paragraph).filter(
        models.Paragraph.book_id == book_id,
        models.Paragraph.sequence > deleted_sequence,
    ).update(
        {models.Paragraph.sequence: models.Paragraph.sequence - 1},
        synchronize_session=False,
    )

    if book:
        book.total_paragraphs = (
            db.query(models.Paragraph)
            .filter(models.Paragraph.book_id == book_id)
            .count()
        ) - 1

    db.commit()


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_book(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """删除整本书"""
    book = db.query(models.Book).filter(models.Book.id == book_id).first()

    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="书籍不存在")
    if not can_manage_book(current_user, book):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="无权限删除此书籍"
        )

    cover_image = book.cover_image
    filename = book.filename

    paragraph_ids_subquery = db.query(models.Paragraph.id).filter(
        models.Paragraph.book_id == book_id
    )

    test_result_ids_subquery = db.query(models.TestResult.id).filter(
        models.TestResult.paragraph_id.in_(paragraph_ids_subquery)
    )

    db.query(models.UserAnswer).filter(
        models.UserAnswer.test_result_id.in_(test_result_ids_subquery)
    ).delete(synchronize_session=False)

    db.query(models.TestResult).filter(
        models.TestResult.paragraph_id.in_(paragraph_ids_subquery)
    ).delete(synchronize_session=False)

    db.query(models.ReadingProgress).filter(
        models.ReadingProgress.book_id == book_id
    ).delete(synchronize_session=False)

    db.query(models.Question).filter(
        models.Question.paragraph_id.in_(paragraph_ids_subquery)
    ).delete(synchronize_session=False)

    db.query(models.Paragraph).filter(models.Paragraph.book_id == book_id).delete(
        synchronize_session=False
    )

    db.query(models.BookshelfItem).filter(
        models.BookshelfItem.book_id == book_id
    ).delete(synchronize_session=False)

    db.delete(book)
    db.commit()

    try:
        file_path = os.path.join(UPLOAD_DIR, filename)
        if os.path.exists(file_path):
            os.remove(file_path)
    except Exception as e:
        print(f"删除文件失败: {str(e)}")

    if cover_image:
        try:
            cover_extractor = CoverExtractor(COVERS_DIR)
            cover_extractor.delete_cover(cover_image)
        except Exception as e:
            print(f"删除封面失败: {str(e)}")
