from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


# 用户相关Schema
class UserBase(BaseModel):
    username: str
    email: EmailStr


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


# 书籍相关Schema
class BookBase(BaseModel):
    title: str
    author: Optional[str] = None


class BookCreate(BookBase):
    pass


class BookResponse(BookBase):
    id: int
    filename: str
    total_paragraphs: int
    created_at: datetime

    class Config:
        from_attributes = True


# 段落相关Schema
class ParagraphResponse(BaseModel):
    id: int
    book_id: int
    sequence: int
    content: str
    word_count: int

    class Config:
        from_attributes = True


# 问题相关Schema
class QuestionResponse(BaseModel):
    id: int
    paragraph_id: int
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str

    class Config:
        from_attributes = True


class QuestionWithAnswer(QuestionResponse):
    correct_answer: str


# 阅读进度相关Schema
class ReadingProgressCreate(BaseModel):
    book_id: int
    paragraph_id: int


class ReadingProgressResponse(BaseModel):
    id: int
    user_id: int
    book_id: int
    paragraph_id: int
    is_completed: bool
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


# 测试答案相关Schema
class AnswerSubmit(BaseModel):
    question_id: int
    answer: str  # A, B, C, D


class TestSubmit(BaseModel):
    paragraph_id: int
    reading_time_seconds: int
    answers: List[AnswerSubmit]


class TestResultResponse(BaseModel):
    id: int
    paragraph_id: int
    reading_time_seconds: int
    words_per_minute: float
    correct_count: int
    total_questions: int
    comprehension_rate: float
    created_at: datetime

    class Config:
        from_attributes = True


class TestResultDetail(TestResultResponse):
    answers: List[dict]
