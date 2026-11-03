# markOS backend

NestJS + PostgreSQL API for the learning-game layer. The Vite UI works **without** this server; when `VITE_API_URL` is set and the player connects to Wi-Fi in-game, the client talks to this API and receives live event pushes.

## Prerequisites

- Node.js 20+
- Docker (for Postgres)

## Setup

```bash
# from repo root
docker compose up -d

cd backend
cp .env.example .env   # if needed
npm install
npx prisma db push
npm run seed
npm run dev
```

API: `http://127.0.0.1:3001`

## Frontend online mode

In the repo root create `.env` / `.env.local`:

```bash
VITE_API_URL=http://127.0.0.1:3001
```

Then `npm run dev` for the UI. Play until the desktop, click **OFF** in the tray, connect to Wi-Fi. Offline JSON events always work; with the API, the same connect activity is synced and events can be pushed over Socket.IO.

## Endpoints

- `POST /auth/guest` — create guest session `{ token, userId }`
- `GET /me` — Bearer token
- `GET /progress` — scenario progress + vectors
- `POST /activities` — `{ type, networkId? }` → `{ events, progress }`
- `GET /scenarios/:id` — scenario pack JSON
- WebSocket (Socket.IO) path `/ws/socket.io` — query `token`, events `activity` / `events`

## AI (optional)

Set `AI_API_KEY` and `AI_API_URL` (OpenAI-compatible chat completions). Without them, authored `onOnline` events from JSON are used unchanged.

## Scripts

- `npm run dev` — watch API
- `npm run seed` — load Day-1 nodes/edges into Postgres
- `npx prisma db push` — sync schema
