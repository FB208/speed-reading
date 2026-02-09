import json
import re
import logging
from openai import OpenAI
import httpx
from app.core.config import settings
from sqlalchemy.orm import Session
from app.models import models
from typing import List


logger = logging.getLogger(__name__)


class AIService:
    """AI服务：生成阅读理解题"""

    def __init__(self):
        # 创建一个没有代理的HTTP客户端
        http_client = httpx.Client(timeout=60.0)

        # 初始化OpenAI客户端
        client_kwargs = {"api_key": settings.OPENAI_API_KEY, "http_client": http_client}

        # 只有在设置了自定义base_url时才传递
        if settings.OPENAI_BASE_URL and settings.OPENAI_BASE_URL.strip():
            client_kwargs["base_url"] = settings.OPENAI_BASE_URL
            logger.info("[AI初始化] 使用自定义base_url: %s", settings.OPENAI_BASE_URL)
        else:
            logger.info("[AI初始化] 使用默认OpenAI API地址")

        self.client = OpenAI(**client_kwargs)
        self.model = settings.OPENAI_MODEL

    def _validate_questions_format(self, questions: List[dict]) -> bool:
        """验证问题格式是否正确"""
        if not isinstance(questions, list):
            logger.warning("[AI验证失败] 返回的不是列表类型: %s", type(questions))
            return False

        if len(questions) != 5:
            logger.warning("[AI验证失败] 返回的问题数量不是5个: %s", len(questions))
            return False

        for i, q in enumerate(questions):
            # 检查必需字段
            required_keys = ["question", "options", "correct_answer"]
            missing_keys = [k for k in required_keys if k not in q]
            if missing_keys:
                logger.warning("[AI验证失败] 第%s题缺少字段: %s", i + 1, missing_keys)
                return False

            # 检查options格式
            options = q.get("options", {})
            option_keys = ["A", "B", "C", "D"]
            missing_options = [k for k in option_keys if k not in options]
            if missing_options:
                logger.warning(
                    "[AI验证失败] 第%s题缺少选项: %s", i + 1, missing_options
                )
                return False

            # 检查correct_answer是否为A/B/C/D之一
            correct = q.get("correct_answer")
            if correct not in ["A", "B", "C", "D"]:
                logger.warning(
                    "[AI验证失败] 第%s题正确答案格式错误: %s", i + 1, correct
                )
                return False

        return True

    def _call_openai_api(self, prompt: str) -> List[dict]:
        """调用OpenAI API生成问题"""
        logger.debug("[AI请求提示词] %s", prompt)

        response_content = None

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "你是一个专业的阅读理解题目生成助手。请根据提供的文本生成高质量的选择题。",
                    },
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},  # 强制返回JSON格式
            )

            # 解析响应
            logger.debug("[AI返回结果] %s", response)
            response_content = response.choices[0].message.content
            logger.debug("[AI返回内容] %s", response_content)

            if not response_content:
                raise ValueError("AI返回内容为空")

            # 直接解析JSON（因为设置了response_format，应该已经是JSON）
            data = json.loads(response_content)

            questions = data.get("questions", [])
            return questions
        except json.JSONDecodeError as e:
            logger.warning("[AI返回JSON解析失败] %s", str(e))
            if response_content:
                logger.warning("[AI原始返回] %s", response_content)
            raise
        except Exception as e:
            logger.exception("[AI调用失败] %s", str(e))
            raise

    def generate_questions(self, paragraph_content: str) -> List[dict]:
        """
        为段落生成5道阅读理解选择题，带重试机制

        Returns:
            List[dict]: 包含5道题目的列表，每道题包含问题和选项
        """
        content = paragraph_content

        base_prompt = f"""请根据以下文本内容，生成5道阅读理解选择题。

文本内容：
{content}

要求：
1. 生成5道选择题
2. 每道题有4个选项（A、B、C、D）
3. 题目应该测试对文本内容的理解
4. 包含文本细节和主旨理解
5. 请严格按照以下JSON格式返回：

{{
  "questions": [
    {{
      "question": "问题内容",
      "options": {{
        "A": "选项A内容",
        "B": "选项B内容",
        "C": "选项C内容",
        "D": "选项D内容"
      }},
      "correct_answer": "A"
    }}
  ]
}}

请确保返回的是有效的JSON格式，直接返回json对象，除此之外不要返回任何其他内容。"""

        max_retries = 2
        last_error = None

        for attempt in range(max_retries + 1):
            try:
                logger.info("[AI生成] 第%s次尝试...", attempt + 1)

                # 构建提示词，如果是重试则添加错误提示
                if attempt > 0:
                    prompt = (
                        base_prompt
                        + f"\n\n【注意】这是你第{attempt}次重试。上次返回的格式不正确，请确保严格按照上述JSON格式返回5道完整的选择题，包含question、options（A/B/C/D四个选项）和correct_answer字段。"
                    )
                else:
                    prompt = base_prompt

                questions = self._call_openai_api(prompt)

                # 验证格式
                if self._validate_questions_format(questions):
                    logger.info("[AI生成成功] 成功生成5道问题")
                    return questions
                else:
                    last_error = f"第{attempt + 1}次生成的格式不正确"
                    logger.warning("[AI验证] %s", last_error)

                    if attempt >= max_retries:
                        logger.warning(
                            "[AI生成] 已达到最大重试次数(%s次)，使用默认问题",
                            max_retries,
                        )
                        break

            except Exception as e:
                last_error = str(e)
                logger.warning("[AI生成] 第%s次生成失败: %s", attempt + 1, last_error)

                if attempt >= max_retries:
                    logger.warning(
                        "[AI生成] 已达到最大重试次数(%s次)，使用默认问题",
                        max_retries,
                    )
                    break

        # 所有重试都失败，返回默认问题
        logger.warning("[AI生成] 使用默认问题")
        return self._get_default_questions()

    def _get_default_questions(self) -> List[dict]:
        """获取默认问题（当AI生成失败时使用）"""
        return [
            {
                "question": "根据文本内容，以下哪项描述是正确的？",
                "options": {"A": "选项A", "B": "选项B", "C": "选项C", "D": "选项D"},
                "correct_answer": "A",
            }
        ] * 5

    def save_questions(
        self, db: Session, paragraph_id: int, questions_data: List[dict]
    ):
        """将生成的问题保存到数据库"""
        for q_data in questions_data:
            question = models.Question(
                paragraph_id=paragraph_id,
                question_text=q_data["question"],
                option_a=q_data["options"]["A"],
                option_b=q_data["options"]["B"],
                option_c=q_data["options"]["C"],
                option_d=q_data["options"]["D"],
                correct_answer=q_data["correct_answer"],
            )
            db.add(question)

        db.commit()
        logger.info("[AI保存] 成功保存%s道问题到数据库", len(questions_data))
