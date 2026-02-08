from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    Boolean,
    Float,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False, nullable=False)

    # 关系
    reading_progress = relationship("ReadingProgress", back_populates="user")
    test_results = relationship("TestResult", back_populates="user")
    uploaded_books = relationship("Book", back_populates="uploader")
    bookshelf_items = relationship("BookshelfItem", back_populates="user")


class Book(Base):
    __tablename__ = "books"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    author = Column(String(100), nullable=True)
    filename = Column(String(255), nullable=False)
    cover_image = Column(String(255), nullable=True)  # 封面图片路径
    total_paragraphs = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    uploaded_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # 关系
    paragraphs = relationship(
        "Paragraph", back_populates="book", cascade="all, delete-orphan"
    )
    uploader = relationship("User", back_populates="uploaded_books")
    bookshelf_items = relationship("BookshelfItem", back_populates="book")


class BookshelfItem(Base):
    __tablename__ = "bookshelf_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    book_id = Column(Integer, ForeignKey("books.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "book_id", name="uq_bookshelf_user_book"),
    )

    user = relationship("User", back_populates="bookshelf_items")
    book = relationship("Book", back_populates="bookshelf_items")


class Paragraph(Base):
    __tablename__ = "paragraphs"

    id = Column(Integer, primary_key=True, index=True)
    book_id = Column(Integer, ForeignKey("books.id"), nullable=False)
    sequence = Column(Integer, nullable=False)  # 段落序号
    content = Column(Text, nullable=False)
    word_count = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # 关系
    book = relationship("Book", back_populates="paragraphs")
    questions = relationship(
        "Question", back_populates="paragraph", cascade="all, delete-orphan"
    )
    reading_progress = relationship("ReadingProgress", back_populates="paragraph")


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    paragraph_id = Column(Integer, ForeignKey("paragraphs.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    option_a = Column(String(500), nullable=False)
    option_b = Column(String(500), nullable=False)
    option_c = Column(String(500), nullable=False)
    option_d = Column(String(500), nullable=False)
    correct_answer = Column(String(1), nullable=False)  # A, B, C, D
    created_at = Column(DateTime, default=datetime.utcnow)

    # 关系
    paragraph = relationship("Paragraph", back_populates="questions")
    answers = relationship("UserAnswer", back_populates="question")


class ReadingProgress(Base):
    __tablename__ = "reading_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    book_id = Column(Integer, ForeignKey("books.id"), nullable=False)
    paragraph_id = Column(Integer, ForeignKey("paragraphs.id"), nullable=False)
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)

    # 关系
    user = relationship("User", back_populates="reading_progress")
    paragraph = relationship("Paragraph", back_populates="reading_progress")


class TestResult(Base):
    __tablename__ = "test_results"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    paragraph_id = Column(Integer, ForeignKey("paragraphs.id"), nullable=False)
    reading_time_seconds = Column(Integer, nullable=False)
    words_per_minute = Column(Float, nullable=False)
    correct_count = Column(Integer, nullable=False)
    total_questions = Column(Integer, nullable=False)
    comprehension_rate = Column(Float, nullable=False)  # 百分比
    created_at = Column(DateTime, default=datetime.utcnow)

    # 关系
    user = relationship("User", back_populates="test_results")
    answers = relationship(
        "UserAnswer", back_populates="test_result", cascade="all, delete-orphan"
    )


class UserAnswer(Base):
    __tablename__ = "user_answers"

    id = Column(Integer, primary_key=True, index=True)
    test_result_id = Column(Integer, ForeignKey("test_results.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    user_answer = Column(String(1), nullable=False)  # A, B, C, D
    is_correct = Column(Boolean, nullable=False)

    # 关系
    test_result = relationship("TestResult", back_populates="answers")
    question = relationship("Question", back_populates="answers")
