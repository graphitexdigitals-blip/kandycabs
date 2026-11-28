# 🚕 Kandy Cabs v2 — Production Cab Booking & Fleet Operations Platform

A complete full-stack enterprise monorepo platform for round-the-clock cab bookings, realtime dispatching, multi-tier GPS fleet tracking, and automated payments reconciliation.

---

## 🏗️ Monorepo Architecture

```
kandycabs-v2/
├── apps/
│   ├── web/            # Next.js 14 App Router (Customer Website & Unified API Layer)
│   ├── admin/          # Next.js 14 App Router (Operations Command Center, Map & Audit)
│   ├── driver-app/     # React Native + Expo SDK 51 (Driver App with Flow A & B GPS)
│   └── customer-app/   # React Native + Expo SDK 51 (Customer Mobile App with Flow B GPS)
├── packages/
│   ├── db/             # Prisma Schema + Singleton Client + Health & Env Check
│   ├── shared/         # Shared Types, Pricing Engine, Auth Guards, Web Crypto Hashing
│   └── typescript-config/ # Shared tsconfig bases
└── package.json        # Turborepo Monorepo Root
```

---

## ⚡ Quick Start

### 1. Prerequisites
- **Node.js**: `v18.18+` or `v20+`
- **npm**: `v9+` or `v10+`
- **PostgreSQL Database**: Supabase or standard Postgres instance

### 2. Installation & Setup
```bash
# Clone the repository
git clone <repo-url>
cd "kandycabs updated"

# Install all monorepo dependencies
npm install

# Generate Prisma client
npm run db:generate

# Sync schema to database
npm run db:push

# (Optional) Seed initial fleet and test drivers
npm run db:seed
```

### 3. Running Development Servers
```bash
# Start all apps concurrently via Turbo
npm run dev

# Or run specific applications:
npm run dev --workspace=web           # Runs Web on http://localhost:3000
npm run dev --workspace=admin         # Runs Admin Panel on http://localhost:3001
npm run start --workspace=driver-app   # Runs Driver App Expo bundler
npm run start --workspace=customer-app # Runs Customer App Expo bundler
```

---

## ⚙️ Environment Variables Reference

Create `.env` in the project root (or within specific `apps/*` directories):

```env
# Database Connections
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# JWT Authentication
JWT_SECRET="your-256-bit-secure-random-jwt-secret-key"

# Supabase Realtime & Storage
NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOi..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."

# Payment Gateway (Razorpay)
RAZORPAY_KEY_ID="rzp_live_XXXXXXXXXX"
RAZORPAY_KEY_SECRET="your_razorpay_key_secret"
RAZORPAY_WEBHOOK_SECRET="your_razorpay_webhook_secret"

# SMS (MSG91). Server-side only, never an EXPO_PUBLIC_ variable.
# Whitelist the server outbound IP in the MSG91 panel (Railway: enable Static Outbound IPs).
MSG91_AUTH_KEY="your_msg91_auth_key"
MSG91_TEMPLATE_ID="your_dlt_approved_otp_template_id"
# Production only: allow fixed test logins (1234) for the built-in test numbers. Leave unset or false for real users.
ALLOW_TEST_ACCOUNTS="false"

# Google Maps / Routing
GOOGLE_MAPS_API_KEY="your_google_maps_api_key"
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="your_google_maps_browser_key"

# Mobile Apps Expo Public URL
EXPO_PUBLIC_API_URL="https://kandycabs.com"
```

---

## 🛡️ Known Failure Modes and How This Build Prevents Them

