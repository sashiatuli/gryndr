"""
models.py — SQLAlchemy ORM models for GRYNDR.
Tables: subjects, topics, study_sessions, quiz_results, agent_logs
"""
from datetime import datetime, timezone
from sqlalchemy import (
    Integer, String, Float, DateTime, ForeignKey, Text, Boolean
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.database import Base


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class PlannerSettings(Base):
    __tablename__ = "planner_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    days_ahead: Mapped[int] = mapped_column(Integer, default=7)
    daily_hours: Mapped[float] = mapped_column(Float, default=3.0)


class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    exam_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    color: Mapped[str] = mapped_column(String(20), default="#DDA9BB")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    topics: Mapped[list["Topic"]] = relationship(
        "Topic", back_populates="subject", cascade="all, delete-orphan"
    )


class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)

    # ML feature inputs
    confidence: Mapped[float] = mapped_column(Float, default=5.0)        # 1-10
    prev_quiz_score: Mapped[float] = mapped_column(Float, default=50.0)  # 0-100
    days_since_revision: Mapped[int] = mapped_column(Integer, default=7)  # 0-60
    available_hours: Mapped[float] = mapped_column(Float, default=2.0)   # 0.5-8
    complexity: Mapped[int] = mapped_column(Integer, default=5)           # 1-10

    # ML output (cached)
    predicted_difficulty: Mapped[str | None] = mapped_column(String(10), nullable=True)
    difficulty_prob_easy: Mapped[float | None] = mapped_column(Float, nullable=True)
    difficulty_prob_medium: Mapped[float | None] = mapped_column(Float, nullable=True)
    difficulty_prob_hard: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Priority score (0-100) set by agent
    priority_score: Mapped[float] = mapped_column(Float, default=0.0)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    subject: Mapped["Subject"] = relationship("Subject", back_populates="topics")
    sessions: Mapped[list["StudySession"]] = relationship(
        "StudySession", back_populates="topic", cascade="all, delete-orphan"
    )
    quiz_results: Mapped[list["QuizResult"]] = relationship(
        "QuizResult", back_populates="topic", cascade="all, delete-orphan"
    )


class StudySession(Base):
    __tablename__ = "study_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id"), nullable=False)
    scheduled_date: Mapped[str] = mapped_column(String(20), nullable=False)
    scheduled_time: Mapped[str] = mapped_column(String(10), default="09:00")
    duration_minutes: Mapped[int] = mapped_column(Integer, default=45)
    status: Mapped[str] = mapped_column(String(20), default="upcoming")  # upcoming|active|done|skipped
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    topic: Mapped["Topic"] = relationship("Topic", back_populates="sessions")


class QuizResult(Base):
    __tablename__ = "quiz_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id"), nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)   # 0-100
    taken_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    topic: Mapped["Topic"] = relationship("Topic", back_populates="quiz_results")


class AgentLog(Base):
    __tablename__ = "agent_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    details: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
