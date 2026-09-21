import { useEffect, useState } from 'react'
import { CalendarPlus, ChevronDown, Clock3, GraduationCap, Mail, X } from 'lucide-react'
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

function addMinutes(time: string, minutes: number) {
  const [hours, minute] = time.split(':').map(Number)
  const total = hours * 60 + minute + minutes
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function slotTime(slot: number, firstLesson: string, lessonMinutes: number, breakMinutes: number) {
  return addMinutes(firstLesson, (slot - 1) * (lessonMinutes + breakMinutes))
}

function isHoliday(date: Date) {
  const value = date.toISOString().slice(0, 10)
  return value >= HOLIDAY_START && value <= HOLIDAY_END
}

function createEvents(teacher: Teacher, firstLesson: string, lessonMinutes: number, breakMinutes: number): CalendarEvent[] {
  const events: CalendarEvent[] = []
  const start = new Date(`${SEMESTER_START}T12:00:00`)
  const end = new Date(`${SEMESTER_END}T12:00:00`)

  for (const lesson of teacher.lessons) {
    const classDate = new Date(start)
    classDate.setDate(start.getDate() + ((WEEK_DAYS[lesson.day] - start.getDay() + 7) % 7))
    const startTime = slotTime(lesson.lesson, firstLesson, lessonMinutes, breakMinutes)
    const endTime = addMinutes(startTime, lessonMinutes)
    while (classDate <= end) {
      if (!isHoliday(classDate)) {
        const date = classDate.toISOString().slice(0, 10)
        events.push({
          summary: `${lesson.subject} · ${lesson.classes}${lesson.group ? ` (${lesson.group})` : ''}`,
          description: [`Викладач: ${teacher.name}`, `Урок ${lesson.lesson}`, lesson.room ? `Кабінет: ${lesson.room}` : null, lesson.week ? `Тиждень: ${lesson.week}` : null].filter(Boolean).join('\n'),
          start: `${date}T${startTime}:00+03:00`,
          end: `${date}T${endTime}:00+03:00`,
        })
      }
      classDate.setDate(classDate.getDate() + 7)
    }
  }
  return events
}

function LessonCard({ lesson }: { lesson: Lesson }) {
  return (
    <article className="lesson-card">
      <strong>{lesson.subject}</strong>
      <span>{lesson.classes}{lesson.group ? ` · ${lesson.group}` : ''}</span>
      {(lesson.room || lesson.week) && <small>{[lesson.room && `каб. ${lesson.room}`, lesson.week].filter(Boolean).join(' · ')}</small>}
    </article>
  )
}

export function App() {
  const data = scheduleData as ScheduleData
  const [teacherName, setTeacherName] = useState('')
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [gmail, setGmail] = useState('')
  const [firstLesson, setFirstLesson] = useState('08:30')
  const [lessonMinutes, setLessonMinutes] = useState(45)
  const [breakMinutes, setBreakMinutes] = useState(10)
  const [status, setStatus] = useState('')

  useEffect(() => setTeacherName(data.teachers[0]?.name ?? ''), [data.teachers])

  const teacher = data?.teachers.find((item) => item.name === teacherName)
  const lessons = teacher?.lessons ?? []
  const totalEvents = teacher ? createEvents(teacher, firstLesson, lessonMinutes, breakMinutes).length : 0

  function beginCalendarImport(event: React.FormEvent) {
    event.preventDefault()
    if (!teacher || !gmail.endsWith('@gmail.com')) {
      setStatus('Введіть адресу Gmail, до якої має бути надано доступ.')
      return
    }
    const events = createEvents(teacher, firstLesson, lessonMinutes, breakMinutes)
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
          <div><select value={teacherName} onChange={(event) => setTeacherName(event.target.value)}>{data.teachers.map((item) => <option key={item.name}>{item.name}</option>)}</select><ChevronDown size={18} /></div>
        </label>
      </section>
      <section className="schedule-section" aria-label="Тижневий розклад">
        <div className="schedule-toolbar"><p><Clock3 size={17} /> Уроки 1–8</p><button type="button" onClick={() => { setStatus(''); setCalendarOpen(true) }}><CalendarPlus size={18} /> Додати в Google Calendar</button></div>
        <div className="schedule-wrap"><div className="schedule-grid">
          <div className="corner">Урок</div>{DAYS.map((day) => <div className="day-heading" key={day.key}>{day.label}</div>)}
          {Array.from({ length: 8 }, (_, index) => index + 1).flatMap((number) => [
            <div className="lesson-number" key={`number-${number}`}>{number}</div>,
            ...DAYS.map((day) => <div className="schedule-cell" key={`${day.key}-${number}`}>{lessons.filter((lesson) => lesson.day === day.key && lesson.lesson === number).map((lesson, index) => <LessonCard key={`${lesson.raw}-${index}`} lesson={lesson} />)}</div>),
          ])}
        </div></div>
      </section>
      {status && <p className="notice" role="status">{status}</p>}
      {calendarOpen && <div className="modal-backdrop" role="presentation"><section className="calendar-modal" role="dialog" aria-modal="true" aria-labelledby="calendar-title">
        <button className="close" onClick={() => setCalendarOpen(false)} aria-label="Закрити"><X size={20} /></button>
        <Mail className="modal-icon" size={25} /><p className="eyebrow">Google Calendar</p><h2 id="calendar-title">Додати уроки до календаря</h2>
        <p>Ви підтвердите доступ у своєму обліковому записі Google. Ми створимо {totalEvents} подій на період 01.09–18.12.2026, крім канікул 26–30 жовтня.</p>
        <form onSubmit={beginCalendarImport}>
          <label>Адреса Gmail<input type="email" required value={gmail} placeholder="name@gmail.com" onChange={(event) => setGmail(event.target.value)} /></label>
          <div className="time-settings"><label>Перший урок<input type="time" value={firstLesson} onChange={(event) => setFirstLesson(event.target.value)} /></label><label>Тривалість, хв<input type="number" min="30" max="90" value={lessonMinutes} onChange={(event) => setLessonMinutes(Number(event.target.value))} /></label><label>Перерва, хв<input type="number" min="0" max="45" value={breakMinutes} onChange={(event) => setBreakMinutes(Number(event.target.value))} /></label></div>
          <button className="confirm" type="submit">Продовжити з Google <CalendarPlus size={18} /></button>
        </form>
      </section></div>}
    </main>
  )
}