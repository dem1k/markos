# markOS

A Windows 3.11-style desktop playground in the browser (also installable as a PWA), with an offline-first learning-game layer and an optional NestJS backend for live events.

Built for Mark: black-and-white system icons, boot sequence, overlapping windows, games, and a first challenge — **connect to Wi-Fi**.

## Features

- Boot screen with glitch loading log, 80s beeps, and a short melody
- Fake user select (Mark / Guest / Admin)
- Desktop with drag-and-drop icons, folders, files, and context menu
- Overlapping windows (move, minimize, maximize, close, focus)
- Start menu, taskbar clock, network tray (**OFF** / **NET**)
- Day-1 scenario (JSON): connect Wi-Fi to go online; welcome mail / dialog
- Games: **worm** and **tetris**
- PWA install (standalone window)
- Optional backend: Postgres + NestJS + Socket.IO event push

## Run UI only (offline-first)

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://127.0.0.1:5173`), click **Start**, pick a user.

Day-1 lives in the frontend (`src/content/scenarios/day1.json`). Click **OFF** in the tray and choose Wi-Fi — connect **only succeeds if the backend is alive**. Then you get the first task: open **Browser** → `mail.markos` → create email.

## Run with backend (live push)

```bash
docker compose up -d
cd backend && npm install && npx prisma db push && npm run seed && npm run dev
```

In the repo root:

```bash
echo 'VITE_API_URL=http://127.0.0.1:3001' > .env.local
npm run dev
```

After you connect Wi-Fi in-game, the client registers a guest, syncs the activity, and can receive pushed events. See [backend/README.md](backend/README.md).

## Build / preview

```bash
npm run build
npm run preview
```

## Stack

- Frontend: Vite + TypeScript (no UI framework); desktop state in `localStorage`
- Scenarios: frontend JSON in [`src/content/scenarios/`](src/content/scenarios/) (mirrored under `backend/content` for seeding)
- Backend: NestJS + Prisma + PostgreSQL ([`backend/`](backend/))
