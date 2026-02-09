import random

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.api.deps import ensure_book_in_bookshelf, get_current_user
from app.db.database import get_db
from app.models import models, schemas
from app.services.reading_service import (
    build_question_map,
    clear_question_task,
    get_questions_response,
    is_question_generating,
    serialize_paragraph,
    start_question_generation,
)

router = APIRouter(prefix="/reading", tags=["阅读测试"])


@router.get("/next-paragraph/{book_id}", response_model=dict)
def get_next_paragraph(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """获取下一篇未读的段落（不包含问题，立即返回）"""
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="书籍不存在")

    ensure_book_in_bookshelf(db, current_user.id, book_id)

    completed_paragraph_ids_query = db.query(
        models.ReadingProgress.paragraph_id
    ).filter(
        models.ReadingProgress.user_id == current_user.id,
        models.ReadingProgress.book_id == book_id,
        models.ReadingProgress.is_completed == True,
    )

    completed_count = (
        db.query(func.count(models.ReadingProgress.id))
        .filter(
            models.ReadingProgress.user_id == current_user.id,
            models.ReadingProgress.book_id == book_id,
            models.ReadingProgress.is_completed == True,
        )
        .scalar()
        or 0
    )

    # 查找下一个未完成的段落
    next_paragraph = (
        db.query(models.Paragraph)
        .filter(
            models.Paragraph.book_id == book_id,
            ~models.Paragraph.id.in_(completed_paragraph_ids_query),
        )
        .order_by(models.Paragraph.sequence)
        .first()
    )

    if not next_paragraph:
        return {
            "message": "恭喜！你已经完成了这本书的所有段落",
            "paragraph": None,
            "progress": {
                "completed": completed_count,
                "total": db.query(models.Paragraph)
                .filter(models.Paragraph.book_id == book_id)
                .count(),
            },
        }

    total_paragraphs = (
        db.query(models.Paragraph).filter(models.Paragraph.book_id == book_id).count()
    )

    # 检查是否已生成问题
    existing_questions = (
        db.query(models.Question)
        .filter(models.Question.paragraph_id == next_paragraph.id)
        .count()
    )

    if existing_questions == 0:
        start_question_generation(next_paragraph.id, next_paragraph.content)

    return {
        "paragraph": serialize_paragraph(next_paragraph),
        "questions_ready": existing_questions > 0,
        "questions_generating": is_question_generating(next_paragraph.id),
        "progress": {
            "completed": completed_count,
            "total": total_paragraphs,
            "current": next_paragraph.sequence,
        },
    }


@router.get("/guest/random-paragraph", response_model=dict)
def get_guest_random_paragraph(db: Session = Depends(get_db)):
    """游客随机获取一段文本"""
    total_paragraphs = db.query(models.Paragraph).count()
    if total_paragraphs == 0:
        return {
            "message": "暂无可用段落",
            "paragraph": None,
            "questions_ready": False,
            "questions_generating": False,
        }

    random_offset = random.randint(0, total_paragraphs - 1)
    paragraph = (
        db.query(models.Paragraph)
        .order_by(models.Paragraph.id)
        .offset(random_offset)
        .first()
    )

    if not paragraph:
        return {
            "message": "暂无可用段落",
            "paragraph": None,
            "questions_ready": False,
            "questions_generating": False,
        }

    existing_questions = (
        db.query(models.Question)
        .filter(models.Question.paragraph_id == paragraph.id)
        .count()
    )
    if existing_questions == 0:
        start_question_generation(paragraph.id, paragraph.content)

    return {
        "paragraph": serialize_paragraph(paragraph),
        "questions_ready": existing_questions > 0,
        "questions_generating": is_question_generating(paragraph.id),
    }


@router.get("/questions/{paragraph_id}", response_model=dict)
def get_questions(
    paragraph_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """获取段落的问题（用户阅读完成后调用）"""
    paragraph = (
        db.query(models.Paragraph).filter(models.Paragraph.id == paragraph_id).first()
    )

    if not paragraph:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="段落不存在")

    return get_questions_response(db, paragraph_id, paragraph.content)


@router.get("/guest/questions/{paragraph_id}", response_model=dict)
def get_guest_questions(paragraph_id: int, db: Session = Depends(get_db)):
    """游客获取段落的问题"""
    paragraph = (
        db.query(models.Paragraph).filter(models.Paragraph.id == paragraph_id).first()
    )

    if not paragraph:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="段落不存在")

    return get_questions_response(db, paragraph_id, paragraph.content)


