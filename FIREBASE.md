# Firebase-setup: Good Game Parkaden Quest

Spelet körs på **Firebase App Hosting** med **Firestore** (data) och **Storage** (ledtrådsbilder). Admin skyddas med `ADMIN_PIN`.

## 1. Skapa projekt

1. Gå till [Firebase Console](https://console.firebase.google.com/)
2. Skapa ett nytt projekt (t.ex. `good-game-parkaden`)
3. Aktivera **Firestore** (production mode – reglerna i `firestore.rules` blockerar klientåtkomst)
4. Aktivera **Storage**
5. Aktivera **App Hosting**

## 2. Koppla CLI

```bash
npm install
npx firebase login
```

Uppdatera `.firebaserc` med ditt projekt-id:

```json
{
  "projects": {
    "default": "ditt-projekt-id"
  }
}
```

## 3. Secrets / miljövariabler

### Lokalt (`.env.local`)

```bash
cp .env.example .env.local
```

Fyll i:

- `ADMIN_PIN` – PIN till `/admin` (minst 4 tecken)
- `FIREBASE_STORAGE_BUCKET` – bucket-namnet från Storage
- `FIREBASE_SERVICE_ACCOUNT_JSON` – hela service account-JSON:en som en rad

Skapa service account: Project settings → Service accounts → Generate new private key.

### App Hosting

```bash
npx firebase apphosting:secrets:set ADMIN_PIN
npx firebase apphosting:secrets:set FIREBASE_STORAGE_BUCKET
```

På App Hosting används ADC (application default credentials) automatiskt – ingen service account-JSON behövs i production om backend körs i samma GCP-projekt. Ge App Hosting-servicekontot roller för Firestore + Storage.

## 4. Deploya regler

```bash
npx firebase deploy --only firestore:rules,storage
```

## 5. App Hosting-backend

Backend **parkaden-quest** finns redan i `europe-west4`.

Publik URL (efter första lyckade deploy):

`https://parkaden-quest--gg-connect-db18a.europe-west4.hosted.app`

1. Skapa ett GitHub-repo och pusha koden
2. Firebase Console → App Hosting → **parkaden-quest** → koppla GitHub-repo + branch `main`
3. Secret `ADMIN_PIN` är redan satt; bucket i `apphosting.yaml` är `gg-connect-db18a-parkaden`
4. Skapa rollout / låt automatisk deploy köra `npm run build`

## 6. Lokal utveckling

```bash
npm install
npm run dev
```

Öppna:

- Spel: http://localhost:3000/
- NFC-test: http://localhost:3000/scan?station=test-nod-1
- Live-projektor: http://localhost:3000/live
- Admin: http://localhost:3000/admin

## 7. NFC-taggar i Parkaden

Programmera varje tagg till:

```text
https://<er-domän>/scan?station=<unikt-stationsnamn>
```

Exempel: `https://parkaden.web.app/scan?station=eldstad`

Stationsnamnet måste vara unikt per fysisk nod. Varje spelare får XP **en gång** per station.

## 8. Checklist inför LAN

- [ ] `ADMIN_PIN` satt i production
- [ ] Firestore + Storage aktiverat
- [ ] Regler deployade
- [ ] App Hosting live på HTTPS-domän
- [ ] Lägg `public/good-game-logo.jpg` om loggan saknas i exporten
- [ ] NFC-taggar pekar på production-URL
- [ ] Projektor öppnar `/live` i helskärm
- [ ] Skapa testspelare, skanna testnod, verifiera scoreboard
- [ ] Uppdatera `.firebaserc` + `FIREBASE_STORAGE_BUCKET` i `apphosting.yaml`
