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

`OAUTH_STATE_SECRET` має бути довгим випадковим значенням. Після `npm.cmd run build` розгорніть SPA та Worker разом через `npm.cmd run worker:deploy`.

Для продуктивного використання додайте Privacy Policy та Terms URL у Google OAuth consent screen й завершіть Google verification, оскільки Calendar scope є чутливим.