@router.post("/submit-test", response_model=schemas.TestResultResponse)
def submit_test(
    test_data: schemas.TestSubmit,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """提交测试结果"""
    # 获取段落信息
    paragraph = (
        db.query(models.Paragraph)
        .filter(models.Paragraph.id == test_data.paragraph_id)
        .first()
    )

    if not paragraph:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="段落不存在")

    # 计算阅读速度（字/分钟）
    reading_time_minutes = test_data.reading_time_seconds / 60
    words_per_minute = (
        paragraph.word_count / reading_time_minutes if reading_time_minutes > 0 else 0
    )

    # 检查答案
    correct_count = 0
    total_questions = len(test_data.answers)
    questions_map = build_question_map(db, test_data.paragraph_id, test_data.answers)

    for answer_data in test_data.answers:
        question = questions_map.get(answer_data.question_id)

        if question and question.correct_answer.upper() == answer_data.answer.upper():
            correct_count += 1

    # 计算理解程度（百分比）
    comprehension_rate = (
        (correct_count / total_questions * 100) if total_questions > 0 else 0
    )

    # 创建测试结果
    test_result = models.TestResult(
        user_id=current_user.id,
        paragraph_id=test_data.paragraph_id,
        reading_time_seconds=test_data.reading_time_seconds,
        words_per_minute=round(words_per_minute, 2),
        correct_count=correct_count,
        total_questions=total_questions,
        comprehension_rate=round(comprehension_rate, 2),
    )
    db.add(test_result)
    db.commit()
    db.refresh(test_result)

    # 保存用户答案
    for answer_data in test_data.answers:
        question = questions_map.get(answer_data.question_id)

        is_correct = (
            question.correct_answer.upper() == answer_data.answer.upper()
            if question
            else False
        )

        user_answer = models.UserAnswer(
            test_result_id=test_result.id,
            question_id=answer_data.question_id,
            user_answer=answer_data.answer.upper(),
            is_correct=is_correct,
        )
        db.add(user_answer)

    # 更新阅读进度
    progress = (
        db.query(models.ReadingProgress)
        .filter(
            models.ReadingProgress.user_id == current_user.id,
            models.ReadingProgress.paragraph_id == test_data.paragraph_id,
        )
        .first()
    )

    if not progress:
        progress = models.ReadingProgress(
            user_id=current_user.id,
            book_id=paragraph.book_id,
            paragraph_id=test_data.paragraph_id,
            is_completed=True,
        )
        db.add(progress)
    else:
        progress.is_completed = True

    db.commit()

    # 清理生成任务状态
    clear_question_task(test_data.paragraph_id)

    return test_result


@router.post("/guest/submit-test", response_model=dict)
def submit_guest_test(test_data: schemas.TestSubmit, db: Session = Depends(get_db)):
    """游客提交测试结果（只计算，不落库）"""
    paragraph = (
        db.query(models.Paragraph)
        .filter(models.Paragraph.id == test_data.paragraph_id)
        .first()
    )

    if not paragraph:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="段落不存在")

    reading_time_minutes = test_data.reading_time_seconds / 60
    words_per_minute = (
        paragraph.word_count / reading_time_minutes if reading_time_minutes > 0 else 0
    )

    correct_count = 0
    total_questions = len(test_data.answers)
    answers_detail = []
    questions_map = build_question_map(db, test_data.paragraph_id, test_data.answers)

    for answer_data in test_data.answers:
        question = questions_map.get(answer_data.question_id)
        if not question:
            continue

        is_correct = question.correct_answer.upper() == answer_data.answer.upper()
        if is_correct:
            correct_count += 1

        answers_detail.append(
            {
                "question": question.question_text,
                "user_answer": answer_data.answer.upper(),
                "correct_answer": question.correct_answer,
                "is_correct": is_correct,
                "options": {
                    "A": question.option_a,
                    "B": question.option_b,
                    "C": question.option_c,
                    "D": question.option_d,
                },
            }
        )

    comprehension_rate = (
        (correct_count / total_questions * 100) if total_questions > 0 else 0
    )

    return {
        "test_result": {
            "paragraph_id": test_data.paragraph_id,
            "book_id": paragraph.book_id,
            "reading_time_seconds": test_data.reading_time_seconds,
            "words_per_minute": round(words_per_minute, 2),
            "correct_count": correct_count,
            "total_questions": total_questions,
            "comprehension_rate": round(comprehension_rate, 2),
            "skipped": total_questions == 0,
        },
        "answers_detail": answers_detail,
    }


