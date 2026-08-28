# MailFlow — Email Job Scheduler

A production-grade email scheduling service with a Next.js dashboard, built on BullMQ delayed jobs, PostgreSQL, Redis, and Elasticsearch.

## Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Docker** and Docker Compose (for Postgres, Redis, Elasticsearch)

### 1. Start Infrastructure

```bash
docker compose up -d postgres redis elasticsearch
```

Wait for all services to be healthy:

```bash
docker compose ps
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env — see "Environment Variables" section below

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# Start the development server (includes BullMQ worker)
npm run dev
```

Backend runs at **http://localhost:4000**.  
Bull Board queue dashboard at **http://localhost:4000/admin/queues**.

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env — see "Environment Variables" section below

# Start the development server
npm run dev
```

Frontend runs at **http://localhost:3000**.

### 4. Full Docker Compose (All Services)

```bash
# Build and start everything
docker compose up --build -d

# Run migrations
docker compose exec backend npx prisma migrate deploy
```

---

## Ethereal Email Setup

This project uses [Ethereal Email](https://ethereal.email) as a safe SMTP transport for development — emails are captured but never actually delivered.

1. Go to https://ethereal.email/create
2. Click "Create Ethereal Account"
3. Copy the generated credentials into your `.env`:

```env
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=<generated-user>@ethereal.email
SMTP_PASS=<generated-password>
```

If you skip this step, the backend will auto-generate a test account on startup and log the credentials.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `4000` |
| `DATABASE_URL` | PostgreSQL connection string | — |
| `REDIS_HOST` | Redis hostname | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `ELASTICSEARCH_URL` | Elasticsearch URL | `http://localhost:9200` |
| `SMTP_HOST` | Ethereal SMTP host | `smtp.ethereal.email` |
| `SMTP_PORT` | Ethereal SMTP port | `587` |
| `SMTP_USER` | Ethereal username | (auto-generated if empty) |
| `SMTP_PASS` | Ethereal password | (auto-generated if empty) |
| `MAX_EMAILS_PER_HOUR` | Global hourly limit | `100` |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | Per-sender hourly limit | `50` |
| `WORKER_CONCURRENCY` | BullMQ worker concurrency | `3` |
| `MIN_SEND_DELAY_MS` | Minimum delay between sends (BullMQ limiter) | `500` |
| `JWT_SECRET` | JWT signing secret (must match NextAuth) | — |
| `SLACK_CLIENT_ID` | Slack app client ID | — |
| `SLACK_CLIENT_SECRET` | Slack app client secret | — |
| `SLACK_REDIRECT_URI` | Slack OAuth redirect URI | `http://localhost:4000/api/slack/callback` |
| `FRONTEND_URL` | Frontend URL for CORS + redirects | `http://localhost:3000` |

### Frontend (`frontend/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXTAUTH_URL` | NextAuth base URL | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | NextAuth secret (must match JWT_SECRET) | — |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | — |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | — |
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:4000` |

---

## Architecture

### Scheduling — BullMQ Delayed Jobs

All scheduling is done via **BullMQ delayed jobs**. No cron, no `node-cron`, no `agenda`.

```
POST /api/emails/schedule
  → For each recipient:
    1. Compute scheduledFor = startTime + (index × delayMs)
    2. Generate idempotencyKey = SHA-256(senderId + recipient + subject + scheduledFor)
    3. INSERT ScheduledEmail row (status: pending)
    4. queue.add('send-email', payload, { jobId: idempotencyKey, delay: ms-from-now })
