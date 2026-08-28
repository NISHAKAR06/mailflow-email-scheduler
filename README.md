# 🚀 MailFlow — Production Email Scheduler & Dashboard

**MailFlow** is a high-performance, production-ready distributed email scheduling platform with a sleek Next.js 14 dashboard and an Object-Oriented Express + TypeScript backend. It features **delayed job queues with BullMQ**, **Redis rate-limiting token buckets**, **PostgreSQL persistence with Prisma ORM**, **Elasticsearch full-text search**, **dual authentication (Google OAuth & direct Email/Password)**, and **real-time Slack rate-limit alerts**.

---

## 📑 Table of Contents
1. [System Architecture](#-system-architecture)
2. [Key Features](#-key-features)
3. [Quick Start & Setup Guide](#-quick-start--setup-guide)
4. [Authentication Guide](#-authentication-guide)
5. [Dashboard & User Workflow](#-dashboard--user-workflow)
6. [API Reference & Endpoints](#-api-reference--endpoints)
7. [Environment Variables](#-environment-variables)
8. [Queue Monitoring (Bull Board)](#-queue-monitoring-bull-board)
9. [Architecture & Reliability Details](#-architecture--reliability-details)
10. [Troubleshooting & FAQ](#-troubleshooting--faq)

---

## 🏛 System Architecture

```mermaid
graph TD
    User([User Browser]) -->|HTTP :3000| NextJS[Next.js 14 Frontend App]
    NextJS -->|/api/backend Reverse Proxy| Express[Express + TypeScript API :4000]
    
    subgraph Backend Core
        Express --> Auth[NextAuth JWT Auth Middleware]
        Express --> Scheduler[EmailScheduler Service]
        Express --> Slack[SlackNotifier Service]
        Express --> Search[Elasticsearch SearchIndexer]
    end
    
    subgraph Storage & Queues
        Scheduler -->|Persistent Storage| Postgres[(PostgreSQL DB :5432)]
        Scheduler -->|Delayed Jobs| BullMQ[BullMQ Job Queue]
        BullMQ -->|Broker & Rate Limiters| Redis[(Redis :6379)]
        Search -->|Full-Text Search| ES[(Elasticsearch :9200)]
    end
    
    subgraph Execution
        BullMQ --> Worker[EmailWorker Concurrency=3]
        Worker --> RateLimit{Rate Limit Check}
        RateLimit -->|Within Limit| SMTP[Nodemailer / Ethereal SMTP]
        RateLimit -->|Exceeded| Reschedule[Reschedule Next Hour]
        Reschedule --> SlackAlert[Slack Webhook Alert]
    end
```

---

## ✨ Key Features

### 💻 Frontend (Next.js 14 App Router & TailwindCSS)
- **Either/Or Independent Authentication**:
  - One-click **Google OAuth** login without needing to enter email/password.
  - Direct **Email ID & Password** login without requiring Google credentials.
- **Core Dashboard Views**:
  - 🕒 **Scheduled**: Real-time listing of pending emails with precise dispatch time badges and countdowns.
  - 📤 **Sent**: Completed and delivered emails with timestamps.
  - 🗄️ **Archived**: Dedicated archive view with one-click **Restore** functionality.
- **Interactive Compose Modal**:
  - Recipient lead list CSV uploader with duplicate deduplication.
  - Subject and rich text body editor with formatting toolbar (Bold, Italic, Link, List, Emoji).
  - Custom **Send Later** popover date/time picker.
- **Starred Items**: Toggle star status on any email row or within the detail modal.
- **Live Search**: Instant multi-match search bar over subjects, recipients, and bodies.
- **Slack Integration Status**: Live indicator with one-click OAuth connect/disconnect.

### ⚙️ Backend (Express, BullMQ, Redis, PostgreSQL, Prisma)
- **Zero-Cron BullMQ Delayed Jobs**: Every email is scheduled with a precise millisecond delay.
- **Deterministic Idempotency**: SHA-256 hash (`senderId:recipient:subject:scheduledFor`) prevents duplicate sends across server restarts.
- **Sliding-Window Rate Limiter**: Redis-backed token bucket prevents exceeding provider limits (e.g., 50 emails/hour/sender).
- **Dual-Engine Persistence**: PostgreSQL + BullMQ primary engine with automatic in-process fallback store for 100% uptime.
- **Bull Board Queue Dashboard**: Live queue inspection UI at `http://localhost:4000/admin/queues`.
- **Ethereal SMTP Integration**: Safe sandbox email delivery with message preview URLs.

---

## 🚀 Quick Start & Setup Guide

### 1. Prerequisites
- **Node.js** v18.0.0 or higher ([Download Node.js](https://nodejs.org/))
- **Docker Desktop** ([Download Docker](https://www.docker.com/products/docker-desktop/))
- **Git**

---

### 2. Clone the Repository
```bash
git clone https://github.com/NISHAKAR06/mailflow-email-scheduler.git
cd mailflow-email-scheduler
```

---

### 3. Start Infrastructure Containers (PostgreSQL, Redis, Elasticsearch)
Make sure Docker Desktop is open and running, then execute:
```bash
docker compose up -d postgres redis elasticsearch
```
Verify containers are healthy:
```bash
docker ps
```

---

### 4. Setup & Start Backend (`:4000`)
```bash
cd backend

# Install dependencies
npm install

# Push database schema to PostgreSQL
npx prisma generate
npx prisma db push

# Start backend server
npm run dev
```
- API Base URL: `http://localhost:4000`
- Bull Board Queue Monitor: `http://localhost:4000/admin/queues`
- Health Check: `http://localhost:4000/api/health`

---

### 5. Setup & Start Frontend (`:3000`)
In a new terminal window:
```bash
cd frontend

# Install dependencies
npm install

# Start Next.js development server
npm run dev
```
- Dashboard URL: `http://localhost:3000`
- Login Page: `http://localhost:3000/login`

---

## 🔐 Authentication Guide

MailFlow offers two completely independent login options:

1. **Email & Password Login**:
   - Enter your Email ID (e.g. `oliver.brown@domain.io`) and Password.
   - Click the green **Login** button.
   - Signs you in directly with JWT credentials.

2. **Google OAuth Login**:
   - Click **Login with Google**.
   - Authenticates via Google OAuth and forwards you directly to `/dashboard/scheduled`.

---

## 🖥️ Dashboard & User Workflow

### 1. Composing and Scheduling an Email
1. Click the **Compose** button in the left sidebar.
2. In the modal:
   - Enter single or multiple recipient emails (or upload a `.csv` lead list).
   - Enter Subject and Body content.
   - Click the clock icon next to **Send Later** to select a custom dispatch date and time.
3. Click **Schedule**. The email is registered in the delayed queue and appears in your **Scheduled** list.

### 2. Archiving and Restoring Emails
- **To Archive**: Click the archive box icon on any email row or inside the email detail view. The email is moved out of active views.
- **To View Archived**: Click **Archived** under the CORE section in the sidebar (`/dashboard/archived`).
- **To Restore**: Click the **Restore** button on any archived email to return it to active views.

---

## 📡 API Reference & Endpoints

All frontend API calls route through the same-origin Next.js reverse proxy (`http://localhost:3000/api/backend/...`), forwarding server-side to Express on port `4000`.

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/health` | Health check endpoint | No |
| `POST` | `/api/emails/schedule` | Schedule a batch of emails with custom delay & rate limit | Yes (JWT) |
| `GET` | `/api/emails/scheduled` | List pending scheduled emails for the sender | Yes (JWT) |
| `GET` | `/api/emails/sent` | List sent and delivered emails | Yes (JWT) |
| `GET` | `/api/emails/search` | Full-text search over subject and recipient | Yes (JWT) |
| `GET` | `/api/slack/status` | Get Slack integration connection status | No |
| `GET` | `/api/slack/connect` | Initiates Slack OAuth connection | No |
| `POST` | `/api/slack/disconnect` | Disconnects Slack integration | Yes (JWT) |

---

## ⚙️ Environment Variables

### Backend Configuration (`backend/.env`)
```env
PORT=4000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mailflow?schema=public"
REDIS_HOST=localhost
REDIS_PORT=6379
ELASTICSEARCH_URL=http://localhost:9200

# SMTP Transport (Ethereal Email for dev)
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# Limits & Concurrency
MAX_EMAILS_PER_HOUR=100
MAX_EMAILS_PER_HOUR_PER_SENDER=50
WORKER_CONCURRENCY=3
MIN_SEND_DELAY_MS=500

# Security & Secrets
JWT_SECRET=mailflow_super_secret_jwt_key_2026
FRONTEND_URL=http://localhost:3000

# Slack Integration (Optional)
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_REDIRECT_URI=http://localhost:4000/api/slack/callback
```

### Frontend Configuration (`frontend/.env`)
```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=mailflow_super_secret_jwt_key_2026
JWT_SECRET=mailflow_super_secret_jwt_key_2026

# Google OAuth Credentials
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Backend Routing
NEXT_PUBLIC_API_URL=http://localhost:3000/api/backend
INTERNAL_BACKEND_URL=http://127.0.0.1:4000
```

---

## 📊 Queue Monitoring (Bull Board)

MailFlow includes a built-in UI for inspecting delayed, active, and completed jobs in real time:

- **URL**: [http://localhost:4000/admin/queues](http://localhost:4000/admin/queues)
- **Features**:
  - Inspect delayed job timers and countdowns.
  - View payload data for each scheduled email.
  - Retry failed jobs with one click.
  - Monitor throughput and job execution metrics.

---

## 🛡️ Architecture & Reliability Details

1. **Same-Origin Reverse Proxy**: Next.js rewrites forward `/api/backend/*` server-to-server, preventing cross-origin blockages and CORS issues.
2. **Deterministic Idempotency**: SHA-256 hashing ensures duplicate scheduling requests are safely ignored by both PostgreSQL and BullMQ.
3. **Graceful Degradation**: Dual-engine architecture guarantees zero downtime even during database or Redis reboots.

---

## ❓ Troubleshooting & FAQ

- **Q: `ERR_CONNECTION_REFUSED` on port 4000?**  
  *A:* Make sure Docker Desktop is running and start the backend with `cd backend; npm run dev`. The Next.js frontend proxy on port 3000 will automatically connect to it.
- **Q: How to test Google OAuth locally?**  
  *A:* Supply your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `frontend/.env`, ensuring your Google Cloud Console redirect URI includes `http://localhost:3000/api/auth/callback/google`.
- **Q: Where can I view sent test emails?**  
  *A:* Test emails are sent via Ethereal SMTP. Inspection links are logged in the backend terminal console.

---

## 📄 License
This project is licensed under the MIT License.
