import { useEffect, useState } from 'react'
import { CalendarDays, CalendarPlus, ChevronDown, ChevronLeft, ChevronRight, Clock3, GraduationCap, Mail, X } from 'lucide-react'
import scheduleData from '../rozklad_2026-2027.json'
import type { CalendarEvent, DayKey, Lesson, ScheduleData, Teacher } from './types'

const DAYS: Array<{ key: DayKey; label: string }> = [
  { key: 'пн', label: 'Понеділок' },
  { key: 'вт', label: 'Вівторок' },
  { key: 'ср', label: 'Середа' },
  { key: 'чт', label: 'Четвер' },
  { key: 'пт', label: "П'ятниця" },
]

const SEMESTER_START = '2026-09-01'
const SEMESTER_END = '2026-12-18'
const HOLIDAY_START = '2026-10-26'
const HOLIDAY_END = '2026-10-30'
const WEEK_DAYS: Record<DayKey, number> = { пн: 1, вт: 2, ср: 3, чт: 4, пт: 5 }
const BELL_TIMES = ['08:30', '09:25', '10:30', '11:35', '12:35', '13:35', '14:30', '15:25']
const BELL_END_TIMES = ['09:15', '10:10', '11:15', '12:20', '13:20', '14:20', '15:15', '16:10']
const BREAK_MINUTES = [10, 20, 20, 15, 15, 15, 10]
const WEEK_STARTS = ['2026-09-01', ...Array.from({ length: 15 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 8, 7 + index * 7))
  return date.toISOString().slice(0, 10)
})]

function addMinutes(time: string, minutes: number) {
  const [hours, minute] = time.split(':').map(Number)
  const total = hours * 60 + minute + minutes
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function lessonDuration(classes: string) {
  const grades = [...classes.matchAll(/\b(\d{1,2})\s*-/g)].map((match) => Number(match[1]))
  if (grades.includes(1)) return 35
  if (grades.some((grade) => grade >= 2 && grade <= 4)) return 40
  return 45
}

function dateValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

function isHoliday(date: Date) {
  const value = dateValue(date)
  return value >= HOLIDAY_START && value <= HOLIDAY_END
}

function isLessonInWeek(lesson: Lesson, weekType: 'A' | 'B') {
  return !lesson.week || lesson.week === weekType
}

function defaultWeekIndex() {
  const today = dateValue(new Date())
  const index = WEEK_STARTS.findIndex((weekStart, weekIndex) => {
    const end = new Date(`${weekStart}T12:00:00Z`)
    end.setUTCDate(end.getUTCDate() + (weekIndex === 0 ? 3 : 4))
    return today >= weekStart && today <= dateValue(end)
  })
  if (index >= 0) return index
  return today < SEMESTER_START ? 0 : WEEK_STARTS.length - 1
}

function weekTypeFor(weekStart: string): 'A' | 'B' | null {
  if (weekStart === HOLIDAY_START) return null
  const activeWeeksBefore = WEEK_STARTS.filter((start) => start < weekStart && start !== HOLIDAY_START).length
  return activeWeeksBefore % 2 === 0 ? 'A' : 'B'
}

function dayDate(weekStart: string, day: DayKey) {
  const date = new Date(`${weekStart}T12:00:00Z`)
  const offset = weekStart === SEMESTER_START ? WEEK_DAYS[day] - 2 : WEEK_DAYS[day] - 1
  date.setUTCDate(date.getUTCDate() + offset)
  const value = dateValue(date)
  return value >= SEMESTER_START && value <= SEMESTER_END ? date : null
}

function dayDateLabel(date: Date | null) {
  return date ? new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit' }).format(date) : '—'
}

function weekRangeLabel(weekStart: string) {
  const start = new Date(`${weekStart}T12:00:00Z`)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + (weekStart === SEMESTER_START ? 3 : 4))
  const format = new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: 'short' })
  return `${format.format(start)} – ${format.format(end)}`
}

function dayForLesson(lesson: Lesson, from: string, to: string, expectedWeek: 'A' | 'B' | null) {
  const date = new Date(`${from}T12:00:00Z`)
  const limit = new Date(`${to}T12:00:00Z`)
  while (date <= limit) {
    if (date.getUTCDay() === WEEK_DAYS[lesson.day]) {
      const weekStart = WEEK_STARTS.find((start) => dateValue(date) >= start && dateValue(date) <= dateValue(new Date(new Date(`${start}T12:00:00Z`).getTime() + (start === SEMESTER_START ? 3 : 4) * 86_400_000)))
      if (!isHoliday(date) && (!expectedWeek || weekTypeFor(weekStart ?? SEMESTER_START) === expectedWeek)) return dateValue(date)
    }
    date.setUTCDate(date.getUTCDate() + 1)
  }
  return null
}

