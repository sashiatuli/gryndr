"""
seed.py — Seed GRYNDR database with demo data if empty.
All data is clearly labelled as DEMO.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.database import SessionLocal, engine
from backend.models import Base, Subject, Topic

DEMO_SUBJECTS = [
    {"name": "Advanced Mathematics",  "exam_date": "2026-11-10", "color": "#DDA9BB"},
    {"name": "Organic Chemistry",     "exam_date": "2026-11-18", "color": "#A7B5A0"},
    {"name": "Modern History",        "exam_date": "2026-11-28", "color": "#C98BA6"},
]

DEMO_TOPICS = [
    # Math
    {"subject": "Advanced Mathematics", "name": "Integration by Parts",
     "confidence": 4.0, "prev_quiz_score": 52.0, "days_since_revision": 12,
     "available_hours": 2.0, "complexity": 7},
    {"subject": "Advanced Mathematics", "name": "Taylor Series",
     "confidence": 3.0, "prev_quiz_score": 38.0, "days_since_revision": 20,
     "available_hours": 2.5, "complexity": 9},
    {"subject": "Advanced Mathematics", "name": "Linear Algebra Basics",
     "confidence": 7.0, "prev_quiz_score": 80.0, "days_since_revision": 3,
     "available_hours": 1.5, "complexity": 4},
    # Chemistry
    {"subject": "Organic Chemistry", "name": "Reaction Mechanisms",
     "confidence": 2.0, "prev_quiz_score": 31.0, "days_since_revision": 25,
     "available_hours": 2.0, "complexity": 9},
    {"subject": "Organic Chemistry", "name": "Functional Groups",
     "confidence": 6.0, "prev_quiz_score": 70.0, "days_since_revision": 5,
     "available_hours": 1.5, "complexity": 5},
    {"subject": "Organic Chemistry", "name": "Stereochemistry",
     "confidence": 3.5, "prev_quiz_score": 44.0, "days_since_revision": 15,
     "available_hours": 2.0, "complexity": 8},
    # History
    {"subject": "Modern History", "name": "The Cold War Era",
     "confidence": 8.0, "prev_quiz_score": 88.0, "days_since_revision": 2,
     "available_hours": 1.0, "complexity": 3},
    {"subject": "Modern History", "name": "Decolonisation Movements",
     "confidence": 5.0, "prev_quiz_score": 60.0, "days_since_revision": 10,
     "available_hours": 2.0, "complexity": 6},
]


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(Subject).count() > 0:
            print("Database already has data — skipping seed.")
            return

        subject_map = {}
        for s_data in DEMO_SUBJECTS:
            s = Subject(**s_data)
            db.add(s)
            db.flush()
            subject_map[s_data["name"]] = s.id
            print(f"  + Subject: {s_data['name']}")

        for original in DEMO_TOPICS:
            t_data = dict(original)
            subj_name = t_data.pop("subject")
            t = Topic(
                subject_id=subject_map[subj_name],
                is_demo=True,
                **t_data,
            )
            db.add(t)
            print(f"    → Topic: {t_data['name']}")

        db.commit()
        print(f"\n✓ Seeded {len(DEMO_SUBJECTS)} subjects and {len(DEMO_TOPICS)} demo topics.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
