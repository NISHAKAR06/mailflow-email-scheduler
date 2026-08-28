# 📡 REST API Reference & Specification

MailFlow provides a RESTful API exposed on port `4000` (and proxied via `/api/backend` on port `3000`).

---

## 🔒 Authentication

Endpoints that modify or read private sender data require a Bearer token in the `Authorization` header:

```http
Authorization: Bearer <jwt_token>
```

Tokens are signed using `JWT_SECRET` and contain:
```json
{
  "email": "oliver.brown@domain.io",
  "name": "Oliver Brown",
  "senderId": "oliver.brown@domain.io",
  "exp": 1772345678
}
```

---

## 📬 Endpoints Overview

### 1. Health Check
- **Endpoint**: `GET /api/health`
- **Auth**: None
- **Response**:
```json
{
  "status": "ok",
  "timestamp": "2026-08-28T18:00:00.000Z"
}
```

---

### 2. Schedule Email Batch
- **Endpoint**: `POST /api/emails/schedule`
- **Auth**: Required (Bearer JWT)
- **Request Body**:
```json
{
  "senderId": "oliver.brown@domain.io",
  "recipients": [
    "alex@company.com",
    "sarah@techcorp.io"
  ],
  "subject": "Product Demo & Next Steps",
  "body": "<p>Hi there,</p><p>Looking forward to our sync tomorrow!</p>",
  "startTime": "2026-08-29T10:00:00.000Z",
  "delayMs": 2000,
  "hourlyLimit": 50
}
```
- **Response** (`201 Created`):
```json
{
  "message": "Scheduled 2 email(s) successfully (0 skipped as duplicate)",
  "scheduled": 2,
  "skipped": 0,
  "emailIds": ["em_178792819_abc1", "em_178792821_abc2"]
}
```

---

### 3. List Scheduled Emails
- **Endpoint**: `GET /api/emails/scheduled?senderId=...&page=1&limit=50`
- **Auth**: Required (Bearer JWT)
- **Response** (`200 OK`):
```json
{
  "data": [
    {
      "id": "em_178792819_abc1",
      "idempotencyKey": "9f83...a7b2",
      "senderId": "oliver.brown@domain.io",
      "recipient": "alex@company.com",
      "subject": "Product Demo & Next Steps",
      "body": "<p>Hi there...</p>",
      "scheduledFor": "2026-08-29T10:00:00.000Z",
      "status": "pending",
      "createdAt": "2026-08-28T18:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### 4. List Sent Emails
- **Endpoint**: `GET /api/emails/sent?senderId=...&page=1&limit=50`
- **Auth**: Required (Bearer JWT)
- **Response** (`200 OK`):
```json
{
  "data": [
    {
      "id": "em_178790012_def4",
      "senderId": "oliver.brown@domain.io",
      "recipient": "sarah@techcorp.io",
      "subject": "Welcome to MailFlow",
      "body": "<p>Welcome!</p>",
      "scheduledFor": "2026-08-28T09:00:00.000Z",
      "status": "sent",
      "sentAt": "2026-08-28T09:00:02.124Z",
      "createdAt": "2026-08-28T08:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### 5. Full-Text Search
- **Endpoint**: `GET /api/emails/search?q=Demo&page=1&limit=50`
- **Auth**: Required (Bearer JWT)
- **Response** (`200 OK`):
```json
{
  "data": [
    {
      "id": "em_178792819_abc1",
      "recipient": "alex@company.com",
      "subject": "Product Demo & Next Steps",
      "status": "pending"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### 6. Slack OAuth & Status
- **Get Status**: `GET /api/slack/status?senderId=...`
  ```json
  { "connected": true }
  ```
- **Initiate OAuth**: `GET /api/slack/connect?senderId=...` (Redirects to Slack authorization dialog)
- **Disconnect Slack**: `POST /api/slack/disconnect`
  ```json
  { "senderId": "oliver.brown@domain.io" }
  ```
