"""End-to-end regression tests using an isolated SQLite database; never writes user data."""
import os
import tempfile
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch

_test_dir = tempfile.TemporaryDirectory()
os.environ['GRYNDR_DATABASE_URL'] = 'sqlite:///' + str(Path(_test_dir.name) / 'test.db')
os.environ['GRYNDR_SEED_DEMO'] = '0'

import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import Base, engine, SessionLocal
from backend.models import StudySession, Topic, QuizResult, AgentLog
from backend import predict

@pytest.fixture(scope="session", autouse=True)
def cleanup_database():
    yield
    engine.dispose()
    _test_dir.cleanup()


@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)
    with TestClient(app) as client:
        yield client


def add_topic(client, name='Algebra', exam=None, **features):
    subject = client.post('/subjects', json={'name': name, 'exam_date': exam})
    assert subject.status_code == 201, subject.text
    response = client.post('/topics', json={'subject_id': subject.json()['id'], 'name': name + ' topic', **features})
    assert response.status_code == 201, response.text
    return response.json()


def generate(client, **options):
    response = client.post('/study-plan/generate', json={'days_ahead': 7, 'daily_hours': 3, **options})
    assert response.status_code == 200, response.text
    return response.json()


def test_full_workflow(client):
    assert client.get('/health').json()['status'] == 'ok'
    assert client.get('/analytics').json()['total_topics'] == 0
    assert generate(client)['success'] is False
    topic = add_topic(client, confidence=3, prev_quiz_score=40, complexity=9)
    result = generate(client, days_ahead=4, daily_hours=1)
    assert result['success'] and result['sessions_created'] > 0
    sessions = client.get('/study-plan').json()
    with SessionLocal() as db:
        assert db.query(StudySession).count() == len(sessions)
    first = sessions[0]
    completed = client.post(f"/sessions/{first['id']}/complete", json={'new_quiz_score': 65, 'notes': 'Reviewed'}).json()
    assert completed['status'] == 'done'
    # Retrying a completion must not add quiz records or change its timestamp.
    retry = client.post(f"/sessions/{first['id']}/complete", json={'new_quiz_score': 65}).json()
    assert retry == completed
    assert len(client.get('/quiz-results').json()) == 1
    before = client.get('/analytics').json()
    assert before['sessions_completed'] == 1
    assert before['total_study_minutes'] == first['duration_minutes']
    assert sum(d['minutes'] for d in before['weekly_minutes']) == first['duration_minutes']
    quiz = client.post('/quiz-results', json={'topic_id': topic['id'], 'score': 15, 'notes': 'Needs revision'})
    assert quiz.status_code == 201
    changed = client.get('/topics').json()[0]
    assert changed['prev_quiz_score'] == 15 and changed['days_since_revision'] == 0
    replan = client.post('/study-plan/replan', json={'reason': 'Quiz dropped from 65 to 15'})
    assert replan.status_code == 200 and replan.json()['success']
    after = client.get('/study-plan').json()
    assert next(s for s in after if s['id'] == first['id']) == completed
    assert all(s['scheduled_date'] < (date.today() + timedelta(days=4)).isoformat() for s in after)
    assert client.get('/planner-settings').json() == {'days_ahead': 4, 'daily_hours': 1}
    assert any('Quiz dropped' in log['details'] for log in client.get('/agent-logs').json())
    assert client.get('/analytics').json()['average_quiz_score'] == 40


def test_repeated_generation_no_duplicates_and_budget(client):
    for i in range(6):
        add_topic(client, name=f'Subject {i}', confidence=1, complexity=10)
    generate(client, days_ahead=2, daily_hours=10)
    first = client.get('/study-plan').json()
    generate(client, days_ahead=2, daily_hours=10)
    second = client.get('/study-plan').json()
    slots = [(s['topic_id'], s['scheduled_date'], s['scheduled_time']) for s in second]
    assert len(first) == len(second) and len(slots) == len(set(slots))
    for day in {s['scheduled_date'] for s in second}:
        daily = sorted([s for s in second if s['scheduled_date'] == day], key=lambda s: s['scheduled_time'])
        assert sum(s['duration_minutes'] for s in daily) <= 600
        ends = []
        for s in daily:
            h, m = map(int, s['scheduled_time'].split(':'))
            begin = h * 60 + m
            assert not ends or begin >= ends[-1]
            ends.append(begin + s['duration_minutes'])


