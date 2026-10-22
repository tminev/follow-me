# Follow Me

Работещ първи вертикален прототип с Next.js App Router, TypeScript, Prisma и локална SQLite база. Не изисква Docker.

## Стартиране

```powershell
copy .env.example .env
npm install
npm run db:generate
npm run db:migrate
$env:ENABLE_DEV_SEED="true"
npm run db:seed
npm run dev
```

Отворете `http://localhost:3000`. Health endpoint: `http://localhost:3000/api/health`.

### Инсталиране като приложение

Follow Me може да се инсталира от браузъра като PWA. Пуснете приложението през HTTPS — например с постоянния HTTPS адрес по-долу — и натиснете „Инсталирай“ в горната лента. На iPhone/iPad в Safari използвайте Share → „Добави към началния екран“. Локалният `http://localhost` също се приема като защитен адрес от браузъра.

### Push известия

Създайте VAPID ключове с `npx web-push generate-vapid-keys` и задайте `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` и `VAPID_SUBJECT` в `.env`. Push доставката изисква HTTPS (localhost е изключение); потребителят включва известията от глобалния бутон в горната лента. Известията покриват нови покани, приемане/отказ и нови чат съобщения.

### Карта на телефон

Браузърите позволяват GPS само през защитен адрес. За телефон в същата Wi-Fi мрежа стартирайте:

```powershell
npm run dev:https
```

После отворете на телефона `https://<локалния-IP-на-компютъра>:3000` и приемете локалния development сертификат. За телефон извън локалната мрежа използвайте публичен HTTPS адрес с валиден сертификат; не отваряйте приложението през обикновен `http://` IP адрес.

За телефон използвайте постоянния Tailscale Funnel адрес. След еднократната настройка на Tailscale стартирайте приложението с:

```powershell
npm run dev
```

Отворете на телефона `https://desktop-dp248g4.tail809f67.ts.net/` и позволете Location. Funnel използва валиден HTTPS сертификат и адресът остава същият; работи, докато компютърът е включен, Tailscale е свързан и приложението е стартирано.

За да се показва предоставеното лого в горната лента, запишете оригиналното изображение като `public/follow-me-logo.png`.

DEV профили (само когато `ENABLE_DEV_SEED=true`, парола `Demo1234!`):

- `alex@followme.local` — проверен 18+
- `mira@followme.local` — проверен 18+
- `teen@followme.local` — непълнолетен, без достъп до location discovery

## Реализирано

- регистрация, вход, кратък access token в `httpOnly` cookie и ротационна refresh сесия;
- профил и публично откриване без лични полета;
- покани, приемане/отказ, приятелства и двупосочно блокиране;
- личен чат и известия за покани чрез Socket.IO в реално време;
- web push известия за покани, промяна на покани и нови чат съобщения, с глобално управление и изрично включване от потребителя;
- доброволна location сесия 15/30/60 минути само за проверени пълнолетни;
- координати само в краткотрайна памет, без история в SQLite;
- приблизителни координати за непознати, block/hide филтри и fail-closed поведение.

## Проверки

```powershell
npm run typecheck
npm run lint
npm test
```

## Ограничения преди production

In-memory location presence работи за един локален dev процес. Преди хоризонтално мащабиране трябва да се замени с Redis TTL adapter и Socket.IO adapter. Проверка на възраст изисква избран доверен доставчик; няма публичен bypass endpoint. Нужни са production rate limits, CSRF стратегия, HTTPS, ротация на secrets, moderation/report flow и правен/privacy преглед.
