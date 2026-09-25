-- ========================================================
-- RENTVAULT - 5-ROOM MICRO-PROPERTY MANAGEMENT SCHEMA
-- ========================================================
-- Copy and paste this entire script into your Supabase SQL Editor:
-- Dashboard -> SQL Editor -> New Query -> Run

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Enums
DO $$ BEGIN
    CREATE TYPE room_status AS ENUM ('VACANT', 'OCCUPIED', 'MAINTENANCE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE tenant_status AS ENUM ('ACTIVE', 'NOTICE_PERIOD', 'MOVED_OUT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE document_type AS ENUM ('AADHAR_CARD', 'RENTAL_AGREEMENT', 'TENANT_PHOTO', 'POLICE_VERIFICATION', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('UPI', 'CASH', 'BANK_TRANSFER', 'CHEQUE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_receiver AS ENUM ('LANDLORD', 'CARETAKER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('PAID', 'PARTIAL', 'PENDING', 'OVERDUE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Rooms Table (5 Units)
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_number VARCHAR(20) NOT NULL UNIQUE,
    floor INTEGER NOT NULL DEFAULT 1,
    base_rent NUMERIC(10, 2) NOT NULL,
    security_deposit NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status room_status NOT NULL DEFAULT 'VACANT',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Tenants Table
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    emergency_contact_name VARCHAR(255) NOT NULL,
    emergency_contact_phone VARCHAR(20) NOT NULL,
    emergency_contact_relation VARCHAR(100) NOT NULL,
    move_in_date DATE NOT NULL,
    lease_end_date DATE NOT NULL,
    actual_move_out_date DATE,
    monthly_rent NUMERIC(10, 2) NOT NULL,
    security_deposit_paid NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status tenant_status NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Document Vault Table
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
    doc_type document_type NOT NULL,
    storage_path TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100),
    file_size_bytes BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Payments Table
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
    billing_period_month DATE NOT NULL,
    amount_due NUMERIC(10, 2) NOT NULL,
    amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    amount_pending NUMERIC(10, 2) GENERATED ALWAYS AS (amount_due - amount_paid) STORED,
    payment_status payment_status NOT NULL DEFAULT 'PENDING',
    payment_date TIMESTAMPTZ,
    payment_method payment_method,
    received_by payment_receiver NOT NULL DEFAULT 'LANDLORD',
    transaction_ref VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_tenants_room_id ON public.tenants(room_id);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants(status);
CREATE INDEX IF NOT EXISTS idx_documents_tenant_id ON public.documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON public.payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_billing_period ON public.payments(billing_period_month);

-- 7. Automated Triggers
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rooms_updated_at ON public.rooms;
CREATE TRIGGER trg_rooms_updated_at BEFORE UPDATE ON public.rooms
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_tenants_updated_at ON public.tenants;
CREATE TRIGGER trg_tenants_updated_at BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-sync Room status with Tenant status
CREATE OR REPLACE FUNCTION sync_room_occupancy()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.status IN ('ACTIVE', 'NOTICE_PERIOD') AND NEW.room_id IS NOT NULL) THEN
        UPDATE public.rooms SET status = 'OCCUPIED' WHERE id = NEW.room_id;
    ELSIF (NEW.status = 'MOVED_OUT' AND NEW.room_id IS NOT NULL) THEN
        UPDATE public.rooms SET status = 'VACANT' WHERE id = NEW.room_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_room_occupancy ON public.tenants;
CREATE TRIGGER trg_sync_room_occupancy
AFTER INSERT OR UPDATE OF status, room_id ON public.tenants
FOR EACH ROW EXECUTE FUNCTION sync_room_occupancy();

-- 8. Row Level Security Policies
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access for rooms" ON public.rooms;
CREATE POLICY "Public read access for rooms" ON public.rooms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Full access to rooms" ON public.rooms;
CREATE POLICY "Full access to rooms" ON public.rooms FOR ALL USING (true);

DROP POLICY IF EXISTS "Full access to tenants" ON public.tenants;
CREATE POLICY "Full access to tenants" ON public.tenants FOR ALL USING (true);

DROP POLICY IF EXISTS "Full access to documents" ON public.documents;
CREATE POLICY "Full access to documents" ON public.documents FOR ALL USING (true);

DROP POLICY IF EXISTS "Full access to payments" ON public.payments;
CREATE POLICY "Full access to payments" ON public.payments FOR ALL USING (true);