function createEvents(teacher: Teacher): CalendarEvent[] {
  const events: CalendarEvent[] = []

  for (const lesson of teacher.lessons) {
    const startTime = BELL_TIMES[lesson.lesson - 1]
    const endTime = addMinutes(startTime, lessonDuration(lesson.classes))
    const ranges = lesson.week
      ? [[SEMESTER_START, '2026-10-23'], ['2026-11-02', SEMESTER_END]]
      : [[SEMESTER_START, '2026-10-23'], ['2026-11-02', SEMESTER_END]]
    for (const [from, to] of ranges) {
      const date = dayForLesson(lesson, from, to, lesson.week)
      if (date) {
        events.push({
          summary: `${lesson.subject} · ${lesson.classes}${lesson.group ? ` (${lesson.group})` : ''}`,
          description: [`Викладач: ${teacher.name}`, `Урок ${lesson.lesson}`, `Тривалість: ${lessonDuration(lesson.classes)} хв`, lesson.room ? `Кабінет: ${lesson.room}` : null, lesson.week ? `Тиждень: ${lesson.week === 'A' ? 'чисельник' : 'знаменник'}` : null].filter(Boolean).join('\n'),
          start: `${date}T${startTime}:00+03:00`,
          end: `${date}T${endTime}:00+03:00`,
          recurrence: [`RRULE:FREQ=WEEKLY;INTERVAL=${lesson.week ? 2 : 1};UNTIL=${to.replaceAll('-', '')}T235959Z`],
        })
      }
    }
  }
  return events
}

function LessonCard({ lesson }: { lesson: Lesson }) {
  return (
    <article className={`lesson-card ${lesson.week === 'A' ? 'numerator-lesson' : lesson.week === 'B' ? 'denominator-lesson' : 'regular-lesson'}`}>
      <strong>{lesson.subject}</strong>
      <span>{lesson.classes}{lesson.group ? ` · ${lesson.group}` : ''}</span>
      {(lesson.room || lesson.week) && <small>{[lesson.room && `каб. ${lesson.room}`, lesson.week === 'A' ? 'чисельник' : lesson.week === 'B' ? 'знаменник' : null].filter(Boolean).join(' · ')}</small>}
    </article>
  )
}

