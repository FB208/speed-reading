from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from app.db.database import get_db
from app.models import models, schemas
from app.api.deps import get_current_user
from app.services.ai_service import AIService
import threading
import time

router = APIRouter(prefix="/reading", tags=["阅读测试"])

# 存储正在生成问题的任务状态
generating_tasks = {}
# 线程锁，防止并发重复生成
generating_lock = threading.Lock()


def generate_questions_async(
    paragraph_id: int, paragraph_content: str, db_session_factory
):
    """后台异步生成问题"""
    try:
        # 创建新的数据库会话
        from app.db.database import SessionLocal

        db = SessionLocal()

        try:
            # 【关键】再次检查数据库，确保问题不存在（防止并发重复生成）
            existing_count = (
                db.query(models.Question)
                .filter(models.Question.paragraph_id == paragraph_id)
                .count()
            )
            if existing_count > 0:
                print(f"[异步生成] 段落{paragraph_id}已有{existing_count}道问题，跳过生成")
                generating_tasks[paragraph_id] = {"status": "completed", "progress": 100}
                return

            # 标记为正在生成
            generating_tasks[paragraph_id] = {"status": "generating", "progress": 0}
            print(f"[异步生成] 开始为段落{paragraph_id}生成问题")

            ai_service = AIService()
            questions_data = ai_service.generate_questions(paragraph_content)
            ai_service.save_questions(db, paragraph_id, questions_data)

            # 标记为完成
            generating_tasks[paragraph_id] = {"status": "completed", "progress": 100}
            print(f"[异步生成] 段落{paragraph_id}的问题生成完成")
        except Exception as e:
            # 即使失败也要保存默认问题，避免循环
            print(f"[异步生成] 段落{paragraph_id}生成失败，使用默认问题: {str(e)}")
            try:
                # 再次检查，避免重复保存
                existing_count = (
                    db.query(models.Question)
                    .filter(models.Question.paragraph_id == paragraph_id)
                    .count()
                )
                if existing_count == 0:
                    # 保存默认问题
                    default_questions = AIService()._get_default_questions()
                    AIService().save_questions(db, paragraph_id, default_questions)
                    print(f"[异步生成] 段落{paragraph_id}已保存默认问题")
                generating_tasks[paragraph_id] = {
                    "status": "completed",
                    "progress": 100,
                }
            except Exception as save_error:
                print(f"[异步生成] 保存默认问题也失败: {str(save_error)}")
                generating_tasks[paragraph_id] = {"status": "failed", "error": str(e)}
        finally:
            db.close()
    except Exception as e:
        print(f"[异步生成] 严重错误: {str(e)}")
        generating_tasks[paragraph_id] = {"status": "failed", "error": str(e)}


