# Allo Inventory – Take-Home Exercise

Inventory and order-fulfillment platform with race-condition-free reservation logic.

## Running locally

### Prerequisites

- Node.js 18+
- A hosted PostgreSQL instance (Supabase, Neon, or Railway all have free tiers)
- A Redis instance (Upstash free tier, or local `redis-server`)

### Setup

```bash
# 1. Clone and install
git clone <repo>
cd allo-inventory
npm install

# 2. Set environment variables
cp .env.example .env
# edit .env and fill in DATABASE_URL and REDIS_URL

# 3. Push schema to the database and generate the Prisma client
npx prisma db push

# 4. Seed with sample data (3 warehouses, 3 products)
npm run db:seed

# 5. Start the dev server
npm run dev
```

Then open http://localhost:3000.

## How the reservation + concurrency logic works

When a user clicks Reserve, `POST /api/reservations` runs the following:

1. **Parse and validate** the request body with Zod.
2. **Check idempotency** – if the request includes an `Idempotency-Key` header and a reservation with that key already exists, return it immediately without touching the database again.
3. **Run lazy expiry cleanup** so any expired holds are released before we read stock numbers.
4. **Acquire a Redis distributed lock** scoped to the specific `productId + warehouseId` pair. The lock uses `SET key token NX PX 5000` – atomic, no Lua scripts needed. If the lock is already held (another concurrent request got there first), we return a 503 and let the client retry.
5. **Inside the lock**, run a Prisma `$transaction` that:
   - Reads the current `StockLevel` row (total units and currently reserved count).
   - Compares `totalUnits - reserved` against the requested quantity.
   - If there isn't enough stock, returns 409.
   - If there is, increments `reserved` and creates the `Reservation` row in a single atomic transaction.
6. **Release the lock** in a `finally` block so it's always freed even if an error occurs.

This means if two requests arrive simultaneously for the last unit: one grabs the lock, the other hits the 503 path. The one that got through either succeeds and bumps `reserved`, or fails with 409 if stock ran out. Either way, we never double-book.

I chose Redis locking over a PostgreSQL advisory lock or a `SELECT FOR UPDATE` because it composes nicely with Prisma's transaction model and the Upstash free tier is already needed for production. The trade-off is that under very high concurrency the 503 rate will be noticeable. The right fix at that scale would be a queue per SKU or Postgres `SELECT FOR UPDATE SKIP LOCKED`.

## How expiry works in production

Two layers:

**Lazy cleanup** – every `GET /api/products` call first runs `releaseExpiredReservations()`. Stale reservations are cleaned up organically whenever someone loads the product list.

**Vercel Cron** – `vercel.json` configures `/api/cron/release-expired` to run every minute. Even if no user traffic hits the product page, expired holds are released within 60 seconds. The endpoint checks an optional `x-cron-secret` header to prevent unauthorized calls.

## Trade-offs and things I'd do differently with more time

- **Optimistic UI** – the checkout page polls for server state. Server-Sent Events would sync the countdown exactly with `expiresAt` without polling.
- **`SELECT FOR UPDATE`** – the Redis lock adds a network round-trip. A pure Postgres solution with `SELECT FOR UPDATE SKIP LOCKED` inside the transaction would remove this dependency.
- **503 retry** – lock contention returns a 503 right now. A proper client-side retry with backoff would be smoother UX.
- **Tests** – I'd add integration tests that fire concurrent requests at the reservation endpoint to verify no double-booking happens.
- **Quantity picker** – UI hardcodes `quantity: 1`. A real product page would let users pick a quantity.
- **Auth** – out of scope here. In production each reservation would be tied to a user ID.

## API reference

| Method | Path | Status codes |
|--------|------|-------------|
| GET | /api/products | 200 |
| GET | /api/warehouses | 200 |
| POST | /api/reservations | 201 · 400 · 409 not enough stock · 503 lock contention |
| GET | /api/reservations/:id | 200 · 404 |
| POST | /api/reservations/:id/confirm | 200 · 404 · 410 expired |
| POST | /api/reservations/:id/release | 200 · 404 · 409 already confirmed |

### Idempotency

Both reserve and confirm endpoints accept an `Idempotency-Key` header. Retrying with the same key returns the original response without repeating side effects.

## Stack

Next.js 15 (App Router) · TypeScript · Prisma · PostgreSQL (Supabase/Neon) · ioredis (Upstash) · Zod · Tailwind CSS
