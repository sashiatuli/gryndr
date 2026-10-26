"""
agent/tools.py — Callable tool functions for the GRYNDR adaptive planning agent.

Each function is a discrete, testable unit. The agent calls them in sequence,
uses their outputs to make decisions, and stores results in the database.

AGENT IMPLEMENTATION NOTE
--------------------------
This is a transparent, policy-based tool-using agent. It does NOT use an LLM.
Instead it applies explicit decision rules backed by the ML difficulty model.
Decisions are logged to the agent_logs table and returned in the API response
so the user can understand why the plan changed.
"""
from __future__ import annotations
import math
from datetime import date, timedelta, datetime, timezone
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.orm import Session as DBSession

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend.predict import predict as ml_predict


# ─── Tool 1: get_topics_and_deadlines ─────────────────────────────────────────
def get_topics_and_deadlines(db: "DBSession") -> list[dict]:
    """
    Fetch all topics with their subject's exam date, quiz history, and session
    completion status. Returns a list of enriched topic dicts.
    """
    from backend.models import Topic, QuizResult, StudySession

    topics = db.query(Topic).all()
    result = []
    for t in topics:
        completed = db.query(StudySession).filter(
            StudySession.topic_id == t.id,
            StudySession.status == "done",
        ).count()
        upcoming = db.query(StudySession).filter(
            StudySession.topic_id == t.id,
            StudySession.status == "upcoming",
        ).count()
        latest_quiz = (
            db.query(QuizResult)
            .filter(QuizResult.topic_id == t.id)
            .order_by(QuizResult.taken_at.desc())
            .first()
        )
        result.append({
            "id": t.id,
            "name": t.name,
            "subject_id": t.subject_id,
            "subject_name": t.subject.name if t.subject else "",
            "exam_date": t.subject.exam_date if t.subject else None,
            "confidence": t.confidence,
            "prev_quiz_score": latest_quiz.score if latest_quiz else t.prev_quiz_score,
            "days_since_revision": t.days_since_revision,
            "available_hours": t.available_hours,
            "complexity": t.complexity,
            "predicted_difficulty": t.predicted_difficulty,
            "priority_score": t.priority_score,
            "completed_sessions": completed,
            "upcoming_sessions": upcoming,
        })
    return result


# ─── Tool 2: predict_topic_difficulty ─────────────────────────────────────────
def predict_topic_difficulty(
    db: "DBSession", topics: list[dict]
) -> list[dict]:
    """
    Run the ML model for each topic, update the DB, and return enriched list.
    """
    from backend.models import Topic

    for t in topics:
        result = ml_predict(
            confidence=t["confidence"],
            prev_quiz_score=t["prev_quiz_score"],
            days_since_revision=t["days_since_revision"],
            available_hours=t["available_hours"],
            complexity=t["complexity"],
        )
        t["predicted_difficulty"] = result["difficulty"]
        t["prob_easy"]   = result["probabilities"]["Easy"]
        t["prob_medium"] = result["probabilities"]["Medium"]
        t["prob_hard"]   = result["probabilities"]["Hard"]

        # Persist to DB
        db_topic = db.get(Topic, t["id"])
        if db_topic:
            db_topic.predicted_difficulty   = result["difficulty"]
            db_topic.difficulty_prob_easy   = result["probabilities"]["Easy"]
            db_topic.difficulty_prob_medium = result["probabilities"]["Medium"]
            db_topic.difficulty_prob_hard   = result["probabilities"]["Hard"]

    db.flush()
    return topics


# ─── Tool 3: calculate_topic_priority ─────────────────────────────────────────
def calculate_topic_priority(
    db: "DBSession", topics: list[dict]
) -> list[dict]:
    """
    Assign a priority score (0–100) to each topic using a weighted formula:

      priority = (
          difficulty_weight * 35     +  # Hard=35, Medium=20, Easy=5
          urgency_weight   * 30     +  # days until exam (normalised)
          revision_weight  * 20     +  # days since revision
          performance_weight * 15      # inverse of quiz score
      )

    Higher score → scheduled first.
    """
    from backend.models import Topic

    today = date.today()

    for t in topics:
        # difficulty weight
        d = t.get("predicted_difficulty", "Medium")
        diff_w = {"Hard": 35, "Medium": 20, "Easy": 5}.get(d, 20)

        # urgency weight (closer exam → higher urgency)
        urgency_w = 0.0
        if t.get("exam_date"):
            try:
                exam_dt = date.fromisoformat(t["exam_date"])
                days_left = (exam_dt - today).days
                if days_left <= 0:
                    urgency_w = 30
                else:
                    urgency_w = max(0, 30 * (1 - days_left / 60))
            except ValueError:
                pass

        # revision gap weight
        rev_w = min(20, t["days_since_revision"] * 20 / 30)

        # performance weight (low score → higher priority)
        perf_w = 15 * (1 - t["prev_quiz_score"] / 100)

        priority = diff_w + urgency_w + rev_w + perf_w
        t["priority_score"] = round(min(100, priority), 2)

        # Persist
        db_topic = db.get(Topic, t["id"])
        if db_topic:
            db_topic.priority_score = t["priority_score"]

    db.flush()
    topics.sort(key=lambda x: -x["priority_score"])
    return topics


