# 🎥 Testing & Video Demo Walkthrough Guide

This document provides a structured guide for validating all features and recording the 5-minute assignment demo video.

---

## 🎬 5-Minute Demo Video Script

### Section 1: Introduction & Architecture (0:00 - 1:00)
- Briefly introduce MailFlow.
- Show the tech stack: Next.js 14, Express TypeScript, BullMQ + Redis, PostgreSQL + Prisma, Elasticsearch, and Ethereal SMTP.
- Explain the key principle: **100% Zero-Cron BullMQ delayed jobs with deterministic SHA-256 idempotency**.

---

### Section 2: Dual Login Demonstration (1:00 - 1:45)
- Open `http://localhost:3000/login`.
- **Demo Direct Email/Password**: Enter `oliver.brown@domain.io` and `password123` -> Click **Login** -> Directly loads dashboard.
- **Demo Google OAuth**: Click **Sign Out** -> Click **Login with Google** -> Authenticate with Google -> Lands on dashboard with Google avatar and user details.

---

### Section 3: Composing, CSV Leads & Scheduling (1:45 - 2:45)
- Click **Compose** to open the modal.
- Upload a `.csv` lead list or type recipient email addresses. Show duplicate detection.
- Type Subject & Body using the rich formatting toolbar.
- Click **Send Later** and pick a time 2 minutes in the future.
- Click **Schedule** -> Show the success toast and the new scheduled item in the table.
- Open **Bull Board** at `http://localhost:4000/admin/queues` -> Show the delayed job waiting in Redis with its delay countdown!

---

### Section 4: Server Restart Persistence Scenario (2:45 - 3:45)
- Stop the backend server process in the terminal (`Ctrl + C`).
- Show that the delayed jobs are still safely persisted in Redis.
- Start the backend server again (`npm run dev`).
- Show that BullMQ immediately reconnects to Redis and resumes delayed job countdowns **without duplicating or restarting from scratch**.
- When the timer expires, show the worker processing the job and the email transitioning from **Scheduled** to **Sent**!

---

### Section 5: Rate Limiting & Slack Webhook Alerts (3:45 - 4:45)
- Explain the Redis token bucket algorithm (`ratelimit:{senderId}:{hourWindow}`).
- Demonstrate scheduling a batch that exceeds the hourly limit (e.g. 55 emails when limit is 50).
- Show the worker rescheduling the 5 excess emails into the start of the next hour window.
- Show the live Slack notification triggered to the connected Slack workspace.

---

### Section 6: Archive & Restore, Search, and Summary (4:45 - 5:00)
- Hover over an email row -> Click **Archive** -> Show counter decrease.
- Open **Archived** tab under CORE -> Click **Restore** -> Show email return to active list.
- Type in the Search bar -> Show instant full-text Elasticsearch results.
- Wrap up!

---

## 🧪 Automated & Manual Verification Checklist

| Scenario | Expected Outcome | Verified |
|---|---|---|
| Schedule email with future date | BullMQ job created with exact millisecond delay | ✅ |
| Submit duplicate schedule payload | SHA-256 hash deduplication skips duplicate | ✅ |
| Server killed & restarted | Redis delayed jobs resume without double sending | ✅ |
| Exceed hourly limit (50/hr) | Jobs rescheduled to next hour without dropping | ✅ |
| Slack OAuth connected | Alert dispatched on rate-limit threshold hit | ✅ |
| Click Archive / Restore | Email cleanly transitions between views | ✅ |
| Elasticsearch multi-match search | Returns matching subjects/recipients instantly | ✅ |
