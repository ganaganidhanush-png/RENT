-- ========================================================
-- RENTVAULT - 6-ROOM MICRO-PROPERTY MANAGEMENT SCHEMA
-- Rooms: G1, 2A, 2B, 3A, 3B, P1
-- ========================================================
-- Copy and paste this script into your Supabase SQL Editor:
-- Dashboard -> SQL Editor -> New Query -> Run

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Enums
DO $$ BEGIN
    CREATE TYPE room_status AS ENUM ('VACANT', 'OCCUPIED', 'MAINTENANCE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE tenant_type AS ENUM ('BACHELORS', 'FAMILY');
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
    CREATE TYPE payment_receiver AS ENUM ('LANDLORD', 'CARETAKER', 'MANAGER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('PAID', 'PARTIAL', 'PENDING', 'OVERDUE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_category AS ENUM ('RENT', 'MAINTENANCE', 'SECURITY_DEPOSIT', 'ELECTRICITY', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Rooms Table (6 Units: G1, 2A, 2B, 3A, 3B, P1)
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_number VARCHAR(20) NOT NULL UNIQUE,
    floor INTEGER NOT NULL DEFAULT 1,
    base_rent NUMERIC(10, 2) NOT NULL,
    security_deposit NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status room_status NOT NULL DEFAULT 'VACANT',
    capacity INTEGER NOT NULL DEFAULT 2, -- Maximum bed/person capacity
    current_occupancy INTEGER NOT NULL DEFAULT 0, -- Current occupants count
    can_someone_get_in BOOLEAN NOT NULL DEFAULT true, -- Whether there's an opening/bed available
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
    tenant_type tenant_type NOT NULL DEFAULT 'BACHELORS', -- BACHELORS or FAMILY
    occupants JSONB DEFAULT '[]'::jsonb, -- Array of bachelor occupants: [{name, phone, occupation, organization, role_or_course, aadhar_number}]
    family_members_count INTEGER DEFAULT 1,
    primary_occupation VARCHAR(255),
    college_or_company VARCHAR(255),
    emergency_contact_name VARCHAR(255) NOT NULL,
    emergency_contact_phone VARCHAR(20) NOT NULL,
    emergency_contact_relation VARCHAR(100) NOT NULL,
    move_in_date DATE NOT NULL,
    lease_end_date DATE NOT NULL,
    actual_move_out_date DATE,
    monthly_rent NUMERIC(10, 2) NOT NULL,
    security_deposit_paid NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    rent_due_day INTEGER NOT NULL DEFAULT 5 CHECK (rent_due_day BETWEEN 1 AND 31), -- Recurring day of the month rent is due (e.g. 5th of every month)
    status tenant_status NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Document Vault Table
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
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
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
    billing_period_month DATE NOT NULL,
    amount_due NUMERIC(10, 2) NOT NULL,
    amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    amount_pending NUMERIC(10, 2) GENERATED ALWAYS AS (amount_due - amount_paid) STORED,
    payment_status payment_status NOT NULL DEFAULT 'PENDING',
    payment_date TIMESTAMPTZ,
    payment_method payment_method,
    received_by VARCHAR(100) NOT NULL DEFAULT 'LANDLORD',
    payment_type VARCHAR(50) NOT NULL DEFAULT 'RENT',
    transaction_ref VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_tenants_room_id ON public.tenants(room_id);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_tenant_type ON public.tenants(tenant_type);
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

-- Auto-sync Room status with Tenant status accurately
CREATE OR REPLACE FUNCTION sync_room_occupancy()
RETURNS TRIGGER AS $$
DECLARE
    target_room_id UUID;
    total_active_occupants INTEGER;
    target_capacity INTEGER;
BEGIN
    target_room_id := COALESCE(NEW.room_id, OLD.room_id);
    IF target_room_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Calculate total active members in this room across all active/notice-period tenants
    SELECT COALESCE(SUM(
        CASE 
            WHEN t.tenant_type = 'BACHELORS' AND jsonb_array_length(COALESCE(t.occupants, '[]'::jsonb)) > 0 
                THEN jsonb_array_length(t.occupants)
            ELSE COALESCE(t.family_members_count, 1)
        END
    ), 0)
    INTO total_active_occupants
    FROM public.tenants t
    WHERE t.room_id = target_room_id 
      AND t.status IN ('ACTIVE', 'NOTICE_PERIOD');

    SELECT COALESCE(capacity, 2) INTO target_capacity FROM public.rooms WHERE id = target_room_id;
    IF target_capacity IS NULL THEN
        target_capacity := 2;
    END IF;

    UPDATE public.rooms
    SET current_occupancy = total_active_occupants,
        status = CASE 
            WHEN total_active_occupants > 0 THEN 'OCCUPIED'::room_status
            ELSE 'VACANT'::room_status
        END,
        can_someone_get_in = (total_active_occupants < target_capacity)
    WHERE id = target_room_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_room_occupancy ON public.tenants;
CREATE TRIGGER trg_sync_room_occupancy
AFTER INSERT OR UPDATE OR DELETE ON public.tenants
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

-- 9. Seed the 6 Rooms: G1, 2A, 2B, 3A, 3B, P1
INSERT INTO public.rooms (room_number, floor, base_rent, security_deposit, status, capacity, current_occupancy, can_someone_get_in, notes) VALUES
('G1', 0, 12000.00, 24000.00, 'VACANT', 2, 0, true, 'Ground floor unit, quiet entry, ideal for family or bachelors'),
('2A', 2, 14000.00, 28000.00, 'VACANT', 3, 0, true, 'Second floor front facing, attached balcony, cross ventilation'),
('2B', 2, 13500.00, 27000.00, 'VACANT', 2, 0, true, 'Second floor rear unit, peaceful with attached bathroom'),
('3A', 3, 14500.00, 29000.00, 'VACANT', 3, 0, true, 'Third floor front facing, excellent sunlight and ventilation'),
('3B', 3, 14000.00, 28000.00, 'VACANT', 2, 0, true, 'Third floor rear unit, attached bath and study corner'),
('P1', 4, 18000.00, 36000.00, 'VACANT', 4, 0, true, 'Penthouse suite with private rooftop terrace access')
ON CONFLICT (room_number) DO UPDATE SET
    floor = EXCLUDED.floor,
    base_rent = EXCLUDED.base_rent,
    security_deposit = EXCLUDED.security_deposit,
    capacity = EXCLUDED.capacity,
    notes = EXCLUDED.notes;