```

The BullMQ `delay` is computed as `scheduledFor - Date.now()`. Jobs sit in Redis until their delay expires, then the worker picks them up.

### Restart Persistence

BullMQ jobs live in Redis, independent of the Node.js process. When the server restarts:

1. The Express app + worker reconnect to Redis
2. BullMQ automatically resumes processing any delayed/waiting jobs
3. **No boot-time re-enqueue loop** — this is critical to avoid duplicates

The server **explicitly does not** scan the DB for pending emails and re-create jobs on boot. Doing so with new `jobId`s would bypass BullMQ's deduplication and cause double-sends.

### Idempotent Sends

The `idempotencyKey` (SHA-256 hash) serves double duty:

1. **Database uniqueness**: `@@unique` on `ScheduledEmail.idempotencyKey` prevents duplicate DB rows
2. **BullMQ deduplication**: Used as `jobId` — BullMQ rejects `queue.add()` calls with a duplicate `jobId`

This guarantees that even if `POST /api/emails/schedule` is called twice with the same parameters, each email is scheduled at most once.

### Rate Limiting

Rate limiting uses **Redis counters**, not the Prisma `RateLimitCounter` table (which exists for audit/reporting).

**Key pattern:** `ratelimit:{senderId}:{hourWindow}` (e.g., `ratelimit:abc123:2026-08-28T14`)

**Algorithm:**
1. Worker checks `GET ratelimit:{senderId}:{currentHour}`
2. If count ≥ `MAX_EMAILS_PER_HOUR_PER_SENDER` → reschedule to next hour
3. If under limit → send email, then `INCR` the counter
4. If `INCR` returns `1` (new key) → `EXPIRE` with seconds-until-end-of-hour

**Atomicity trade-off:** The `INCR` + `EXPIRE` sequence is not perfectly atomic. There's a tiny window where a crash between `INCR` and `EXPIRE` could leave a counter without a TTL. This is **conservative** — the counter would persist and over-count, never under-count. For true atomicity, a Lua script combining both operations would be needed:

```lua
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
```

This was a deliberate trade-off for code simplicity.

### Concurrency Control

- **Worker concurrency**: Configured via `WORKER_CONCURRENCY` env var (default: 3)
- **Send throttling**: BullMQ's `limiter: { max: 1, duration: MIN_SEND_DELAY_MS }` ensures a minimum gap between sends (default: 500ms)
- **Rate-limited reschedule**: When a sender hits their hourly limit, the job is re-added with a delay pushing it to the start of the next hour window. The original intra-hour offset (minutes/seconds) is preserved so relative order survives.

### Rate-Limit-Exceeded Reschedule Logic

When the worker detects a rate limit hit:
1. The job is **not marked as failed** — it stays `pending`
2. A new delayed job is created for the next hour window
3. If the sender has Slack connected (read fresh from DB, never cached), a notification is sent
4. If Slack is not connected, the skip is silent — no crash

### OOP Design

The backend uses classes with constructor-injected dependencies:

| Class | Responsibility | Dependencies |
|-------|---------------|--------------|
| `EmailScheduler` | Create DB rows + enqueue BullMQ jobs | Queue, PrismaClient |
| `EmailWorker` | Process jobs: rate check → send → index | Queue, PrismaClient, RateLimiter, SlackNotifier, SearchIndexer, Transporter |
| `RateLimiter` | Redis INCR/EXPIRE rate counting | Redis |
| `SlackNotifier` | OAuth flow + message delivery | PrismaClient |
| `SearchIndexer` | Elasticsearch index/search | ES Client |
| `AuthMiddleware` | JWT validation | — |

`SlackNotifier` implements a `NotificationChannel` interface for extensibility.

---

## Feature Checklist

### Backend
- [x] BullMQ delayed-job scheduler (no cron)
- [x] Idempotent sends via deterministic `jobId`
- [x] Restart-safe — no boot-time re-enqueue
- [x] Redis-based rate limiting with `INCR` + `EXPIRE`
- [x] Per-sender hourly limits from env vars
- [x] Rate-exceeded → reschedule to next hour + Slack notification
- [x] Slack OAuth authorize-code flow
- [x] Elasticsearch indexing + multi-match search
- [x] Bull Board at `/admin/queues`
- [x] Ethereal Email transport
- [x] Configurable worker concurrency + send throttle
- [x] OOP design with constructor-injected dependencies

### Frontend
- [x] Google OAuth via NextAuth
- [x] Auth-guarded dashboard routes
- [x] Header with avatar, name, email, logout
- [x] Slack connect/disconnect
- [x] Tab navigation (Scheduled / Sent)
- [x] Compose modal with CSV upload, parse, dedupe, count
- [x] Scheduled emails table with loading skeleton + empty state
- [x] Sent emails table with loading skeleton + empty state
- [x] Toast notifications on errors
- [x] Reusable components (Button, Input, Modal, Table)

---

## Assumptions & Trade-offs

1. **Ethereal Email only**: No real SMTP provider. All emails are captured at ethereal.email for inspection.
2. **Single-process worker**: The worker runs in the same process as the Express server for simplicity. In production, separate the worker into its own process/container.
3. **JWT-based auth**: The frontend generates a JWT (via NextAuth callbacks) that the backend validates. This avoids session cookies crossing domains.
4. **Rate limit counter in Redis only**: The `RateLimitCounter` Prisma model exists for audit purposes but isn't used for real-time checking — Redis is the source of truth.
5. **Elasticsearch security disabled**: For local development only. Production would enable xpack security.
6. **No email retry on Slack notification failure**: If Slack notification fails, it's logged and skipped — it doesn't affect email delivery.
7. **MIN_SEND_DELAY_MS default 500ms**: This limits throughput to ~2 emails/second per worker. Adjust based on your SMTP provider's rate limits.
