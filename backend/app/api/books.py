from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.database import get_db
from app.models import models, schemas
from app.services.book_processor import BookProcessor
from app.utils.cover_extractor import CoverExtractor
from app.api.deps import get_current_user
import os
import shutil
from datetime import datetime

router = APIRouter(prefix="/books", tags=["书籍"])

# 确保上传目录存在
UPLOAD_DIR = "uploads"
COVERS_DIR = os.path.join(UPLOAD_DIR, "covers")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(COVERS_DIR, exist_ok=True)


@router.get("/", response_model=List[schemas.BookResponse])
def get_books(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """获取书籍列表"""
    books = db.query(models.Book).offset(skip).limit(limit).all()
    return books


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
    return book


@router.post("/upload", response_model=schemas.BookResponse)
async def upload_book(
    file: UploadFile = File(...),
    title: Optional[str] = None,
    author: Optional[str] = None,
    cover: Optional[UploadFile] = File(None),  # 可选的封面上传
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """上传书籍文件（支持手动上传封面或自动提取）"""
    # 检查文件类型
    allowed_extensions = (".txt", ".docx", ".epub", ".mobi", ".pdf")
    if not file.filename or not file.filename.lower().endswith(allowed_extensions):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"仅支持 {', '.join(allowed_extensions)} 格式的文件",
        )

    # 生成唯一文件名
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_filename = f"{timestamp}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)

    # 保存文件
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

    # 如果没有提供标题，使用文件名（不含扩展名）
    if not title:
        title = os.path.splitext(file.filename)[0]

    # 处理封面
    cover_extractor = CoverExtractor(COVERS_DIR)
    cover_image = None

    try:
        # 如果有手动上传的封面
        manual_cover_data = None
        manual_cover_filename = None
        if cover and cover.filename:
            manual_cover_data = await cover.read()
            manual_cover_filename = cover.filename
            cover.file.close()

        # 提取或保存封面
        cover_image = cover_extractor.extract_cover(
            file_path,
            manual_cover=manual_cover_data,
            manual_filename=manual_cover_filename,
        )
    except Exception as e:
        print(f"封面处理失败: {str(e)}")
        # 封面处理失败不影响书籍上传

    # 创建书籍记录
    db_book = models.Book(
        title=title,
        author=author,
        filename=safe_filename,
        cover_image=cover_image,
        total_paragraphs=0,
    )
    db.add(db_book)
    db.commit()
    db.refresh(db_book)

    # 异步处理书籍内容
    try:
        processor = BookProcessor(db)
        await processor.process_book(db_book.id, file_path)
    except Exception as e:
        # 如果处理失败，删除书籍记录、文件和封面
        db.delete(db_book)
        db.commit()
        os.remove(file_path)
        if cover_image:
            cover_extractor.delete_cover(cover_image)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"书籍处理失败: {str(e)}",
        )

    return db_book


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
    paragraph = (
        db.query(models.Paragraph)
        .filter(
            models.Paragraph.id == paragraph_id, models.Paragraph.book_id == book_id
        )
        .first()
    )

    if not paragraph:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="段落不存在")

    # 更新内容和字数
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
    paragraph = (
        db.query(models.Paragraph)
        .filter(
            models.Paragraph.id == paragraph_id, models.Paragraph.book_id == book_id
        )
        .first()
    )

    if not paragraph:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="段落不存在")

    # 删除该段落相关的所有问题
    db.query(models.Question).filter(
        models.Question.paragraph_id == paragraph_id
    ).delete()

    # 删除该段落相关的所有阅读进度
    db.query(models.ReadingProgress).filter(
        models.ReadingProgress.paragraph_id == paragraph_id
    ).delete()

    # 删除该段落相关的所有测试结果
    test_results = (
        db.query(models.TestResult)
        .filter(models.TestResult.paragraph_id == paragraph_id)
        .all()
    )
    for test_result in test_results:
        db.query(models.UserAnswer).filter(
            models.UserAnswer.test_result_id == test_result.id
        ).delete()
        db.delete(test_result)

    # 获取被删除段落的序号
    deleted_sequence = paragraph.sequence

    # 删除段落
    db.delete(paragraph)
    db.commit()

    # 重新排序剩余的段落
    paragraphs = (
        db.query(models.Paragraph)
        .filter(models.Paragraph.book_id == book_id)
        .order_by(models.Paragraph.sequence)
        .all()
    )

    for i, p in enumerate(paragraphs, 1):
        p.sequence = i

    # 更新书籍段落数
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if book:
        book.total_paragraphs = len(paragraphs)
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

    # 获取封面路径
    cover_image = book.cover_image

    # 获取所有段落ID
    paragraph_ids = [
        p.id
        for p in db.query(models.Paragraph)
        .filter(models.Paragraph.book_id == book_id)
        .all()
    ]

    # 删除相关问题
    for pid in paragraph_ids:
        db.query(models.Question).filter(models.Question.paragraph_id == pid).delete()

    # 删除相关阅读进度
    db.query(models.ReadingProgress).filter(
        models.ReadingProgress.book_id == book_id
    ).delete()

    # 删除相关测试结果
    test_results = (
        db.query(models.TestResult)
        .filter(models.TestResult.paragraph_id.in_(paragraph_ids))
        .all()
    )
    for test_result in test_results:
        db.query(models.UserAnswer).filter(
            models.UserAnswer.test_result_id == test_result.id
        ).delete()
        db.delete(test_result)

    # 删除所有段落
    db.query(models.Paragraph).filter(models.Paragraph.book_id == book_id).delete()

    # 删除书籍文件
    try:
        file_path = os.path.join(UPLOAD_DIR, book.filename)
        if os.path.exists(file_path):
            os.remove(file_path)
    except Exception as e:
        print(f"删除文件失败: {str(e)}")

    # 删除封面图片
    if cover_image:
        try:
            cover_extractor = CoverExtractor(COVERS_DIR)
            cover_extractor.delete_cover(cover_image)
        except Exception as e:
            print(f"删除封面失败: {str(e)}")

    # 删除书籍记录
    db.delete(book)
    db.commit()