# ─── Tool 4: generate_study_schedule ──────────────────────────────────────────
def generate_study_schedule(
    db: "DBSession",
    topics: list[dict],
    days_ahead: int = 14,
    daily_hours: float = 3.0,
    start_date_str: str | None = None,
    delete_upcoming: bool = True,
) -> list[dict]:
    """
    Create study sessions in the database.

    Strategy:
      - Sort topics by priority (highest first).
      - Allocate slots day by day, respecting daily_hours budget.
      - Sessions are 45 min each; a topic gets ceil(complexity / 3) sessions.
      - Harder topics get extra sessions.
    """
    from backend.models import StudySession

    start = date.fromisoformat(start_date_str) if start_date_str else date.today()
    end = start + timedelta(days=days_ahead)
    # Replace only pending sessions inside this window, in the caller's transaction.
    if delete_upcoming:
        db.query(StudySession).filter(
            StudySession.status == "upcoming",
            StudySession.scheduled_date >= start.isoformat(),
            StudySession.scheduled_date < end.isoformat(),
        ).delete(synchronize_session="fetch")
    db.flush()

    existing = db.query(StudySession).filter(
        StudySession.scheduled_date >= start.isoformat(),
        StudySession.scheduled_date < end.isoformat(),
        StudySession.status != "skipped",
    ).all()
    daily_budget = int(daily_hours * 60)
    duration = min(45, daily_budget)
    occupied = {}
    used = {}
    for session in existing:
        day = session.scheduled_date
        hour, minute = map(int, session.scheduled_time.split(":"))
        begin = hour * 60 + minute
        occupied.setdefault(day, []).append((begin, begin + session.duration_minutes))
        used[day] = used.get(day, 0) + session.duration_minutes

    sessions_created = []
    for topic in topics:
        target = {"Hard": 4, "Medium": 3, "Easy": 2}.get(topic.get("predicted_difficulty"), 3)
        # Completed work already contributes to this topic's allocation.
        needed = max(0, target - topic.get("completed_sessions", 0))
        needed -= sum(s.topic_id == topic["id"] and s.status != "done" for s in existing)
        for _ in range(max(0, needed)):
            slot = None
            for offset in range(days_ahead):
                day = (start + timedelta(days=offset)).isoformat()
                if topic.get("exam_date") and day > topic["exam_date"]:
                    continue
                if used.get(day, 0) + duration > daily_budget:
                    continue
                # Real time intervals avoid overlapping completed/active sessions.
                for begin in range(8 * 60, 22 * 60 - duration + 1, 15):
                    if all(begin + duration <= a or begin >= b for a, b in occupied.get(day, [])):
                        slot = (day, begin)
                        break
                if slot:
                    break
            if not slot:
                break
            day, begin = slot
            time = f"{begin // 60:02d}:{begin % 60:02d}"
            db.add(StudySession(topic_id=topic["id"], scheduled_date=day,
                                scheduled_time=time, duration_minutes=duration, status="upcoming"))
            occupied.setdefault(day, []).append((begin, begin + duration))
            used[day] = used.get(day, 0) + duration
            sessions_created.append({"topic_id": topic["id"], "topic_name": topic["name"],
                                     "date": day, "time": time, "duration": duration,
                                     "priority": topic.get("priority_score", 0)})
    db.flush()
    return sessions_created


# ─── Tool 5: record_quiz_result ────────────────────────────────────────────────
def record_quiz_result(db: "DBSession", topic_id: int, score: float, notes: str | None = None) -> dict:
    """
    Save a quiz result, update the topic's prev_quiz_score and days_since_revision.
    Returns the updated topic dict.
    """
    from backend.models import QuizResult, Topic

    qr = QuizResult(topic_id=topic_id, score=score, notes=notes)
    db.add(qr)

    topic = db.get(Topic, topic_id)
    if topic:
        topic.prev_quiz_score = score
        topic.days_since_revision = 0  # just revised

    db.commit()
    return {"topic_id": topic_id, "score": score, "updated_quiz_score": score}


# ─── Tool 6: replan_remaining_sessions ────────────────────────────────────────
def replan_remaining_sessions(
    db: "DBSession",
    reason: str = "quiz_score_updated",
    daily_hours: float = 3.0,
    days_ahead: int = 14,
) -> dict:
    """
    Adaptive replanning:
    1. Re-fetch topics (scores may have changed).
    2. Re-predict difficulty (ML).
    3. Re-calculate priorities.
    4. Regenerate upcoming sessions.
    Returns summary + decisions.
    """
    topics = get_topics_and_deadlines(db)
    topics = predict_topic_difficulty(db, topics)
    topics = calculate_topic_priority(db, topics)
    sessions = generate_study_schedule(
        db, topics,
        days_ahead=days_ahead,
        daily_hours=daily_hours,
        delete_upcoming=True,
    )
    return {
        "reason": reason,
        "sessions_created": len(sessions),
        "top_topics": [
            {"name": t["name"], "priority": t["priority_score"], "difficulty": t.get("predicted_difficulty")}
            for t in topics[:5]
        ],
    }