export function App() {
  const data = scheduleData as ScheduleData
  const sortedTeachers = [...data.teachers].sort((first, second) => first.name.localeCompare(second.name, 'uk'))
  const [teacherName, setTeacherName] = useState(sortedTeachers[0]?.name ?? '')
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [gmail, setGmail] = useState('')
  const [weekIndex, setWeekIndex] = useState(defaultWeekIndex)
  const [status, setStatus] = useState('')

  const teacher = data?.teachers.find((item) => item.name === teacherName)
  const weekStart = WEEK_STARTS[weekIndex]
  const weekType = weekTypeFor(weekStart)
  const isVacationWeek = weekStart === HOLIDAY_START
  const lessons = weekType ? (teacher?.lessons ?? []).filter((lesson) => isLessonInWeek(lesson, weekType)) : []
  const totalEvents = teacher ? createEvents(teacher).length : 0

  function beginCalendarImport(event: React.FormEvent) {
    event.preventDefault()
    if (!teacher || !gmail.endsWith('@gmail.com')) {
      setStatus('Введіть адресу Gmail, до якої має бути надано доступ.')
      return
    }
    const events = createEvents(teacher)
    sessionStorage.setItem('calendar-events', JSON.stringify(events))
    sessionStorage.setItem('calendar-email', gmail)
    window.location.assign('/api/auth/google')
  }

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('calendar') !== 'connected') return
    const stored = sessionStorage.getItem('calendar-events')
    if (!stored) return
    fetch('/api/calendar/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: stored })
      .then((response) => response.json().then((body) => ({ response, body })))
      .then(({ response, body }) => setStatus(response.ok ? `Створено подій: ${body.created}.` : (body.error ?? 'Не вдалося створити події.')))
      .catch(() => setStatus('Помилка з’єднання з Google Calendar.'))
      .finally(() => {
        sessionStorage.removeItem('calendar-events')
        sessionStorage.removeItem('calendar-email')
        window.history.replaceState({}, '', '/')
      })
  }, [])

  return (
    <main>
      <header className="topbar">
        <div className="brand"><GraduationCap size={27} /><span>Мій розклад</span></div>
        <span className="term">I семестр · 2026/27</span>
      </header>
      <section className="intro">
        <div>
          <p className="eyebrow">Робочий тиждень</p>
          <h1>Ваш розклад</h1>
          <p>Оберіть себе, щоб побачити уроки на тиждень.</p>
        </div>
        <label className="teacher-select">
          <span>Викладач</span>
          <div><select value={teacherName} onChange={(event) => setTeacherName(event.target.value)}>{sortedTeachers.map((item) => <option key={item.name}>{item.name}</option>)}</select><ChevronDown size={18} /></div>
        </label>
      </section>
      <section className="schedule-section" aria-label="Тижневий розклад">
        <div className="schedule-toolbar"><p><Clock3 size={17} /> Уроки 1–8</p><div className="toolbar-actions"><div className="week-navigation"><button type="button" aria-label="Попередній тиждень" disabled={weekIndex === 0} onClick={() => setWeekIndex((index) => index - 1)}><ChevronLeft size={18} /></button><p><CalendarDays size={16} /><span>{weekRangeLabel(weekStart)}</span>{weekType && <strong className={weekType === 'A' ? 'numerator' : 'denominator'}>{weekType === 'A' ? 'чисельник' : 'знаменник'}</strong>}{isVacationWeek && <strong className="vacation-badge">канікули</strong>}</p><button type="button" aria-label="Наступний тиждень" disabled={weekIndex === WEEK_STARTS.length - 1} onClick={() => setWeekIndex((index) => index + 1)}><ChevronRight size={18} /></button></div><div className="week-legend"><span><i className="legend-swatch numerator-swatch" /> чисельник</span><span><i className="legend-swatch denominator-swatch" /> знаменник</span></div><button type="button" onClick={() => { setStatus(''); setCalendarOpen(true) }}><CalendarPlus size={18} /> Додати в Google Calendar</button></div></div>
        <div className="schedule-wrap"><div className="schedule-grid">
          <div className="corner">Урок</div><div className="corner time-heading">Час</div>{DAYS.map((day) => <div className="day-heading" key={day.key}><span>{day.label}</span><small>{dayDateLabel(dayDate(weekStart, day.key))}</small></div>)}
          {Array.from({ length: 8 }, (_, index) => index + 1).flatMap((number) => [
            <div className="lesson-number" key={`number-${number}`}>{number}</div>,
            <div className="lesson-time" key={`time-${number}`}><strong>{BELL_TIMES[number - 1]}</strong><span>{BELL_END_TIMES[number - 1]}</span>{number < 8 && <small className="break-guide">{BREAK_MINUTES[number - 1]} хв перерва</small>}</div>,
            ...DAYS.map((day) => <div className="schedule-cell" key={`${day.key}-${number}`}>{lessons.filter((lesson) => lesson.day === day.key && lesson.lesson === number).map((lesson, index) => <LessonCard key={`${lesson.raw}-${index}`} lesson={lesson} />)}</div>),
          ])}
        </div>{isVacationWeek && <div className="holiday-overlay"><CalendarDays size={30} /><strong>Канікули</strong><span>26–30 жовтня</span></div>}</div>
      </section>
      {status && <p className="notice" role="status">{status}</p>}
      {calendarOpen && <div className="modal-backdrop" role="presentation"><section className="calendar-modal" role="dialog" aria-modal="true" aria-labelledby="calendar-title">
        <button className="close" onClick={() => setCalendarOpen(false)} aria-label="Закрити"><X size={20} /></button>
        <Mail className="modal-icon" size={25} /><p className="eyebrow">Google Calendar</p><h2 id="calendar-title">Додати уроки до календаря</h2>
        <p>Ви підтвердите доступ у своєму обліковому записі Google. Ми створимо {totalEvents} повторюваних серій уроків на період 01.09–18.12.2026, крім канікул 26–30 жовтня. Час початку взято з розкладу дзвінків; тривалість залежить від класу.</p>
        <form onSubmit={beginCalendarImport}>
          <label>Адреса Gmail<input type="email" required value={gmail} placeholder="name@gmail.com" onChange={(event) => setGmail(event.target.value)} /></label>
          <button className="confirm" type="submit">Продовжити з Google <CalendarPlus size={18} /></button>
        </form>
      </section></div>}
    </main>
  )
}