@router.get("/results")
def get_test_results(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """获取用户的测试历史（包含书籍信息）"""
    results = (
        db.query(
            models.TestResult,
            models.Paragraph.book_id.label("book_id"),
            models.Book.title.label("book_title"),
        )
        .outerjoin(
            models.Paragraph, models.Paragraph.id == models.TestResult.paragraph_id
        )
        .outerjoin(models.Book, models.Book.id == models.Paragraph.book_id)
        .filter(models.TestResult.user_id == current_user.id)
        .order_by(models.TestResult.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    # 构建包含书籍信息的响应
    response = []
    for result, book_id, book_title in results:
        response.append(
            {
                "id": result.id,
                "paragraph_id": result.paragraph_id,
                "reading_time_seconds": result.reading_time_seconds,
                "words_per_minute": result.words_per_minute,
                "correct_count": result.correct_count,
                "total_questions": result.total_questions,
                "comprehension_rate": result.comprehension_rate,
                "created_at": result.created_at,
                "book_id": int(book_id) if book_id is not None else None,
                "book_title": book_title or "未知书籍",
            }
        )

    return response


@router.get("/results/{result_id}", response_model=dict)
def get_test_result_detail(
    result_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """获取测试详情（包含正确答案）"""
    result = (
        db.query(models.TestResult)
        .options(
            joinedload(models.TestResult.answers).joinedload(models.UserAnswer.question)
        )
        .filter(
            models.TestResult.id == result_id,
            models.TestResult.user_id == current_user.id,
        )
        .first()
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="测试结果不存在"
        )

    # 获取段落内容
    paragraph = (
        db.query(models.Paragraph)
        .filter(models.Paragraph.id == result.paragraph_id)
        .first()
    )

    # 获取答案详情
    answers_detail = []
    for answer in result.answers:
        question = answer.question
        if not question:
            continue

        answers_detail.append(
            {
                "question": question.question_text,
                "user_answer": answer.user_answer,
                "correct_answer": question.correct_answer,
                "is_correct": answer.is_correct,
                "options": {
                    "A": question.option_a,
                    "B": question.option_b,
                    "C": question.option_c,
                    "D": question.option_d,
                },
            }
        )

    return {
        "test_result": {
            "id": result.id,
            "paragraph_id": result.paragraph_id,
            "book_id": paragraph.book_id if paragraph else None,
            "reading_time_seconds": result.reading_time_seconds,
            "words_per_minute": result.words_per_minute,
            "correct_count": result.correct_count,
            "total_questions": result.total_questions,
            "comprehension_rate": result.comprehension_rate,
            "created_at": result.created_at,
        },
        "paragraph_content": paragraph.content if paragraph else None,
        "answers_detail": answers_detail,
    }


@router.delete("/clear-book/{book_id}")
def delete_book_test_results(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """删除某本书的所有测试记录"""
    book_exists = db.query(models.Book.id).filter(models.Book.id == book_id).first()
    if not book_exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="书籍不存在")

    paragraph_ids_query = db.query(models.Paragraph.id).filter(
        models.Paragraph.book_id == book_id
    )

    test_result_ids_query = db.query(models.TestResult.id).filter(
        models.TestResult.user_id == current_user.id,
        models.TestResult.paragraph_id.in_(paragraph_ids_query),
    )

    db.query(models.UserAnswer).filter(
        models.UserAnswer.test_result_id.in_(test_result_ids_query)
    ).delete(synchronize_session=False)

    # 再删除测试结果
    deleted_count = (
        db.query(models.TestResult)
        .filter(
            models.TestResult.user_id == current_user.id,
            models.TestResult.paragraph_id.in_(paragraph_ids_query),
        )
        .delete(synchronize_session=False)
    )

    # 同时删除阅读进度
    db.query(models.ReadingProgress).filter(
        models.ReadingProgress.user_id == current_user.id,
        models.ReadingProgress.book_id == book_id,
    ).delete(synchronize_session=False)

    db.commit()

    return {
        "message": f"已删除 {deleted_count} 条记录",
        "book_id": book_id,
        "deleted_count": deleted_count,
    }


@router.delete("/results/{result_id}")
def delete_test_result(
    result_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """删除测试结果"""
    result = (
        db.query(models.TestResult)
        .filter(
            models.TestResult.id == result_id,
            models.TestResult.user_id == current_user.id,
        )
        .first()
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="测试结果不存在"
        )

    # 删除关联的用户答案（通过级联删除自动处理）
    db.delete(result)
    db.commit()

    return {"message": "删除成功", "id": result_id}


@router.get("/progress/{book_id}", response_model=dict)
def get_reading_progress(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """获取某本书的阅读进度"""
    total_paragraphs = (
        db.query(models.Paragraph).filter(models.Paragraph.book_id == book_id).count()
    )

    completed_count = (
        db.query(models.ReadingProgress)
        .filter(
            models.ReadingProgress.user_id == current_user.id,
            models.ReadingProgress.book_id == book_id,
            models.ReadingProgress.is_completed == True,
        )
        .count()
    )

    # 计算平均阅读速度和理解程度
    avg_stats = (
        db.query(
            func.avg(models.TestResult.words_per_minute).label("avg_wpm"),
            func.avg(models.TestResult.comprehension_rate).label("avg_comprehension"),
        )
        .filter(
            models.TestResult.user_id == current_user.id,
            models.TestResult.paragraph_id.in_(
                db.query(models.Paragraph.id).filter(
                    models.Paragraph.book_id == book_id
                )
            ),
        )
        .first()
    )

    return {
        "book_id": book_id,
        "total_paragraphs": total_paragraphs,
        "completed_paragraphs": completed_count,
        "progress_percentage": round((completed_count / total_paragraphs * 100), 2)
        if total_paragraphs > 0
        else 0,
        "average_words_per_minute": round(avg_stats.avg_wpm, 2)
        if avg_stats.avg_wpm
        else 0,
        "average_comprehension_rate": round(avg_stats.avg_comprehension, 2)
        if avg_stats.avg_comprehension
        else 0,
    }
