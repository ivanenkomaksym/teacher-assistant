# Мій розклад

SPA для викладачів: вибір ПІБ, тижнева сітка уроків і перенесення занять до власного Google Calendar. Дані читаються з `rozklad_2026-2027.json` у корені проєкту.

## Локальний запуск

```powershell
npm.cmd install
npm.cmd run dev
```

## Google Calendar і Cloudflare

Для особистих Gmail не підходить service account: він не має доступу до календаря людини. Застосунок використовує Google OAuth 2.0: вчитель натискає кнопку, входить у Google на сторінці Google та надає `calendar.events` дозвіл. Лише після цього Worker створює події у календарі користувача.

1. У Google Cloud Console створіть OAuth Client ID типу **Web application**.
2. Додайте `https://YOUR_DOMAIN/api/auth/callback` до **Authorized redirect URIs** та додайте тестові адреси Gmail на OAuth consent screen, поки застосунок у режимі Testing.
3. У Cloudflare встановіть секрети, не зберігаючи їх у файлах:

```powershell
npx.cmd wrangler secret put GOOGLE_CLIENT_ID
npx.cmd wrangler secret put GOOGLE_CLIENT_SECRET
npx.cmd wrangler secret put OAUTH_STATE_SECRET
```

`OAUTH_STATE_SECRET` має бути довгим випадковим значенням. Розклад дзвінків зафіксований у застосунку: початок уроків о `08:30`, `09:25`, `10:30`, `11:35`, `12:35`, `13:35`, `14:30`, `15:25`. Тривалість події залежить від класу: 1-й — 35 хв, 2–4-й — 40 хв, 5–11-й — 45 хв.

## Автоматичний деплой

Файл [.github/workflows/deploy.yml](.github/workflows/deploy.yml) збирає й публікує Worker разом зі SPA після кожного push у `master`. У GitHub repository settings додайте Actions secrets `CLOUDFLARE_API_TOKEN` (права Workers Scripts: Edit, Account Settings: Read) та `CLOUDFLARE_ACCOUNT_ID`. Google-секрети залишаються в Cloudflare та не додаються до GitHub.

Для продуктивного використання додайте Privacy Policy та Terms URL у Google OAuth consent screen й завершіть Google verification, оскільки Calendar scope є чутливим.