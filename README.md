# Chat Backend

Node.js + Express + MongoDB API. Use this as its own repo.

## 1. Install MongoDB

You need MongoDB running before the backend can start. See **[MONGODB_SETUP.md](./MONGODB_SETUP.md)** for:

- **Option A:** Install MongoDB locally on Windows (`winget install MongoDB.Server` or installer)
- **Option B:** Use MongoDB Atlas (free cloud; no local install)

## 2. Setup

```bash
npm install
cp .env.example .env
# Edit .env: set MONGODB_URI only if you use Atlas or a custom URL
```

## Run

```bash
npm run dev
```

Runs on http://localhost:5000. Health: `GET /api/health`.

## Repo

Push this folder to its own Git repo (e.g. `chat-backend` on GitHub).
