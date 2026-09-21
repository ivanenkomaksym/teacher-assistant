export interface Env {
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  OAUTH_STATE_SECRET: string
  ASSETS: Fetcher
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CALENDAR_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

function base64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return base64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))))
}

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }) }

function cookie(request: Request, name: string) {
  return request.headers.get('Cookie')?.split('; ').find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1)
}

async function callback(request: Request, env: Env) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) return new Response('Google authorization was not completed.', { status: 400 })
  const [timestamp, nonce, signature] = state.split('.')
  if (!timestamp || !nonce || !signature || signature !== await sign(`${timestamp}.${nonce}`, env.OAUTH_STATE_SECRET) || Date.now() - Number(timestamp) > 600_000) return new Response('Invalid authorization state.', { status: 400 })
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: `${url.origin}/api/auth/callback`, grant_type: 'authorization_code' }) })
  const token = await tokenResponse.json<{ access_token?: string, refresh_token?: string }>()
  if (!tokenResponse.ok || !token.access_token) return json({ error: 'Google token exchange failed.' }, 502)
  const value = base64Url(encoder.encode(JSON.stringify(token)))
  return new Response(null, { status: 302, headers: { Location: '/?calendar=connected', 'Set-Cookie': `calendar_auth=${value}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000` } })
}

async function createEvents(request: Request) {
  const auth = cookie(request, 'calendar_auth')
  if (!auth) return json({ error: 'Спершу підтвердьте доступ до Google Calendar.' }, 401)
  const token = JSON.parse(decoder.decode(Uint8Array.from(atob(auth.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0)))) as { access_token: string }
  const events = await request.json<Array<{ summary: string, description: string, start: string, end: string }>>()
  if (!Array.isArray(events) || events.length > 500) return json({ error: 'Invalid calendar event payload.' }, 400)
  let created = 0
  for (const event of events) {
    const response = await fetch(CALENDAR_URL, { method: 'POST', headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ summary: event.summary, description: event.description, start: { dateTime: event.start, timeZone: 'Europe/Kyiv' }, end: { dateTime: event.end, timeZone: 'Europe/Kyiv' } }) })
    if (!response.ok) return json({ error: `Google Calendar rejected an event after ${created} successful creations.` }, 502)
    created++
  }
  return json({ created })
}

export default { async fetch(request: Request, env: Env) {
  const url = new URL(request.url)
  if (url.pathname === '/api/auth/google') {
    const timestamp = String(Date.now()), nonce = crypto.randomUUID(), state = `${timestamp}.${nonce}.${await sign(`${timestamp}.${nonce}`, env.OAUTH_STATE_SECRET)}`
    const auth = new URL(GOOGLE_AUTH_URL)
    auth.searchParams.set('client_id', env.GOOGLE_CLIENT_ID); auth.searchParams.set('redirect_uri', `${url.origin}/api/auth/callback`); auth.searchParams.set('response_type', 'code'); auth.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.events'); auth.searchParams.set('access_type', 'offline'); auth.searchParams.set('prompt', 'consent'); auth.searchParams.set('state', state)
    return Response.redirect(auth.toString(), 302)
  }
  if (url.pathname === '/api/auth/callback') return callback(request, env)
  if (url.pathname === '/api/calendar/events' && request.method === 'POST') return createEvents(request)
  return env.ASSETS.fetch(request)
} } satisfies ExportedHandler<Env>