import { type LucideIcon } from 'lucide-react'

export interface Exam {
  id: string
  subject: string
  date: string
  color: string
}

export interface Session {
  id: string
  subject: string
  topic: string
  duration: number
  status: 'done' | 'active' | 'upcoming'
  time: string
}

export interface TopicDifficulty {
  topic: string
  score: number
  subject: string
}

export interface WeeklyProgress {
  day: string
  planned: number
  actual: number
}

export interface SubjectHours {
  name: string
  value: number
  fill: string
}

export interface AISuggestion {
  id: string
  type: 'reschedule' | 'difficulty' | 'wellbeing'
  message: string
  icon: string
}

export interface NavItem {
  id: string
  label: string
  icon: LucideIcon
  href: string
}
