# Allo Inventory Reservation System

Backend-focused and Concurrency-safe inventory reservation platform built for the Allo take-home exercise.

This project simulates a real-world inventory reservation workflow with concurrency-safe stock handling, temporary reservation holds, expiry cleanup, and distributed locking to prevent overselling.

---

## Tech Stack

- Next.js (App Router)
- TypeScript
- Prisma ORM
- PostgreSQL (Neon)
- Redis (Upstash)
- Tailwind CSS
- Zod
- ioredis

---

## Architecture Overview

The system follows a reservation-based inventory model:

- PostgreSQL acts as the source of truth for inventory and reservations.
- Redis provides distributed locking to prevent race conditions during concurrent reservation requests.
- Prisma transactions ensure stock updates and reservation creation happen atomically.
- Expired reservations are cleaned through both lazy cleanup and scheduled cron execution.

The main goal of the project was preventing overselling when multiple users attempt to reserve the same inventory simultaneously.

---

# Running Locally

## Prerequisites

- Node.js 18+
- PostgreSQL database (Neon / Supabase / Railway)
- Redis instance (Upstash free tier or local Redis)

---

## Setup

```bash
# 1. Clone the repository
git clone https://github.com/shreyaa-hub/mutex-inventory-system.git

# 2. Move into the project
cd mutex-inventory-system

# 3. Install dependencies
npm install

# 4. Configure environment variables
cp .env.example .env
```

Fill the `.env` file:

```env
DATABASE_URL= Please add your crdentials for safety
REDIS_URL= Please add your credentials for safety
```

Then continue:

```bash
# 5. Push Prisma schema
npx prisma db push

# 6. Seed demo data
npm run db:seed

# 7. Start development server
npm run dev
```

Open:

```txt
http://localhost:3000
```

---

# Features

- Product inventory listing
- Multi-warehouse stock tracking
- Reservation lifecycle management
- Distributed Redis locking
- Race-condition-safe reservation flow
- Expiring reservation holds
- Automatic inventory restoration
- Idempotent reservation handling
- Reservation confirmation + release APIs
- Cron-based cleanup for production

---

# Inventory Reservation Flow

When a user clicks **Reserve**, the following flow happens:

## 1. Request Validation

The request body is validated using Zod schemas.

Invalid payloads immediately return `400 Bad Request`.

---

## 2. Idempotency Check

If the request contains an `Idempotency-Key` header:

- the server checks if the same reservation already exists
- if found, the original response is returned immediately

This prevents duplicate reservations caused by retries or double-clicks.

---

## 3. Expiry Cleanup

Before reading stock values:

```txt
releaseExpiredReservations()
```

runs to release any expired reservation holds.

This ensures inventory counts stay accurate.

---

## 4. Redis Distributed Lock

A lock is acquired using Redis:

```txt
lock:stock:<productId>:<warehouseId>
```

The lock uses:

```txt
SET key token NX PX 5000
```

for atomic acquisition.

A Lua release script ensures only the lock owner can safely release the lock.

If another request already holds the lock:

```txt
503 Service Unavailable
```

is returned so the client can retry.

---

## 5. Atomic Database Transaction

Inside a Prisma transaction:

- current stock is read
- available inventory is calculated
- stock availability is validated
- reserved count is incremented
- reservation row is created

All steps happen atomically.

If inventory is insufficient:

```txt
409 Conflict
```

is returned.

---

## 6. Lock Release

The Redis lock is released inside a `finally` block to guarantee cleanup even if an exception occurs.

---

# Why Overselling Does Not Happen

If two users try reserving the last unit simultaneously:

- Request A acquires the Redis lock
- Request B fails to acquire it and receives a 503 retry response
- Request A completes the transaction first
- Inventory updates before another request can proceed

This guarantees inventory consistency.

---

# Reservation Lifecycle

A reservation can exist in three states:

## PENDING

Temporary hold created after reservation.

Inventory is reserved but not sold yet.

---

## CONFIRMED

Reservation successfully completed.

Stock moves from:

```txt
reserved -> sold
```

---

## RELEASED

Reservation expired or manually cancelled.

Reserved stock is restored back to available inventory.

---

# Expiry Handling

Reservations automatically expire after a fixed duration.

Two cleanup layers are used:

---

## Lazy Cleanup

Whenever products are fetched:

```txt
GET /api/products
```

expired reservations are cleaned automatically.

This keeps inventory updated during normal application usage.

---

## Cron Cleanup

A Vercel Cron Job runs periodically:

```txt
/api/cron/release-expired
```

This ensures stale reservations are released even during low traffic periods.

---

# API Reference

| Method | Route                           | Description             |
| ------ | ------------------------------- | ----------------------- |
| GET    | `/api/products`                 | Get product inventory   |
| GET    | `/api/warehouses`               | Get warehouse list      |
| POST   | `/api/reservations`             | Create reservation      |
| GET    | `/api/reservations/:id`         | Get reservation details |
| POST   | `/api/reservations/:id/confirm` | Confirm reservation     |
| POST   | `/api/reservations/:id/release` | Release reservation     |

---

# Status Codes

| Status | Meaning             |
| ------ | ------------------- |
| 200    | Success             |
| 201    | Reservation created |
| 400    | Invalid request     |
| 404    | Resource not found  |
| 409    | Insufficient stock  |
| 410    | Reservation expired |
| 503    | Lock contention     |

---

# Trade-offs & Improvements

If I had more time, I would improve:

## Better Retry Strategy

Currently lock contention returns `503`.

Adding automatic client-side retry with exponential backoff would improve UX.

---

## Real-Time Reservation Updates

The current UI polls for updates.

Using:

- WebSockets
- Server-Sent Events

would keep timers perfectly synchronized.

---

## Database-Level Locking

A pure PostgreSQL solution using:

```sql
SELECT FOR UPDATE SKIP LOCKED
```

could remove Redis as a dependency.

I chose Redis because it integrates cleanly with Prisma transactions and works well for distributed systems.

---

## Automated Concurrency Tests

I'd add integration tests simulating concurrent reservation requests to verify overselling never occurs.

---

## Authentication

Reservations are currently anonymous.

In production, reservations would be associated with authenticated users.

---

# Deployment

Frontend and API are deployed on Vercel.

Environment variables required:

```env
DATABASE_URL=
REDIS_URL=
```

---

# Screenshots

## Inventory Listing

- Product inventory grouped by warehouse
- Live available stock calculation
- Reservation buttons with disabled out-of-stock state

## Reservation Details

- Countdown timer
- Confirm reservation
- Release reservation
- Automatic expiry handling

---

# Learning Outcomes

This project helped me understand:

- distributed locking
- race condition prevention
- Prisma transactions
- Redis locking patterns
- idempotent APIs
- reservation systems
- inventory consistency challenges
- expiry lifecycle management

---

# Author

Shreya Singh, 25MCB1005
VIT, Chennai
