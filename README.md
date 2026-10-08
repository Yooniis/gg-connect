# Good Game: Parkaden Quest

NFC-baserat livespel för Good Game LAN i Parkaden, Härnösand.

Stack: **Next.js** + **Firebase App Hosting** + **Firestore** + **Storage**.

## Snabbstart lokalt

Kräver Node.js 22.13+.

```bash
cp .env.example .env.local
# Fyll i ADMIN_PIN, FIREBASE_STORAGE_BUCKET, FIREBASE_SERVICE_ACCOUNT_JSON

npm install
npm run dev
```

- Spel: http://localhost:3000/
- NFC: http://localhost:3000/scan?station=test-1
- Live: http://localhost:3000/live
- Admin: http://localhost:3000/admin

Full Firebase-setup finns i [FIREBASE.md](FIREBASE.md).

## Scripts

| Kommando | Syfte |
|---|---|
| `npm run dev` | Lokal utveckling |
| `npm run build` | Produktionsbygge |
| `npm run start` | Kör byggt Next.js-app |
| `npx firebase deploy --only firestore:rules,storage` | Deploya regler |

## Viktiga sökvägar

- `app/` – spelarvy, admin, live, NFC-scan, API
- `lib/` – Firebase Admin, Firestore-helpers, admin-session
- `public/` – logotyper och statiska filer