def test_half_hour_budget_deadlines_and_preserved_sessions(client):
    topic = add_topic(client, exam=date.today().isoformat())
    with SessionLocal() as db:
        outside = StudySession(topic_id=topic['id'], scheduled_date=(date.today() + timedelta(days=30)).isoformat(), scheduled_time='08:00', duration_minutes=45)
        active = StudySession(topic_id=topic['id'], scheduled_date=date.today().isoformat(), scheduled_time='08:00', duration_minutes=30, status='active')
        db.add_all([outside, active]); db.commit(); outside_id, active_id = outside.id, active.id
    result = generate(client, daily_hours=0.5)
    assert result['sessions_created'] == 0
    sessions = client.get('/study-plan').json()
    assert {outside_id, active_id}.issubset({s['id'] for s in sessions})
    client.post(f'/sessions/{active_id}/complete', json={})
    other = add_topic(client, name='No deadline')
    generate(client, days_ahead=2, daily_hours=0.5)
    sessions = client.get('/study-plan').json()
    new = [s for s in sessions if s['topic_id'] == other['id']]
    assert len(new) == 1 and new[0]['duration_minutes'] == 30
    assert new[0]['scheduled_date'] == (date.today() + timedelta(days=1)).isoformat()


def test_validation_and_missing_records(client):
    for data in [{'name': '   '}, {'name': 'Test', 'exam_date': 'bad'}, {'name': 'Test', 'color': 'bad'}]:
        assert client.post('/subjects', json=data).status_code == 422
    assert client.post('/study-plan/generate', json={'start_date': 'bad'}).status_code == 422
    assert client.post('/study-plan/generate', json={'start_date': '2000-01-01'}).status_code == 422
    assert client.post('/study-plan/generate', json={'daily_hours': 0}).status_code == 422
    assert client.post('/topics', json={'subject_id': 999, 'name': 'Missing'}).status_code == 404
    assert client.post('/sessions/999/complete', json={}).status_code == 404
    assert client.post('/quiz-results', json={'topic_id': 999, 'score': 101}).status_code == 422
    assert client.post('/quiz-results', json={'topic_id': 999, 'score': 50}).status_code == 404
    topic = add_topic(client)
    assert client.post('/subjects', json={'name': 'Algebra'}).status_code == 400
    assert client.post('/topics', json={'subject_id': topic['subject_id'], 'name': topic['name']}).status_code == 409
    assert client.get('/agent-logs?limit=-1').status_code == 422


def test_prediction_and_missing_model_atomicity(client):
    topic = add_topic(client)
    inputs = {key: topic[key] for key in ['confidence', 'prev_quiz_score', 'days_since_revision', 'available_hours', 'complexity']}
    response = client.post('/predict-difficulty', json={**inputs, 'topic_id': topic['id']})
    assert response.status_code == 200
    assert abs(sum(response.json()['probabilities'].values()) - 1) < 0.001
    assert client.post('/predict-difficulty', json={**inputs, 'topic_id': 999}).status_code == 404
    generate(client)
    before = client.get('/study-plan').json()
    with patch.object(predict, '_model', None), patch.object(predict, 'MODEL_PATH', 'missing-model.joblib'):
        assert client.post('/predict-difficulty', json=inputs).status_code == 503
        assert client.post('/study-plan/generate', json={}).status_code == 503
        assert client.get('/study-plan').json() == before
        # Creation and quiz persistence still work without the model.
        new = client.post('/topics', json={'subject_id': topic['subject_id'], 'name': 'Unclassified'})
        assert new.status_code == 201 and new.json()['predicted_difficulty'] is None
        assert client.post('/quiz-results', json={'topic_id': topic['id'], 'score': 20}).status_code == 201
    with SessionLocal() as db:
        assert db.query(QuizResult).count() == 1


