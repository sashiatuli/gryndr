"""
agent/agent.py — GRYNDR Adaptive Planning Agent

This is a transparent, policy-based tool-using agent.
It does NOT use an LLM. All decisions are made by explicit rules,
with each step logged so the user understands what happened and why.

AGENT DECISION FLOW
────────────────────
State: {topics, difficulty_predictions, priorities, sessions, logs}

Step 1  [TOOL: get_topics_and_deadlines]
        → Fetch current topics, exam dates, quiz history, session counts.
        Decision: "How many topics? Are there exams within 14 days?"

Step 2  [TOOL: predict_topic_difficulty]
        → Run ML model for each topic. Classify: Easy / Medium / Hard.
        Decision: "Which topics are Hard or Medium? Flag them."

Step 3  [TOOL: calculate_topic_priority]
        → Score each topic on difficulty, urgency, revision gap, performance.
        Decision: "Rank topics. Top-priority topics get more sessions first."

Step 4  [TOOL: generate_study_schedule]
        → Build a session timetable across the next N days.
        Decision: "Hard = 4 sessions, Medium = 3, Easy = 2.
                   Topics with closer deadlines get earlier slots."

Step 5  [LOG] Summarise actions and reasons.

On REPLAN (triggered after quiz/session update):
  Repeats Steps 1→4 but only regenerates UPCOMING sessions.
  Detects score drops (>10 pts) and escalates difficulty allocation.
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.orm import Session as DBSession

from backend.agent.tools import (
    get_topics_and_deadlines,
    predict_topic_difficulty,
    calculate_topic_priority,
    generate_study_schedule,
    replan_remaining_sessions,
)


def _log(db: "DBSession", action: str, details: str):
    """Write an entry to agent_logs and return it as a dict."""
    from backend.models import AgentLog
    entry = AgentLog(action=action, details=details)
    db.add(entry)
    db.flush()
    return {"id": entry.id, "action": action, "details": details,
            "created_at": entry.created_at or datetime.now(timezone.utc)}


def run_generate_plan(
    db: "DBSession",
    days_ahead: int = 14,
    daily_hours: float = 3.0,
    start_date_str: str | None = None,
) -> dict:
    """
    Full plan generation agent run.
    Returns AgentResult-compatible dict.
    """
    logs = []

    # ── Step 1: Inspect topics ────────────────────────────────────
    logs.append(_log(db, "get_topics_and_deadlines",
                     "Fetching all topics, exam dates, quiz history, and session counts."))
    topics = get_topics_and_deadlines(db)

    if not topics:
        logs.append(_log(db, "abort",
                         "No topics found in database. Add topics first, then generate a plan."))
        db.commit()
        return _build_result(False, 0, 0, logs,
                             "No topics found. Please add topics before generating a plan.")

    logs.append(_log(db, "inspect_complete",
                     f"Found {len(topics)} topic(s) across "
                     f"{len(set(t['subject_id'] for t in topics))} subject(s)."))

    # ── Step 2: Predict difficulty ────────────────────────────────
    logs.append(_log(db, "predict_topic_difficulty",
                     "Running RandomForest ML model to classify each topic as Easy / Medium / Hard."))
    topics = predict_topic_difficulty(db, topics)

    counts = {"Easy": 0, "Medium": 0, "Hard": 0}
    for t in topics:
        counts[t.get("predicted_difficulty", "Medium")] += 1
    logs.append(_log(db, "difficulty_summary",
                     f"Difficulty distribution — Easy: {counts['Easy']}, "
                     f"Medium: {counts['Medium']}, Hard: {counts['Hard']}."))

    # ── Step 3: Calculate priority ────────────────────────────────
    logs.append(_log(db, "calculate_topic_priority",
                     "Scoring each topic: difficulty (35 pts) + exam urgency (30 pts) "
                     "+ revision gap (20 pts) + low quiz score (15 pts)."))
    topics = calculate_topic_priority(db, topics)

    top3 = topics[:3]
    logs.append(_log(db, "priority_ranking",
                     "Top-priority topics: "
                     + ", ".join(f"{t['name']} ({t['priority_score']:.1f})" for t in top3)))

    # ── Step 4: Schedule ──────────────────────────────────────────
    logs.append(_log(db, "generate_study_schedule",
                     f"Building {days_ahead}-day schedule with {daily_hours}h/day. "
                     "Hard topics → 4 sessions, Medium → 3, Easy → 2."))
    sessions = generate_study_schedule(
        db, topics,
        days_ahead=days_ahead,
        daily_hours=daily_hours,
        start_date_str=start_date_str,
        delete_upcoming=True,
    )

    logs.append(_log(db, "schedule_complete",
                     f"Created {len(sessions)} study session(s) over the next {days_ahead} day(s). "
                     "Highest-priority topics scheduled earliest."))

    explanation = (
        f"Plan generated for {len(topics)} topic(s). "
        f"The ML model identified {counts['Hard']} hard, {counts['Medium']} medium, "
        f"and {counts['Easy']} easy topic(s). "
        f"Priority scoring ranked '{top3[0]['name']}' first "
        f"(score {top3[0]['priority_score']:.1f}/100). "
        f"Created {len(sessions)} study sessions over the next {days_ahead} days. Completed work counts toward allocations; exam dates and daily capacity limit scheduling."
    )

    db.commit()
    return _build_result(True, len(sessions), 0, logs, explanation)


def run_replan(
    db: "DBSession",
    reason: str = "quiz_score_updated",
    daily_hours: float = 3.0,
    days_ahead: int = 14,
) -> dict:
    """
    Adaptive replanning: detect changes, rerun pipeline, update plan.
    """
    logs = []

    logs.append(_log(db, "replan_triggered",
                     f"Replanning triggered. Reason: '{reason}'. "
                     "Fetching updated topic data including latest quiz scores."))

    topics = get_topics_and_deadlines(db)
    if not topics:
        db.commit()
        return _build_result(False, 0, 0, logs, "No topics to replan.")

    # Detect score drops vs stored difficulty
    logs.append(_log(db, "predict_topic_difficulty",
                     "Re-running ML model with updated quiz scores and revision gaps."))
    old_difficulties = {t["id"]: t["predicted_difficulty"] for t in topics}
    topics = predict_topic_difficulty(db, topics)

    changes = []
    for t in topics:
        old = old_difficulties.get(t["id"])
        new = t.get("predicted_difficulty")
        if old and new and old != new:
            changes.append(f"'{t['name']}' changed from {old} → {new}")

    if changes:
        logs.append(_log(db, "difficulty_changes_detected",
                         "Difficulty reclassification: " + "; ".join(changes)))
    else:
        logs.append(_log(db, "no_difficulty_changes",
                         "No difficulty reclassification detected — priority adjustments still applied."))

    logs.append(_log(db, "calculate_topic_priority",
                     "Recalculating priorities with fresh quiz scores and revision gaps."))
    topics = calculate_topic_priority(db, topics)

    logs.append(_log(db, "replan_schedule",
                     f"Regenerating upcoming sessions only. "
                     f"Daily budget: {daily_hours}h, horizon: {days_ahead} days."))
    sessions = generate_study_schedule(
        db, topics,
        days_ahead=days_ahead,
        daily_hours=daily_hours,
        delete_upcoming=True,
    )

    logs.append(_log(db, "replan_complete",
                     f"Replanning complete. Created {len(sessions)} upcoming session(s). "
                     f"Completed sessions are unchanged."))

    explanation = (
        f"Adaptive replan triggered by: '{reason}'. "
        + (f"Difficulty changes detected: {'; '.join(changes)}. " if changes else "No difficulty changes. ")
        + f"Priorities recalculated. {len(sessions)} upcoming sessions rebuilt "
        f"with highest-priority topics scheduled first."
    )

    db.commit()
    return _build_result(True, len(sessions), 0, logs, explanation)


def _build_result(
    success: bool,
    sessions_created: int,
    sessions_modified: int,
    logs: list[dict],
    explanation: str,
) -> dict:
    return {
        "success": success,
        "sessions_created": sessions_created,
        "sessions_modified": sessions_modified,
        "actions": logs,
        "explanation": explanation,
    }
