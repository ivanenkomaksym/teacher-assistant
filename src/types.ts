export type DayKey = 'пн' | 'вт' | 'ср' | 'чт' | 'пт'

export interface Lesson {
  day: DayKey
  lesson: number
  week: string | null
  classes: string
  subject: string
  group: string | null
  room: string | null
  raw: string
}

export interface Teacher {
  name: string
  lessons: Lesson[]
}

export interface ScheduleData {
  title: string
  days: DayKey[]
  teachers: Teacher[]
}

export interface CalendarEvent {
  summary: string
  description: string
  start: string
  end: string
}