import logging
import threading

from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models import models, schemas
from app.services.ai_service import AIService

logger = logging.getLogger(__name__)

# 进程内问题生成任务状态
_generating_tasks = {}
_generating_lock = threading.Lock()


def serialize_paragraph(paragraph: models.Paragraph) -> dict:
    """序列化段落对象"""
    return {
        "id": paragraph.id,
        "book_id": paragraph.book_id,
        "sequence": paragraph.sequence,
        "content": paragraph.content,
        "word_count": paragraph.word_count,
    }


def _serialize_questions(questions: list[models.Question]) -> list[dict]:
    """序列化题目列表"""
    return [
        {
            "id": question.id,
            "question_text": question.question_text,
            "option_a": question.option_a,
            "option_b": question.option_b,
            "option_c": question.option_c,
            "option_d": question.option_d,
        }
        for question in questions
    ]


def build_question_map(
    db: Session, paragraph_id: int, answers: list[schemas.AnswerSubmit]
) -> dict:
    """批量加载题目，避免逐条查询造成 N+1"""
    question_ids = {answer.question_id for answer in answers}
    if not question_ids:
        return {}

    questions = (
        db.query(models.Question)
        .filter(
            models.Question.paragraph_id == paragraph_id,
            models.Question.id.in_(question_ids),
        )
        .all()
    )
    return {question.id: question for question in questions}


def start_question_generation(paragraph_id: int, paragraph_content: str) -> None:
    """启动后台问题生成任务"""
    with _generating_lock:
        if paragraph_id in _generating_tasks:
            return

        logger.info("[问题生成] 段落%s没有任务，启动生成", paragraph_id)
        _generating_tasks[paragraph_id] = {"status": "generating", "progress": 0}
        thread = threading.Thread(
            target=_generate_questions_async,
            args=(paragraph_id, paragraph_content),
        )
        thread.daemon = True
        thread.start()


def get_questions_response(
    db: Session, paragraph_id: int, paragraph_content: str
) -> dict:
    """获取题目响应，若未生成则触发后台生成"""
    existing_questions = (
        db.query(models.Question)
        .filter(models.Question.paragraph_id == paragraph_id)
        .all()
    )

    if existing_questions:
        logger.debug(
            "[获取问题] 段落%s已存在%s道问题", paragraph_id, len(existing_questions)
        )
        return {
            "status": "ready",
            "questions": _serialize_questions(existing_questions),
        }

    if paragraph_id in _generating_tasks:
        task_info = _generating_tasks[paragraph_id]
        logger.debug("[获取问题] 段落%s当前状态: %s", paragraph_id, task_info["status"])

        if task_info["status"] == "generating":
            return {
                "status": "generating",
                "message": "问题正在生成中，请稍候...",
                "questions": [],
            }

        if task_info["status"] == "completed":
            existing_questions = (
                db.query(models.Question)
                .filter(models.Question.paragraph_id == paragraph_id)
                .all()
            )
            if existing_questions:
                return {
                    "status": "ready",
                    "questions": _serialize_questions(existing_questions),
                }

            logger.warning("[获取问题] 任务标记完成但数据库为空，清除任务状态")
            del _generating_tasks[paragraph_id]
            return {
                "status": "generating",
                "message": "问题正在保存中，请稍候...",
                "questions": [],
            }

        if task_info["status"] == "failed":
            logger.warning("[获取问题] 段落%s生成失败，重新启动", paragraph_id)
            del _generating_tasks[paragraph_id]
            start_question_generation(paragraph_id, paragraph_content)
            return {
                "status": "generating",
                "message": "问题重新生成中，请稍候...",
                "questions": [],
            }

    start_question_generation(paragraph_id, paragraph_content)
    return {
        "status": "generating",
        "message": "问题正在生成中，请稍候...",
        "questions": [],
    }


def _generate_questions_async(paragraph_id: int, paragraph_content: str) -> None:
    """后台异步生成问题"""
    db = SessionLocal()
    try:
        existing_count = (
            db.query(models.Question)
            .filter(models.Question.paragraph_id == paragraph_id)
            .count()
        )
        if existing_count > 0:
            logger.info(
                "[异步生成] 段落%s已有%s道问题，跳过生成",
                paragraph_id,
                existing_count,
            )
            _generating_tasks[paragraph_id] = {
                "status": "completed",
                "progress": 100,
            }
            return

        _generating_tasks[paragraph_id] = {"status": "generating", "progress": 0}
        logger.info("[异步生成] 开始为段落%s生成问题", paragraph_id)

        ai_service = AIService()
        questions_data = ai_service.generate_questions(paragraph_content)
        ai_service.save_questions(db, paragraph_id, questions_data)

        _generating_tasks[paragraph_id] = {"status": "completed", "progress": 100}
        logger.info("[异步生成] 段落%s的问题生成完成", paragraph_id)
    except Exception as e:
        logger.warning(
            "[异步生成] 段落%s生成失败，使用默认问题: %s",
            paragraph_id,
            str(e),
            exc_info=True,
        )
        try:
            existing_count = (
                db.query(models.Question)
                .filter(models.Question.paragraph_id == paragraph_id)
                .count()
            )
            if existing_count == 0:
                default_questions = AIService()._get_default_questions()
                AIService().save_questions(db, paragraph_id, default_questions)
                logger.info("[异步生成] 段落%s已保存默认问题", paragraph_id)
            _generating_tasks[paragraph_id] = {
                "status": "completed",
                "progress": 100,
            }
        except Exception as save_error:
            logger.error(
                "[异步生成] 保存默认问题也失败: %s",
                str(save_error),
                exc_info=True,
            )
            _generating_tasks[paragraph_id] = {"status": "failed", "error": str(e)}
    finally:
        db.close()


def is_question_generating(paragraph_id: int) -> bool:
    """判断段落题目是否仍在生成中"""
    task = _generating_tasks.get(paragraph_id)
    return bool(task and task.get("status") == "generating")


def clear_question_task(paragraph_id: int) -> None:
    """清理段落任务状态"""
    _generating_tasks.pop(paragraph_id, None)
