# Flytta / fortsatt utveckling

Källkoden för **Good Game: Parkaden Quest** är porterad till Firebase.

## Innehåll

- `app/` – spelarvy, adminpanel, projektorvy, NFC-vy och API-rutter
- `lib/` – Firebase Admin, Firestore och admin-PIN
- `public/` – logotyper och övriga statiska resurser
- `firebase.json`, `apphosting.yaml`, `firestore.rules`, `storage.rules` – Firebase-konfiguration

## Lokal start

```bash
cp .env.example .env.local
npm install
npm run dev
```

Se [FIREBASE.md](FIREBASE.md) för projekt, secrets och deploy.

## Databas och filer

- Firestore ersätter tidigare Cloudflare D1
- Firebase Storage ersätter R2 för ledtrådsbilder
- Admin skyddas med `ADMIN_PIN` (inte ChatGPT-inloggning)

## NFC

Programmera taggar till:

`https://<domän>/scan?station=<nyckel>`
