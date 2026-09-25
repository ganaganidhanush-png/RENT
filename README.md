# RentVault - 5-Room Micro-Property Management System

A web application designed for independent landlords to manage 5 rental rooms, tenant onboarding, rent ledger tracking, and secure ID document vaults.

---

## Tech Stack
* **Frontend**: Next.js 16 (App Router, Turbopack, React 19) + Tailwind CSS + Lucide React
* **Backend & Database**: Supabase (PostgreSQL with RLS, Triggers, and Enums)
* **Document Vault**: Supabase Storage (`tenant-vault` private bucket with 60-second signed URLs)
* **Hosting**: Vercel

---

## Features
1. **Property Dashboard**:
   - Real-time occupancy rate tracking (5 units).
   - Monthly rent collection counter (Collected vs. Expected).
   - Outstanding rent dues with instant alerts.
   - 30-day lease expiration notifications.
2. **5-Unit Operational Grid**:
   - Visual status cards: **Vacant (To-Let)**, **Occupied**, and **Maintenance**.
   - One-click tenant assignment for vacant rooms.
3. **Tenant Onboarding & Document Vault**:
   - Comprehensive registration: move-in/out dates, monthly rent, and emergency contacts.
   - Secure drag-and-drop file upload for **Aadhar Card / ID Proof**, **Signed Agreement**, and **Tenant Photo**.
   - Files are stored in encrypted private buckets with time-limited presigned URLs.
4. **Financial Ledger**:
   - Rent tracking with payment method (`UPI`, `Cash`, `Bank Transfer`, `Cheque`) and collector (`Landlord`, `Caretaker`).

---

## Getting Started

### 1. Prerequisites
- Node.js 18+ installed
- A Supabase account ([supabase.com](https://supabase.com))

### 2. Configure Supabase Database
1. Go to your **Supabase Dashboard -> SQL Editor**.
2. Run the SQL script located in [`supabase/schema.sql`](./supabase/schema.sql).
3. Under **Storage**, create a new bucket named **`tenant-vault`**:
   - Set **Public bucket: OFF** (strictly Private).
   - Max file size: 10MB.

### 3. Environment Variables
Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

### 4. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

---

## Deployment to Vercel
1. Push this repository to GitHub.
2. Import the repository in [Vercel](https://vercel.com).
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to Vercel Environment Variables.
4. Click **Deploy**.
