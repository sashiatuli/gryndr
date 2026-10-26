"""
schemas.py — Pydantic v2 request/response schemas for GRYNDR API.
"""
from __future__ import annotations
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator


class InputModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, allow_inf_nan=False)


def iso_date(value):
    if value is None:
        return None
    return date.fromisoformat(value).isoformat()


# ─── Subject ──────────────────────────────────────────────────────────────────
class SubjectCreate(InputModel):
    name: str = Field(..., min_length=1, max_length=120)
    exam_date: Optional[str] = None   # "YYYY-MM-DD"
    color: str = Field("#DDA9BB", pattern=r"^#[0-9a-fA-F]{6}$")
    _exam_date = field_validator("exam_date")(iso_date)


class SubjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    exam_date: Optional[str]
    color: str
    created_at: datetime
    topic_count: int = 0


# ─── Topic ────────────────────────────────────────────────────────────────────
class TopicCreate(InputModel):
    subject_id: int
    name: str = Field(..., min_length=1, max_length=200)
    confidence: float = Field(5.0, ge=1, le=10)
    prev_quiz_score: float = Field(50.0, ge=0, le=100)
    days_since_revision: int = Field(7, ge=0, le=180)
    available_hours: float = Field(2.0, ge=0.5, le=12)
    complexity: int = Field(5, ge=1, le=10)


class TopicOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subject_id: int
    name: str
    confidence: float
    prev_quiz_score: float
    days_since_revision: int
    available_hours: float
    complexity: int
    predicted_difficulty: Optional[str]
    difficulty_prob_easy: Optional[float]
    difficulty_prob_medium: Optional[float]
    difficulty_prob_hard: Optional[float]
    priority_score: float
    is_demo: bool
    created_at: datetime
    subject_name: str = ""


# ─── Difficulty prediction ─────────────────────────────────────────────────────
class PredictRequest(InputModel):
    topic_id: Optional[int] = None  # if given, update DB; else just predict
    confidence: float = Field(..., ge=1, le=10)
    prev_quiz_score: float = Field(..., ge=0, le=100)
    days_since_revision: int = Field(..., ge=0, le=180)
    available_hours: float = Field(..., ge=0.5, le=12)
    complexity: int = Field(..., ge=1, le=10)


class PredictResponse(BaseModel):
    difficulty: str                    # "Easy" | "Medium" | "Hard"
    probabilities: dict[str, float]    # {"Easy": 0.1, "Medium": 0.5, "Hard": 0.4}
    features_used: dict[str, float]


# ─── Study Session ────────────────────────────────────────────────────────────
class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    topic_id: int
    scheduled_date: str
    scheduled_time: str
    duration_minutes: int
    status: str
    completed_at: Optional[datetime]
    notes: Optional[str]
    created_at: datetime
    topic_name: str = ""
    subject_name: str = ""


class SessionComplete(InputModel):
    notes: Optional[str] = None
    new_quiz_score: Optional[float] = Field(None, ge=0, le=100)


# ─── Quiz result ──────────────────────────────────────────────────────────────
class QuizResultCreate(InputModel):
    topic_id: int
    score: float = Field(..., ge=0, le=100)
    notes: Optional[str] = None


class QuizResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    topic_id: int
    score: float
    taken_at: datetime
    notes: Optional[str]


# ─── Plan generation ──────────────────────────────────────────────────────────
class PlanGenerateRequest(InputModel):
    days_ahead: int = Field(14, ge=1, le=60)
    daily_hours: float = Field(3.0, ge=0.5, le=10)
    start_date: Optional[str] = None  # "YYYY-MM-DD", defaults to today
    _start_date = field_validator("start_date")(iso_date)

    @field_validator("start_date")
    @classmethod
    def future_start(cls, value):
        if value and date.fromisoformat(value) < date.today():
            raise ValueError("Start date must be today or later.")
        return value


class ReplanRequest(InputModel):
    reason: str = "quiz_score_updated"
    days_ahead: Optional[int] = Field(None, ge=1, le=60)
    daily_hours: Optional[float] = Field(None, ge=0.5, le=10)


# ─── Analytics ────────────────────────────────────────────────────────────────
class AnalyticsOut(BaseModel):
    total_subjects: int
    total_topics: int
    sessions_completed: int
    sessions_upcoming: int
    average_quiz_score: float
    topics_by_difficulty: dict[str, int]
    weekly_minutes: list[dict]
    subject_hours: list[dict]
    model_metrics: dict
    total_study_minutes: int = 0
    quiz_count: int = 0


# ─── Agent log ────────────────────────────────────────────────────────────────
class AgentLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    action: str
    details: str
    created_at: datetime


# ─── Agent run result ─────────────────────────────────────────────────────────
class AgentResult(BaseModel):
    success: bool
    sessions_created: int
    sessions_modified: int
    actions: list[AgentLogOut]
    explanation: str
