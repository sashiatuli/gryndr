# GRYNDR — Adaptive Study Planner

A local React/Vite/TypeScript app with FastAPI, SQLite/SQLAlchemy, a scikit-learn difficulty model and a transparent rule-based planning agent. No API keys or paid services are required.

## Start on Windows

Open two PowerShell terminals. In **both**, enter:

```powershell
cd C:\Users\sashi\OneDrive\Desktop\gryndr_edited\gryndr
```

Backend (uses the existing `.venv`; activation is unnecessary):

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Frontend:

```powershell
npm run dev
```

Open http://localhost:5173/ (or http://127.0.0.1:5173/). API docs: http://127.0.0.1:8000/docs. Use Ctrl+C in each terminal to stop it. If a port is occupied by an older GRYNDR process, stop that process before starting the updated service. Vite uses a strict port so it cannot silently move outside the API's allowed CORS origins.

For a fresh installation, use Node.js 22.12+ and Python 3.13, then run:

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
npm ci
```

## Demo walkthrough

1. **Subjects:** add a subject with an optional exam date, then add a topic with confidence, baseline quiz score, revision gap, available hours and complexity. New records appear immediately. Use **Predict difficulty** to run the local model and inspect its class probabilities.
2. **Planner:** choose 1–60 days and 0.5–10 study hours per day; generate a plan. Sessions are saved in SQLite. The selected horizon and budget are saved for later quiz replanning.
3. **Mark complete** on a session. Completed study minutes and subject/session progress refresh across the app. Retrying completion does not duplicate quiz records or alter the original completion timestamp.
4. **Record quiz result:** choose a topic and score. The result is saved, topic performance is updated and revision gap is reset. Replanning is enabled by default and explains changes. If replanning fails, the quiz remains saved; retry **Replan now**, not quiz submission.
5. **AI Coach:** inspect actual prediction probabilities, priorities and persisted agent activity. **Analytics** shows recorded quiz averages, completed study minutes, subject progress and difficulty counts. Search in the header filters topics by topic/subject name.
6. **Settings:** inspect the API address and saved planning defaults, or open API documentation.

## Scheduling and data behavior

- SQLite lives at `backend/gryndr.db`, resolved relative to the backend module, independent of the current working directory. Startup creates missing tables without resetting existing records.
- Empty databases are seeded with demo subjects/topics by default. Demo topics are labelled in the UI and included in totals. To start an empty database, set `$env:GRYNDR_SEED_DEMO="0"` before launching the API; this does not remove existing data.
- `GRYNDR_DATABASE_URL` can point to a separate SQLite database. Tests use a temporary database and do not modify the user's database.
- Planning combines difficulty (up to 35 points), exam urgency (30), revision gap (20) and low quiz score (15). High-priority topics are allocated first; target allocations are Hard=4, Medium=3, Easy=2 sessions, minus completed work. Allocations are finite, so the planner may leave unused time.
- Sessions normally last 45 minutes; a 0.5-hour daily budget uses 30-minute sessions. Scheduling avoids overlapping preserved sessions, respects the daily budget and does not schedule a topic after its exam date. No new sessions may be possible if exams have passed, targets are complete, or capacity is occupied.
- Regeneration replaces only pending sessions inside the requested window. Completed/active sessions and sessions outside that window remain. Pending historical sessions are retained. Planning is transactional and simultaneous generations are serialized to prevent duplicates.
- Quiz-triggered replanning starts today using the saved horizon and daily budget. The API also supports an explicit future start date when generating a plan.
- Study time is the sum of completed session durations, not a stopwatch measurement. Weekly actual minutes use completion dates in UTC; planned minutes use scheduled dates. Subject progress means session completion, not measured mastery. Topic baseline scores are not counted as recorded quiz results.

## Model and configuration

The RandomForest model was trained on **synthetic data**. Its probabilities are prototype outputs, not calibrated educational assessments. Synthetic test metrics do not prove real-world accuracy. The planning agent uses explicit rules, not an external LLM.

If model loading fails, prediction/planning returns an actionable error; subject/topic creation and quiz recording still work. To train/rebuild the local demonstration model:

```powershell
.\.venv\Scripts\python.exe -m backend.train
```

Restart the API afterward to clear its cached model. To change the frontend API address, copy `.env.example` to `.env.local`, edit `VITE_API_URL`, then restart Vite. The default is `http://127.0.0.1:8000`.

