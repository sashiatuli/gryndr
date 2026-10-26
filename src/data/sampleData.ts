// Centralised sample data for the visual prototype
// None of these values are connected to ML or AI – they are placeholders.
import type { Session, AISuggestion } from '../types'

export const EXAMS = [
  { id: 'e1', subject: 'Advanced Calculus', date: '2026-11-08', color: '#DDA9BB' },
  { id: 'e2', subject: 'Organic Chemistry', date: '2026-11-14', color: '#A7B5A0' },
  { id: 'e3', subject: 'Modern History',    date: '2026-11-22', color: '#C98BA6' },
]

export const TODAY_SESSIONS: Session[] = [
  { id: 's1', subject: 'Calculus', topic: 'Integration by Parts', duration: 60,  status: 'done',    time: '09:00' },
  { id: 's2', subject: 'Chemistry', topic: 'Reaction Mechanisms',  duration: 45,  status: 'active',  time: '11:00' },
  { id: 's3', subject: 'History',   topic: 'The Cold War Era',      duration: 30,  status: 'upcoming',time: '14:30' },
  { id: 's4', subject: 'Calculus', topic: 'Taylor Series',          duration: 50,  status: 'upcoming',time: '16:00' },
]

export const TOPIC_DIFFICULTY = [
  { topic: 'Integration',      score: 72, subject: 'Calculus'   },
  { topic: 'Reaction Mech.',   score: 45, subject: 'Chemistry'  },
  { topic: 'Nuclear Physics',  score: 31, subject: 'Physics'    },
  { topic: 'Cold War',         score: 88, subject: 'History'    },
  { topic: 'Taylor Series',    score: 61, subject: 'Calculus'   },
  { topic: 'Organic Bonds',    score: 54, subject: 'Chemistry'  },
]

export const WEEKLY_PROGRESS = [
  { day: 'Mon', planned: 120, actual: 105 },
  { day: 'Tue', planned: 90,  actual: 90  },
  { day: 'Wed', planned: 100, actual: 130 },
  { day: 'Thu', planned: 80,  actual: 60  },
  { day: 'Fri', planned: 110, actual: 95  },
  { day: 'Sat', planned: 60,  actual: 70  },
  { day: 'Sun', planned: 40,  actual: 0   },
]

export const SUBJECT_HOURS = [
  { name: 'Calculus',  value: 14.5, fill: '#DDA9BB' },
  { name: 'Chemistry', value: 11.0, fill: '#A7B5A0' },
  { name: 'History',   value: 7.0,  fill: '#C98BA6' },
  { name: 'Physics',   value: 5.5,  fill: '#E8C4D0' },
]

export const AI_SUGGESTIONS: AISuggestion[] = [
  {
    id: 'ai1',
    type: 'reschedule',
    message: 'Your Chemistry session tomorrow overlaps with high-focus hours. Consider moving it to 10 AM for better retention.',
    icon: 'calendar',
  },
  {
    id: 'ai2',
    type: 'difficulty',
    message: 'Nuclear Physics mastery is at 31 %. A targeted 25-min drill before Thursday could improve this significantly.',
    icon: 'zap',
  },
  {
    id: 'ai3',
    type: 'wellbeing',
    message: 'You have studied 4.2 hours today. Taking a 20-minute break now will improve recall in your next session.',
    icon: 'heart',
  },
]
