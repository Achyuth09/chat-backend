# MongoDB setup for Chat Backend

Pick **one** option: local install (Windows) or cloud (Atlas). The backend uses `MONGODB_URI` in `.env`; default is `mongodb://localhost:27017/chat`.

---

## Option 1: MongoDB locally (Windows)

### Install

**Using winget (recommended):**
```powershell
winget install MongoDB.Server
```

**Or download installer:**
- https://www.mongodb.com/try/download/community
- Choose: Version 7.x, Windows x64, MSI
- Run the installer → choose "Complete" → optionally install as a **Windows Service** (so it starts with Windows)

### Start MongoDB

- If you installed as a **service**: it may already be running. Check in **Services** (Win + R → `services.msc` → find "MongoDB").
- If not installed as service, start it manually:
  ```powershell
  "C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" --dbpath="C:\data\db"
  ```
  (Create `C:\data\db` first if needed. Your path may differ; check under `C:\Program Files\MongoDB\Server\<version>\bin\`.)

### Use it with the backend

No extra config if MongoDB is on the same machine. In `chat-backend`:

```bash
cp .env.example .env
npm start
```

Default `.env` is fine: `MONGODB_URI=mongodb://localhost:27017/chat` (or leave it unset).

---

## Option 2: MongoDB Atlas (cloud, no local install)

Good if you don’t want to install anything on your PC.

### 1. Create cluster

- Go to https://www.mongodb.com/cloud/atlas
- Sign up / log in
- **Build a database** → choose **M0 FREE**
- Pick a cloud provider and region (e.g. AWS, closest to you)
- Create cluster

### 2. Create database user

- **Database Access** → **Add New Database User**
- Username & password (remember the password)
- Role: **Atlas admin** or **Read and write to any database**

### 3. Allow your IP

- **Network Access** → **Add IP Address**
- **Allow Access from Anywhere** (`0.0.0.0/0`) for testing, or add your current IP

### 4. Get connection string

- **Database** → **Connect** → **Connect your application**
- Copy the URI. It looks like:
  `mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`

### 5. Set it in the backend

In `chat-backend`, create or edit `.env`:

```env
PORT=5000
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/chat?retryWrites=true&w=majority
```

Replace `USERNAME`, `PASSWORD`, and the cluster host with your values. The `/chat` before `?` is the database name.

Then:

```bash
npm start
```

---

## Quick check

- **Local:** MongoDB is running and backend prints `MongoDB connected`.
- **Atlas:** `.env` has the correct `MONGODB_URI` and backend prints `MongoDB connected`.

If the backend fails to start, check the error (e.g. wrong password, IP not allowed, or MongoDB not running locally).