def test_cors_and_empty_collections(client):
    for path in ['/subjects', '/topics', '/study-plan', '/quiz-results', '/agent-logs']:
        assert client.get(path).json() == []
    for origin in ['http://localhost:5173', 'http://127.0.0.1:5173']:
        response = client.options('/subjects', headers={'Origin': origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type'})
        assert response.status_code == 200
        assert response.headers['access-control-allow-origin'] == origin

def test_replan_settings_and_transaction_rollback(client):
    add_topic(client)
    generate(client)
    response = client.post('/study-plan/replan', json={'reason': 'Less time available', 'daily_hours': 0.5, 'days_ahead': 3})
    assert response.status_code == 200
    assert client.get('/planner-settings').json() == {'days_ahead': 3, 'daily_hours': 0.5}
    before_sessions = client.get('/study-plan').json()
    before_topics = client.get('/topics').json()
    before_logs = client.get('/agent-logs').json()
    from backend.agent.tools import generate_study_schedule
    def fail_after_scheduling(*args, **kwargs):
        generate_study_schedule(*args, **kwargs)
        raise RuntimeError('Simulated failure before commit')
    with patch('backend.agent.agent.generate_study_schedule', side_effect=fail_after_scheduling):
        assert client.post('/study-plan/generate', json={'daily_hours': 5}).status_code == 503
    assert client.get('/study-plan').json() == before_sessions
    assert client.get('/topics').json() == before_topics
    assert client.get('/agent-logs').json() == before_logs
    assert client.get('/planner-settings').json() == {'days_ahead': 3, 'daily_hours': 0.5}


def test_concurrent_generation_does_not_duplicate(client):
    from concurrent.futures import ThreadPoolExecutor
    add_topic(client)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: client.post('/study-plan/generate', json={'days_ahead': 3, 'daily_hours': 2}), range(2)))
    assert all(r.status_code == 200 for r in results)
    sessions = client.get('/study-plan').json()
    assert len(sessions) == results[-1].json()['sessions_created']
    assert len({(s['scheduled_date'], s['scheduled_time']) for s in sessions}) == len(sessions)

def test_completion_targets_exact_id_and_persists_across_connections(client):
    add_topic(client)
    generate(client)
    sessions = client.get('/study-plan').json()
    target = sessions[-1]
    untouched = sessions[0]
    assert target['id'] != untouched['id']
    response = client.post(f"/sessions/{target['id']}/complete", json={})
    assert response.status_code == 200
    saved = response.json()
    assert saved['id'] == target['id'] and saved['status'] == 'done' and saved['completed_at']
    with SessionLocal() as db:
        assert db.get(StudySession, target['id']).status == 'done'
        assert db.get(StudySession, untouched['id']).status == untouched['status']
    assert client.get('/study-plan?status=done').json() == [saved]
    assert client.get('/analytics').json()['total_study_minutes'] == target['duration_minutes']
    # A failed validation must not complete another record.
    assert client.post(f"/sessions/{untouched['id']}/complete", json={'new_quiz_score': -1}).status_code == 422
    with SessionLocal() as db:
        assert db.get(StudySession, untouched['id']).status == untouched['status']


def test_simultaneous_completion_is_idempotent(client):
    from concurrent.futures import ThreadPoolExecutor
    add_topic(client)
    generate(client)
    target = client.get('/study-plan').json()[0]
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: client.post(f"/sessions/{target['id']}/complete", json={'new_quiz_score': 70}), range(2)))
    assert all(r.status_code == 200 for r in results)
    assert results[0].json() == results[1].json()
    assert client.get('/analytics').json()['sessions_completed'] == 1
    assert len(client.get('/quiz-results').json()) == 1
