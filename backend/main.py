"""
main.py — GRYNDR FastAPI application entry point.
"""
from __future__ import annotations
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

# Local imports
from backend.database import engine, get_db, Base
from backend.models import AgentLog, PlannerSettings
from backend.schemas import (
    PredictRequest, PredictResponse,
    PlanGenerateRequest, ReplanRequest,
    AgentResult, AgentLogOut,
    SubjectCreate, SubjectOut,
    TopicCreate, TopicOut,
    SessionOut, SessionComplete,
    QuizResultCreate, QuizResultOut,
    AnalyticsOut,
)
from backend import predict as ml
from backend.agent.agent import run_generate_plan, run_replan
from backend.seed import seed as seed_db


# ─── Lifespan (startup / shutdown) ────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables
    Base.metadata.create_all(bind=engine)
    # Seed demo data if empty
    if os.environ.get("GRYNDR_SEED_DEMO", "1") == "1":
        seed_db()
    yield


app = FastAPI(
    title="GRYNDR API",
    description="ML-powered adaptive study planner · Backend API",
    version="1.0.0",
    lifespan=lifespan,
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173",
                   "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health ───────────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "service": "GRYNDR API"}


# ─── Subjects ─────────────────────────────────────────────────────────────────
@app.get("/subjects", response_model=list[SubjectOut], tags=["Subjects"])
def list_subjects(db: Session = Depends(get_db)):
    from backend.models import Subject, Topic
    subjects = db.query(Subject).order_by(Subject.created_at).all()
    result = []
    for s in subjects:
        count = db.query(Topic).filter(Topic.subject_id == s.id).count()
        out = SubjectOut.model_validate(s)
        out.topic_count = count
        result.append(out)
    return result


@app.post("/subjects", response_model=SubjectOut, status_code=201, tags=["Subjects"])
def create_subject(body: SubjectCreate, db: Session = Depends(get_db)):
    from backend.models import Subject
    existing = db.query(Subject).filter(Subject.name == body.name).first()
    if existing:
        raise HTTPException(400, f"Subject '{body.name}' already exists.")
    s = Subject(**body.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    out = SubjectOut.model_validate(s)
    out.topic_count = 0
    return out


# ─── Topics ───────────────────────────────────────────────────────────────────
@app.get("/topics", response_model=list[TopicOut], tags=["Topics"])
def list_topics(subject_id: int | None = None, db: Session = Depends(get_db)):
    from backend.models import Topic, Subject
    q = db.query(Topic)
    if subject_id:
        q = q.filter(Topic.subject_id == subject_id)
    topics = q.order_by(Topic.priority_score.desc()).all()
    result = []
    for t in topics:
        out = TopicOut.model_validate(t)
        out.subject_name = t.subject.name if t.subject else ""
        result.append(out)
    return result


@app.post("/topics", response_model=TopicOut, status_code=201, tags=["Topics"])
def create_topic(body: TopicCreate, db: Session = Depends(get_db)):
    from backend.models import Topic, Subject
    if not db.get(Subject, body.subject_id):
        raise HTTPException(404, f"Subject {body.subject_id} not found.")
    if db.query(Topic).filter(Topic.subject_id == body.subject_id, Topic.name == body.name).first():
        raise HTTPException(409, "A topic with this name already exists in this subject.")
    t = Topic(**body.model_dump())
    db.add(t)
    db.flush()
    # Auto-predict difficulty
    try:
        result = ml.predict(
            t.confidence, t.prev_quiz_score,
            t.days_since_revision, t.available_hours, t.complexity
        )
        t.predicted_difficulty   = result["difficulty"]
        t.difficulty_prob_easy   = result["probabilities"]["Easy"]
        t.difficulty_prob_medium = result["probabilities"]["Medium"]
        t.difficulty_prob_hard   = result["probabilities"]["Hard"]
    except (FileNotFoundError, RuntimeError):
        pass  # Model not trained yet — that's OK
    db.commit()
    db.refresh(t)
    out = TopicOut.model_validate(t)
    out.subject_name = t.subject.name if t.subject else ""
    return out


# ─── Difficulty Prediction ────────────────────────────────────────────────────
@app.post("/predict-difficulty", response_model=PredictResponse, tags=["ML"])
def predict_difficulty(body: PredictRequest, db: Session = Depends(get_db)):
    if body.topic_id is not None:
        from backend.models import Topic
        if not db.get(Topic, body.topic_id):
            raise HTTPException(404, "Topic not found.")
    try:
        result = ml.predict(
            body.confidence, body.prev_quiz_score,
            body.days_since_revision, body.available_hours, body.complexity
        )
    except (FileNotFoundError, RuntimeError):
        raise HTTPException(503, "ML model unavailable. Run `python -m backend.train` from the project root.")

    # Optionally update the stored topic
    if body.topic_id is not None:
        from backend.models import Topic
        t = db.get(Topic, body.topic_id)
        if t:
            for key in ("confidence", "prev_quiz_score", "days_since_revision", "available_hours", "complexity"):
                setattr(t, key, getattr(body, key))
            t.predicted_difficulty   = result["difficulty"]
            t.difficulty_prob_easy   = result["probabilities"]["Easy"]
            t.difficulty_prob_medium = result["probabilities"]["Medium"]
            t.difficulty_prob_hard   = result["probabilities"]["Hard"]
            db.commit()

    return PredictResponse(**result)


# ─── Study Plan ───────────────────────────────────────────────────────────────
@app.get("/study-plan", response_model=list[SessionOut], tags=["Plan"])
def get_study_plan(status: str | None = None, db: Session = Depends(get_db)):
    from backend.models import StudySession
    q = db.query(StudySession)
    if status:
        q = q.filter(StudySession.status == status)
    sessions = q.order_by(StudySession.scheduled_date, StudySession.scheduled_time).all()
    result = []
    for s in sessions:
        out = SessionOut.model_validate(s)
        if s.topic:
            out.topic_name = s.topic.name
            out.subject_name = s.topic.subject.name if s.topic.subject else ""
        result.append(out)
    return result


@app.post("/study-plan/generate", response_model=AgentResult, tags=["Plan"])
def generate_plan(body: PlanGenerateRequest, db: Session = Depends(get_db)):
    db.execute(text("BEGIN IMMEDIATE"))
    settings = db.get(PlannerSettings, 1)
    if settings is None:
        settings = PlannerSettings(id=1)
        db.add(settings)
    settings.days_ahead, settings.daily_hours = body.days_ahead, body.daily_hours
    try:
        result = run_generate_plan(
            db,
            days_ahead=body.days_ahead,
            daily_hours=body.daily_hours,
            start_date_str=body.start_date,
        )
    except (FileNotFoundError, RuntimeError):
        raise HTTPException(503, "ML model unavailable. Run `python -m backend.train` first.")
    return _format_agent_result(result)


@app.post("/study-plan/replan", response_model=AgentResult, tags=["Plan"])
def replan(body: ReplanRequest, db: Session = Depends(get_db)):
    db.execute(text("BEGIN IMMEDIATE"))
    try:
        settings = db.get(PlannerSettings, 1)
        if settings is None:
            settings = PlannerSettings(id=1, days_ahead=7, daily_hours=3.0)
            db.add(settings)
        if body.days_ahead is not None:
            settings.days_ahead = body.days_ahead
        if body.daily_hours is not None:
            settings.daily_hours = body.daily_hours
        result = run_replan(db, reason=body.reason,
                            days_ahead=body.days_ahead or (settings.days_ahead if settings else 7),
                            daily_hours=body.daily_hours or (settings.daily_hours if settings else 3.0))
    except (FileNotFoundError, RuntimeError):
        raise HTTPException(503, "ML model unavailable. Run `python -m backend.train` first.")
    return _format_agent_result(result)


# ─── Sessions ─────────────────────────────────────────────────────────────────
@app.post("/sessions/{session_id}/complete", response_model=SessionOut, tags=["Sessions"])
def complete_session(session_id: int, body: SessionComplete, db: Session = Depends(get_db)):
    from backend.models import StudySession, QuizResult
    from datetime import datetime, timezone

    db.execute(text("BEGIN IMMEDIATE"))
    s = db.get(StudySession, session_id)
    if not s:
        raise HTTPException(404, "Session not found.")
    if s.status == "done":
        out = SessionOut.model_validate(s)
        out.topic_name = s.topic.name if s.topic else ""
        out.subject_name = s.topic.subject.name if s.topic and s.topic.subject else ""
        return out
    s.status = "done"
    if s.topic:
        s.topic.days_since_revision = 0
    s.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    s.notes = body.notes

    if body.new_quiz_score is not None and s.topic:
        qr = QuizResult(topic_id=s.topic_id, score=body.new_quiz_score)
        db.add(qr)
        s.topic.prev_quiz_score = body.new_quiz_score
        s.topic.days_since_revision = 0

    db.commit()
    db.refresh(s)
    out = SessionOut.model_validate(s)
    if s.topic:
        out.topic_name = s.topic.name
        out.subject_name = s.topic.subject.name if s.topic.subject else ""
    return out


# ─── Quiz Results ─────────────────────────────────────────────────────────────
@app.post("/quiz-results", response_model=QuizResultOut, status_code=201, tags=["Quiz"])
def add_quiz_result(body: QuizResultCreate, db: Session = Depends(get_db)):
    from backend.models import Topic
    t = db.get(Topic, body.topic_id)
    if not t:
        raise HTTPException(404, "Topic not found.")
    from backend.agent.tools import record_quiz_result
    record_quiz_result(db, body.topic_id, body.score, body.notes)
    from backend.models import QuizResult
    qr = db.query(QuizResult).filter(
        QuizResult.topic_id == body.topic_id
    ).order_by(QuizResult.taken_at.desc()).first()
    return QuizResultOut.model_validate(qr)


# ─── Analytics ────────────────────────────────────────────────────────────────
@app.get("/analytics", response_model=AnalyticsOut, tags=["Analytics"])
def get_analytics(db: Session = Depends(get_db)):
    from backend.models import Subject, Topic, StudySession, QuizResult
    from collections import defaultdict
    from datetime import datetime, timezone, timedelta

    total_subjects = db.query(Subject).count()
    total_topics   = db.query(Topic).count()
    completed      = db.query(StudySession).filter(StudySession.status == "done").count()
    upcoming       = db.query(StudySession).filter(StudySession.status == "upcoming").count()

    quiz_scores = [r.score for r in db.query(QuizResult).all()]
    avg_quiz    = round(sum(quiz_scores) / len(quiz_scores), 1) if quiz_scores else 0.0

    # Topics by difficulty
    tbd: dict[str, int] = {"Easy": 0, "Medium": 0, "Hard": 0, "Unclassified": 0}
    for t in db.query(Topic).all():
        d = t.predicted_difficulty or "Unclassified"
        tbd[d] = tbd.get(d, 0) + 1

    # Weekly minutes by actual completion date (UTC), planned by scheduled date.
    today = datetime.now(timezone.utc).date()
    weekly = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        mins = sum(
            s.duration_minutes
            for s in db.query(StudySession).filter(
                StudySession.completed_at >= day.isoformat(),
                StudySession.completed_at < (day + timedelta(days=1)).isoformat(),
                StudySession.status == "done",
            ).all()
        )
        planned = sum(s.duration_minutes for s in db.query(StudySession).filter(
            StudySession.scheduled_date == day.isoformat(), StudySession.status != "skipped").all())
        weekly.append({"date": day.isoformat(), "day": day.strftime("%a"), "minutes": mins, "planned": planned})

    # Subject hours
    subject_hours = []
    for s in db.query(Subject).all():
        mins = sum(
            sess.duration_minutes
            for t in db.query(Topic).filter(Topic.subject_id == s.id).all()
            for sess in db.query(StudySession).filter(
                StudySession.topic_id == t.id,
                StudySession.status == "done",
            ).all()
        )
        subject_hours.append({"name": s.name, "hours": round(mins / 60, 1), "color": s.color})

    # Model metrics
    try:
        model_metrics = ml.get_metrics()
    except Exception:
        model_metrics = {"note": "Model not yet trained — run python train.py"}

    return AnalyticsOut(
        total_subjects=total_subjects,
        total_topics=total_topics,
        sessions_completed=completed,
        sessions_upcoming=upcoming,
        average_quiz_score=avg_quiz,
        topics_by_difficulty=tbd,
        weekly_minutes=weekly,
        subject_hours=subject_hours,
        model_metrics=model_metrics,
        total_study_minutes=sum(s.duration_minutes for s in db.query(StudySession).filter(StudySession.status == "done").all()),
        quiz_count=len(quiz_scores),
    )


# ─── Agent Logs ───────────────────────────────────────────────────────────────
@app.get("/agent-logs", response_model=list[AgentLogOut], tags=["Agent"])
def get_agent_logs(limit: int = Query(50, ge=1, le=500), db: Session = Depends(get_db)):
    logs = db.query(AgentLog).order_by(AgentLog.created_at.desc()).limit(limit).all()
    return [AgentLogOut.model_validate(l) for l in logs]


# ─── Helpers ──────────────────────────────────────────────────────────────────
def _format_agent_result(result: dict) -> AgentResult:
    actions = [
        AgentLogOut(
            id=a.get("id", 0),
            action=a["action"],
            details=a["details"],
            created_at=a.get("created_at"),
        )
        for a in result.get("actions", [])
    ]
    return AgentResult(
        success=result["success"],
        sessions_created=result["sessions_created"],
        sessions_modified=result["sessions_modified"],
        actions=actions,
        explanation=result["explanation"],
    )


@app.get("/planner-settings", tags=["Plan"])
def planner_settings(db: Session = Depends(get_db)):
    settings = db.get(PlannerSettings, 1)
    return {"days_ahead": settings.days_ahead if settings else 7,
            "daily_hours": settings.daily_hours if settings else 3.0}


@app.get("/quiz-results", response_model=list[QuizResultOut], tags=["Quiz"])
def list_quiz_results(db: Session = Depends(get_db)):
    from backend.models import QuizResult
    return db.query(QuizResult).order_by(QuizResult.taken_at.desc(), QuizResult.id.desc()).all()
