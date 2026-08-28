# 🛠️ Complete Local Setup & Configuration Guide

This guide walks you through setting up MailFlow on your local machine step-by-step.

---

## 📋 Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Docker Desktop**: Running with Linux containers enabled
- **Git**

---

## ⚡ Step 1: Clone and Install Dependencies

```bash
# Clone the repository
git clone https://github.com/NISHAKAR06/mailflow-email-scheduler.git
cd mailflow-email-scheduler

# Install root & backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
cd ..
```

---

## 🐳 Step 2: Start Infrastructure Containers

Start PostgreSQL, Redis, and Elasticsearch using Docker Compose:

```bash
docker compose up -d postgres redis elasticsearch
```

Verify that all three containers are healthy:
```bash
docker ps
```
You should see:
- `mailflow-postgres` on port `5432`
- `mailflow-redis` on port `6379`
- `mailflow-elasticsearch` on port `9200`

---

## 🗄️ Step 3: Configure Environment & Database

### 1. Backend Environment (`backend/.env`)
Ensure `backend/.env` contains:
```env
PORT=4000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mailflow?schema=public"
REDIS_HOST=localhost
REDIS_PORT=6379
ELASTICSEARCH_URL=http://localhost:9200

# Ethereal SMTP Settings
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# Rate Limits
MAX_EMAILS_PER_HOUR=100
MAX_EMAILS_PER_HOUR_PER_SENDER=50
WORKER_CONCURRENCY=3
MIN_SEND_DELAY_MS=500

JWT_SECRET=mailflow_super_secret_jwt_key_2026
FRONTEND_URL=http://localhost:3000
```

### 2. Push Prisma Schema
```bash
cd backend
npx prisma generate
npx prisma db push
```

---

## 🌐 Step 4: Configure Frontend Environment (`frontend/.env`)

Ensure `frontend/.env` contains:
```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=mailflow_super_secret_jwt_key_2026
JWT_SECRET=mailflow_super_secret_jwt_key_2026

# Google OAuth Credentials (Optional - or use direct email/password login)
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# Backend Proxy URL
NEXT_PUBLIC_API_URL=http://localhost:3000/api/backend
INTERNAL_BACKEND_URL=http://127.0.0.1:4000
```

---

## ▶️ Step 5: Start the Development Servers

### Terminal 1: Backend API & Worker (`:4000`)
```bash
cd backend
npm run dev
```
- API is running at: `http://localhost:4000`
- Bull Board Queue dashboard: `http://localhost:4000/admin/queues`

### Terminal 2: Next.js Frontend (`:3000`)
```bash
cd frontend
npm run dev
```
- Dashboard is accessible at: `http://localhost:3000`
- Login page: `http://localhost:3000/login`

---

## 🧪 Step 6: Verify Everything is Working

1. Open `http://localhost:3000/login` in your browser.
2. Sign in using Email ID (`oliver.brown@domain.io` / `password123`) or click **Login with Google**.
3. You will land on the **Scheduled** dashboard.
4. Click **Compose**, schedule a test email, and watch the delayed job appear in Bull Board at `http://localhost:4000/admin/queues`!