## Verification

```powershell
npm run build
npm run test:ui
.\.venv\Scripts\python.exe -m pytest backend -q
```

The regression suite covers empty data, validation, subject/topic creation, real model prediction, saved schedules, daily budgets, deadlines, completion/progress, quiz persistence, saved replanning preferences, CORS, missing-model handling, failed-plan rollback, repeated generation and concurrent generation. Existing demo/user data is preserved.

The UI regression suite mounts the actual React app in jsdom and exercises navigation, forms, predictions, planning, completion, quizzes, filters, disclosures, loading states, validation and backend failures against a real FastAPI server with a temporary SQLite database. Only failure scenarios intercept requests; successful data is produced by the real backend. Browser automation is unavailable (no connected browser), so real-browser rendering and pointer hit-testing remain unverified. The production build, backend regression tests and live HTTP endpoints are also checked. The build may emit a non-failing chunk-size advisory, and tests emit an upstream Starlette/AnyIO deprecation warning.

This is a single-user local prototype with no authentication. Subject/topic editing and deletion are outside this demo's scope.

## Main changed files

- `src/App.tsx`, `src/store.tsx`, `src/api/client.ts`: navigation, shared API-backed state, mutations, validation/error handling and configuration.
- `src/pages/DashboardPage.tsx`, `SubjectsPage.tsx`, `SharedPanels.tsx`: real dashboard, subjects/topics forms, prediction, planning, session completion, quiz adaptation, analytics and agent history.
- `src/components/layout/{AppLayout,PageHeader,Sidebar}.tsx`, `src/components/dashboard/{ExamCountdown,StudyProgress}.tsx`, `src/index.css`: functional search/settings, data-driven charts, empty states and responsive layout.
- `backend/{main,schemas,models,database,predict,seed}.py`, `backend/agent/{agent,tools}.py`: validated API contracts, planner preferences, safe scheduling, persistence, analytics and model failure handling.
- `backend/test_api.py`: isolated regression tests. `vite.config.ts`, `.env.example`, `.gitignore`, and this README: startup/configuration and local artifact exclusions.

## Interaction fixes

Request feedback stays visible while scrolling and can be dismissed after completion. Each mutation shows a loading label, preserves its original error if a subsequent refresh also fails, and updates successful data sections even when another section cannot refresh. Older responses cannot overwrite newer action results. Successful generation/replanning switches the session filter to pending and reveals the saved schedule; AI Coach also displays sessions. Sidebar destinations have URL hashes, work with browser history, and reset the page's scroll position.

The functional changes are in `src/store.tsx`, `src/api/client.ts`, `src/App.tsx`, `src/pages/{SharedPanels,SubjectsPage}.tsx`, `src/components/layout/Sidebar.tsx`, and the feedback styles in `src/index.css`. The repeatable UI checks are in `tests/ui.integration.test.mjs`; `jsdom` is a development-only test dependency. No database reset or user-data mutation is performed by these tests.

### Session completion regression

`POST /sessions/{id}/complete` commits the existing `done` status and returns the saved session. The frontend now validates the returned ID/status/timestamp and immediately reconciles that response into shared session state and completion totals. It no longer depends on a second session-list request to remove the pending button. Successful responses display Completed in the completed/all list; failures retain the pending record and show the actual error. The request lock and disabled loading button prevent duplicate submissions, and the backend is idempotent for retries.

The UI regression suite also checks completion with a failed list refresh, a rejected or invalid response, duplicate clicks, displayed progress and reloading React state from SQLite. Backend tests verify exact-ID updates, independent database reads and concurrent completion retries. During the live verification on 26 October 2026, existing session 8 was completed through the API; direct SQLite/API reads confirmed `done`, the completion count increased from 8 to 9, and completed study time increased by 45 minutes.