@router.get("/next-paragraph/{book_id}", response_model=dict)
def get_next_paragraph(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """获取下一篇未读的段落（不包含问题，立即返回）"""
    # 查找用户已完成的段落ID
    completed_paragraph_ids = [
        progress.paragraph_id
        for progress in db.query(models.ReadingProgress)
        .filter(
            models.ReadingProgress.user_id == current_user.id,
            models.ReadingProgress.book_id == book_id,
            models.ReadingProgress.is_completed == True,
        )
        .all()
    ]

    # 查找下一个未完成的段落
    next_paragraph = (
        db.query(models.Paragraph)
        .filter(
            models.Paragraph.book_id == book_id,
            ~models.Paragraph.id.in_(completed_paragraph_ids)
            if completed_paragraph_ids
            else True,
        )
        .order_by(models.Paragraph.sequence)
        .first()
    )

    if not next_paragraph:
        return {
            "message": "恭喜！你已经完成了这本书的所有段落",
            "paragraph": None,
            "progress": {
                "completed": len(completed_paragraph_ids),
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

    # 如果问题不存在且没有在生成中，启动后台任务生成问题
    with generating_lock:
        if existing_questions == 0 and next_paragraph.id not in generating_tasks:
            print(f"[获取段落] 段落{next_paragraph.id}没有问题，启动异步生成")
            generating_tasks[next_paragraph.id] = {"status": "generating", "progress": 0}
            thread = threading.Thread(
                target=generate_questions_async,
                args=(next_paragraph.id, next_paragraph.content, None),
            )
            thread.daemon = True
            thread.start()

    return {
        "paragraph": {
            "id": next_paragraph.id,
            "book_id": next_paragraph.book_id,
            "sequence": next_paragraph.sequence,
            "content": next_paragraph.content,
            "word_count": next_paragraph.word_count,
        },
        "questions_ready": existing_questions > 0,
        "questions_generating": next_paragraph.id in generating_tasks
        and generating_tasks[next_paragraph.id]["status"] == "generating",
        "progress": {
            "completed": len(completed_paragraph_ids),
            "total": total_paragraphs,
            "current": next_paragraph.sequence,
        },
    }


@router.get("/questions/{paragraph_id}", response_model=dict)
def get_questions(
    paragraph_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """获取段落的问题（用户阅读完成后调用）"""
    # 获取段落
    paragraph = (
        db.query(models.Paragraph).filter(models.Paragraph.id == paragraph_id).first()
    )

    if not paragraph:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="段落不存在")

    # 检查是否已生成问题
    existing_questions = (
        db.query(models.Question)
        .filter(models.Question.paragraph_id == paragraph_id)
        .all()
    )

    # 如果问题已存在，直接返回
    if existing_questions:
        print(f"[获取问题] 段落{paragraph_id}已存在{len(existing_questions)}道问题")
        questions_response = []
        for q in existing_questions:
            questions_response.append(
                {
                    "id": q.id,
                    "question_text": q.question_text,
                    "option_a": q.option_a,
                    "option_b": q.option_b,
                    "option_c": q.option_c,
                    "option_d": q.option_d,
                }
            )
        return {
            "status": "ready",
            "questions": questions_response,
        }

    # 检查是否正在生成中
    if paragraph_id in generating_tasks:
        task_info = generating_tasks[paragraph_id]
        print(f"[获取问题] 段落{paragraph_id}当前状态: {task_info['status']}")

        if task_info["status"] == "generating":
            return {
                "status": "generating",
                "message": "问题正在生成中，请稍候...",
                "questions": [],
            }
        elif task_info["status"] == "completed":
            # 任务已完成，但数据库中还没有问题，可能是刚保存，重新查询
            print(f"[获取问题] 任务已完成，重新查询数据库")
            db.refresh(paragraph)
            existing_questions = (
                db.query(models.Question)
                .filter(models.Question.paragraph_id == paragraph_id)
                .all()
            )

            if existing_questions:
                questions_response = []
                for q in existing_questions:
                    questions_response.append(
                        {
                            "id": q.id,
                            "question_text": q.question_text,
                            "option_a": q.option_a,
                            "option_b": q.option_b,
                            "option_c": q.option_c,
                            "option_d": q.option_d,
                        }
                    )
                return {
                    "status": "ready",
                    "questions": questions_response,
                }
            else:
                # 任务标记为完成但数据库为空，清除任务状态让用户重新触发
                print(f"[获取问题] 任务标记完成但数据库为空，清除任务状态")
                del generating_tasks[paragraph_id]
                # 返回生成中，让前端再等等
                return {
                    "status": "generating",
                    "message": "问题正在保存中，请稍候...",
                    "questions": [],
                }
        elif task_info["status"] == "failed":
            # 任务失败，清除状态并重新启动
            print(f"[获取问题] 段落{paragraph_id}生成失败，重新启动")
            del generating_tasks[paragraph_id]
            # 重新启动生成（使用锁保护）
            with generating_lock:
                if paragraph_id not in generating_tasks:
                    generating_tasks[paragraph_id] = {"status": "generating", "progress": 0}
                    thread = threading.Thread(
                        target=generate_questions_async,
                        args=(paragraph_id, paragraph.content, None),
                    )
                    thread.daemon = True
                    thread.start()
            return {
                "status": "generating",
                "message": "问题重新生成中，请稍候...",
                "questions": [],
            }

    # 如果没有在生成中，启动生成（使用锁保护）
    with generating_lock:
        # 再次检查，防止并发
        if paragraph_id not in generating_tasks:
            print(f"[获取问题] 段落{paragraph_id}没有任务，启动生成")
            generating_tasks[paragraph_id] = {"status": "generating", "progress": 0}
            thread = threading.Thread(
                target=generate_questions_async, args=(paragraph_id, paragraph.content, None)
            )
            thread.daemon = True
            thread.start()

    return {
        "status": "generating",
        "message": "问题正在生成中，请稍候...",
        "questions": [],
    }


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

    for answer_data in test_data.answers:
        question = (
            db.query(models.Question)
            .filter(models.Question.id == answer_data.question_id)
            .first()
        )

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
        question = (
            db.query(models.Question)
            .filter(models.Question.id == answer_data.question_id)
            .first()
        )

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
    if test_data.paragraph_id in generating_tasks:
        del generating_tasks[test_data.paragraph_id]

    return test_result


@router.get("/results")
def get_test_results(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """获取用户的测试历史（包含书籍信息）"""
    results = (
        db.query(models.TestResult)
        .filter(models.TestResult.user_id == current_user.id)
        .order_by(models.TestResult.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    # 构建包含书籍信息的响应
    response = []
    for result in results:
        paragraph = (
            db.query(models.Paragraph)
            .filter(models.Paragraph.id == result.paragraph_id)
            .first()
        )
        book = None
        if paragraph:
            book = (
                db.query(models.Book)
                .filter(models.Book.id == paragraph.book_id)
                .first()
            )
        
        response.append({
            "id": result.id,
            "paragraph_id": result.paragraph_id,
            "reading_time_seconds": result.reading_time_seconds,
            "words_per_minute": result.words_per_minute,
            "correct_count": result.correct_count,
            "total_questions": result.total_questions,
            "comprehension_rate": result.comprehension_rate,
            "created_at": result.created_at,
            "book_id": book.id if book else None,
            "book_title": book.title if book else "未知书籍",
        })

    return response


@router.get("/results/{result_id}", response_model=dict)
def get_test_result_detail(
    result_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """获取测试详情（包含正确答案）"""
    print(f"[获取结果详情] 查询 result_id={result_id}, user_id={current_user.id}")
    
    # 先不带用户过滤查询，看记录是否存在
    result_any = db.query(models.TestResult).filter(models.TestResult.id == result_id).first()
    if result_any:
        print(f"[获取结果详情] 记录存在，属于 user_id={result_any.user_id}")
    else:
        print(f"[获取结果详情] 记录 id={result_id} 不存在")
    
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

    # 获取段落内容
    paragraph = (
        db.query(models.Paragraph)
        .filter(models.Paragraph.id == result.paragraph_id)
        .first()
    )

    # 获取答案详情
    answers_detail = []
    for answer in result.answers:
        question = (
            db.query(models.Question)
            .filter(models.Question.id == answer.question_id)
            .first()
        )

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
    # 获取该书籍的所有段落ID
    paragraph_ids = [
        p.id for p in db.query(models.Paragraph)
        .filter(models.Paragraph.book_id == book_id)
        .all()
    ]
    
    if not paragraph_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="书籍不存在"
        )
    
    # 获取该用户在这本书中的所有测试结果ID
    test_result_ids = [
        r.id for r in db.query(models.TestResult.id)
        .filter(
            models.TestResult.user_id == current_user.id,
            models.TestResult.paragraph_id.in_(paragraph_ids),
        )
        .all()
    ]
    
    # 先删除关联的用户答案记录（避免外键约束冲突）
    if test_result_ids:
        db.query(models.UserAnswer).filter(
            models.UserAnswer.test_result_id.in_(test_result_ids)
        ).delete(synchronize_session=False)
    
    # 再删除测试结果
    deleted_count = (
        db.query(models.TestResult)
        .filter(
            models.TestResult.user_id == current_user.id,
            models.TestResult.paragraph_id.in_(paragraph_ids),
        )
        .delete(synchronize_session=False)
    )
    
    # 同时删除阅读进度
    db.query(models.ReadingProgress).filter(
        models.ReadingProgress.user_id == current_user.id,
        models.ReadingProgress.book_id == book_id,
    ).delete(synchronize_session=False)
    
    db.commit()

    return {"message": f"已删除 {deleted_count} 条记录", "book_id": book_id, "deleted_count": deleted_count}


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