| Failure Mode / Security Threat | How Kandy Cabs v2 Prevents It |
| :--- | :--- |
| **Tampered Client Fare Calculation** | **Server-Authoritative Pricing Engine**: All fares are computed purely server-side in `packages/shared/src/pricing/pricingEngine.ts` and `POST /api/pricing/quote`. The client never calculates or submits price values. |
| **Dispatch Race Conditions (Double Booking)** | **Atomic Concurrency Row-Level Lock**: In `POST /api/driver/dispatches/accept`, `tx.booking.updateMany({ where: { id, assignedDriverId: null } })` guarantees that if two drivers tap accept at the exact same millisecond, exactly one commit succeeds and the other receives `HTTP 409 alreadyTaken: true`. |
| **Forged Payment Verification** | **Cryptographically Signed Razorpay Webhook**: Only `POST /api/payments/webhook` with verified `x-razorpay-signature` (HMAC SHA-256) is permitted to mark payments as `PAID`. Frontend callbacks only display spinners. |
| **Customer Location Leaks / Privacy Boundary** | **Flow B Strict Scoping**: Customer coordinates (`Booking.customerCurrentLat/Lng`) are only accessible to the single assigned driver, only during `DRIVER_ACCEPTED` or `DRIVER_EN_ROUTE`, and are automatically purged to `null` with sharing disabled upon `TRIP_STARTED`. |
| **Odometer Fraud / Reading Inflation** | **Odometer vs GPS Breadcrumb Audit**: `/admin/odometer-evidence` computes GPS distance from `TripTracking` breadcrumbs using the Haversine formula and automatically flags trips with $>10\%$ discrepancy with high-visibility alerts (`🚨 >10% VARIANCE`). |
| **Phone Number Scrapes** | **Contact Masking**: Driver phone numbers remain masked on the customer dashboard until the admin or dispatch system explicitly toggles `Booking.customerPhoneReleased = true`. |
| **OTP Rainbow Table Attacks** | **Web Crypto Salted Hashing**: OTPs are hashed using Web Crypto SHA-256 with a unique 16-byte random salt per request (`packages/shared/src/auth/hash.ts`). |
| **2-Hour Cancellation Fraud** | **Server-Side Timestamp Validation**: `POST /api/customer/cancel-booking` strictly rejects cancellation requests within 2 hours of scheduled pickup time regardless of client timer states. |

---

## 🛰️ Multi-Tier GPS Architecture (Flow A vs Flow B)

1. **Flow A (Driver $\rightarrow$ Admin Operations Map)**:
   - **IDLE Tier** (every 25s): Driver app pings `/api/driver/ping` while on-duty, updating `Driver.currentLat/Lng` and `Driver.lastPingAt`.
   - **ACTIVE-TRIP Tier** (every 10s): Inserts `TripTracking` breadcrumbs linked to the `bookingId` with offline batch buffering (up to 3 points).
   - Displayed live on `/admin/live-map`.
2. **Flow B (Customer $\rightarrow$ Driver Pickup GPS)**:
   - Activates **only** during `DRIVER_ACCEPTED` and `DRIVER_EN_ROUTE`.
   - Customer app sends foreground pings to `/api/customer/location-ping` every 15s.
   - Visible **only** on the assigned driver's en-route screen.
   - Automatically stops and purges coordinates the instant `TRIP_STARTED` is reached or when the customer turns off the live sharing toggle.

---

## 🚢 Production Deployment Checklist

### 1. Web & Admin Deployment (Vercel)
- Set Root Directory for `apps/web` and `apps/admin`.
- Configure Environment Variables (`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `RAZORPAY_*`, `NEXT_PUBLIC_SUPABASE_*`).
- Deploy `apps/web` $\rightarrow$ `https://kandycabs.com`
- Deploy `apps/admin` $\rightarrow$ `https://admin.kandycabs.com`

### 2. Mobile App Deployment (Expo Application Services - EAS)
```bash
# Login to EAS
npm install -g eas-cli
eas login

# Build Driver App
cd apps/driver-app
eas build --platform all --profile production

# Build Customer App
cd apps/customer-app
eas build --platform all --profile production
```

### 3. Supabase Keep-Alive & Health Monitoring
- Register `/api/health` with **UptimeRobot** or **cron-job.org**:
  - Target URL: `https://kandycabs.com/api/health`
  - Frequency: **Every 5 minutes**
  - Expected Response: `200 OK` with `{"status":"ok"}`
  - Prevents Supabase project pausing on inactivity and guarantees continuous operational readiness.

---

## 🧪 Monorepo Verification & Tests

```bash
# Run type checks across all 7 packages
npm run check-types

# Run production build
npm run build

# Run end-to-end test suites
npx ts-node packages/shared/src/test-auth.ts              # Auth & OTP Tests
npx ts-node packages/shared/src/test-pricing.ts           # Pricing Engine Tests
npx ts-node packages/shared/src/test-cancellation.ts      # Cancellation & Invoice Tests
npx ts-node packages/shared/src/test-phase7.ts            # Webhooks, Fleets & Odometer Tests
npx ts-node packages/shared/src/test-phase8.ts            # Flow B GPS & Privacy Tests
npx ts-node packages/shared/src/test-load-benchmarks.ts   # Load & GPS Concurrency Benchmarks
npx ts-node packages/shared/src/test-security-privacy.ts  # Security & Tamper Proofing Tests
```
