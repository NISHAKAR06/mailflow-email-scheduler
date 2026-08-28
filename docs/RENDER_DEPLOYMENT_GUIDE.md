# 🚀 Render.com Deployment Guide for MailFlow

This guide explains how to deploy MailFlow on **Render** in two ways:
1. **Method A (Recommended)**: 1-Click Infrastructure Blueprint (`render.yaml`)
2. **Method B**: Manual Dashboard Configuration

---

## 🌟 Method A: 1-Click Blueprint Deployment (Easiest)

MailFlow includes a `render.yaml` blueprint that automatically creates the PostgreSQL database, Redis instance, Express Backend Web Service, and Next.js Frontend Web Service with all environment variables cross-linked.

### Steps:
1. Push your code to your GitHub repository.
2. Log into [Render.com](https://render.com).
3. In the Render Dashboard, click **New +** in the top navigation bar.
4. Select **Blueprint**.
5. Connect your GitHub repository (`mailflow-email-scheduler`).
6. Render will automatically detect `render.yaml` and show:
   - `mailflow-postgres` (PostgreSQL Database)
   - `mailflow-redis` (Redis Instance)
   - `mailflow-backend` (Web Service)
   - `mailflow-frontend` (Web Service)
7. Click **Apply**.
8. Render will provision the databases, build both services, run Prisma migrations, and generate your live URLs!

---

## 🛠️ Method B: Manual Service Creation on Render

If you prefer setting up services individually via the Render UI:

### 1. Create Managed PostgreSQL Database
1. Click **New +** ➔ **PostgreSQL**.
2. Name: `mailflow-db`
3. Database: `mailflow`
4. User: `postgres`
5. Plan: **Free**
6. Click **Create Database** and copy the **Internal Database URL**.

---

### 2. Create Managed Redis Instance
1. Click **New +** ➔ **Redis**.
2. Name: `mailflow-redis`
3. Plan: **Free**
4. Click **Create Redis** and note the **Internal Redis Host** and **Port** (`6379`).

---

### 3. Create Backend Web Service
1. Click **New +** ➔ **Web Service** ➔ Connect your GitHub repository.
2. Settings:
   - **Name**: `mailflow-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm ci && npx prisma generate && npm run build`
   - **Start Command**: `npx prisma db push && npm run start`
3. **Environment Variables**:
   - `DATABASE_URL`: *(paste Internal Database URL from Step 1)*
   - `REDIS_HOST`: *(paste Internal Redis Host from Step 2)*
   - `REDIS_PORT`: `6379`
   - `JWT_SECRET`: *(generate random 32-char string)*
   - `FRONTEND_URL`: *(your frontend render url or `*`)*
   - `MAX_EMAILS_PER_HOUR`: `100`
   - `MAX_EMAILS_PER_HOUR_PER_SENDER`: `50`
   - `WORKER_CONCURRENCY`: `3`
   - `MIN_SEND_DELAY_MS`: `500`

---

### 4. Create Frontend Web Service
1. Click **New +** ➔ **Web Service** ➔ Connect your GitHub repository.
2. Settings:
   - **Name**: `mailflow-frontend`
   - **Root Directory**: `frontend`
   - **Environment**: `Node`
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npm run start`
3. **Environment Variables**:
   - `NEXTAUTH_URL`: `https://mailflow-frontend.onrender.com` *(your frontend URL)*
   - `NEXTAUTH_SECRET`: *(same JWT_SECRET as backend)*
   - `JWT_SECRET`: *(same JWT_SECRET as backend)*
   - `INTERNAL_BACKEND_URL`: `https://mailflow-backend.onrender.com` *(or internal URL)*
   - `NEXT_PUBLIC_API_URL`: `""`
   - `GOOGLE_CLIENT_ID`: *(your Google OAuth client ID)*
   - `GOOGLE_CLIENT_SECRET`: *(your Google OAuth client secret)*

---

## 🐳 Docker Deployment Option on Render

If you prefer deploying via Docker on Render:
- **Backend**: Set Environment to **Docker**; Render will automatically use [`backend/Dockerfile`](file:///c:/Users/NISHAKART/Documents/GitHub/mailflow-email-scheduler/backend/Dockerfile).
- **Frontend**: Set Environment to **Docker**; Render will automatically use [`frontend/Dockerfile`](file:///c:/Users/NISHAKART/Documents/GitHub/mailflow-email-scheduler/frontend/Dockerfile).
