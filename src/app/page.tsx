import { createClient } from '@/lib/supabase/server';
import DashboardView from '@/components/dashboard/dashboard-view';
import { Room, Payment, Tenant } from '@/types/database';

export const revalidate = 0; // Real-time fresh data

export default async function DashboardPage() {
  const supabase = await createClient();

  let rooms: Room[] = [];
  let recentPayments: Payment[] = [];
  let expiringTenants: Tenant[] = [];
  let allTenants: Tenant[] = [];

  let occupiedRooms = 0;
  let totalRooms = 0;
  let totalRentCollected = 0;
  let totalRentExpected = 0;
  let pendingDues = 0;
  let expiriesCount = 0;

  try {
    // 1. Fetch Rooms from Supabase
    const { data: dbRooms } = await supabase
      .from('rooms')
      .select('*')
      .order('floor', { ascending: true })
      .order('room_number');

    if (dbRooms && dbRooms.length > 0) {
      rooms = dbRooms;
      totalRooms = dbRooms.length;
      occupiedRooms = dbRooms.filter((r) => r.status === 'OCCUPIED').length;
    } else {
      const { DEFAULT_ROOMS } = await import('@/lib/constants/rooms');
      rooms = DEFAULT_ROOMS;
      totalRooms = DEFAULT_ROOMS.length;
      occupiedRooms = 0;
    }

    // 2. Fetch Active Tenants from Supabase
    const { data: dbTenants } = await supabase
      .from('tenants')
      .select('*, room:rooms(*)')
      .in('status', ['ACTIVE', 'NOTICE_PERIOD']);

    if (dbTenants && dbTenants.length > 0) {
      allTenants = dbTenants;
      totalRentExpected = dbTenants.reduce((acc, t) => acc + Number(t.monthly_rent || 0), 0);
    } else {
      totalRentExpected = rooms.reduce((acc, r) => acc + (r.status === 'OCCUPIED' ? Number(r.base_rent || 0) : 0), 0);
    }

    // 3. Fetch Payments from Supabase (Aggregate all, display recent 6)
    const { data: dbPayments } = await supabase
      .from('payments')
      .select('*, room:rooms(*), tenant:tenants(*)')
      .order('created_at', { ascending: false });

    if (dbPayments && dbPayments.length > 0) {
      recentPayments = dbPayments.slice(0, 6);
      totalRentCollected = dbPayments.reduce((acc, p) => acc + Number(p.amount_paid || 0), 0);
      pendingDues = dbPayments.reduce((acc, p) => acc + Number(p.amount_pending || 0), 0);
    }

    // 4. Fetch Expiring Leases from Supabase (Next 30 days only)
    const todayStr = new Date().toISOString().split('T')[0];
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const dateStr = thirtyDaysFromNow.toISOString().split('T')[0];

    const { data: dbExpiring } = await supabase
      .from('tenants')
      .select('*, room:rooms(*)')
      .eq('status', 'ACTIVE')
      .gte('lease_end_date', todayStr)
      .lte('lease_end_date', dateStr);

    if (dbExpiring && dbExpiring.length > 0) {
      expiringTenants = dbExpiring;
      expiriesCount = dbExpiring.length;
    }
  } catch (err) {
    console.error('Database connection error:', err);
  }

  return (
    <DashboardView
      rooms={rooms}
      recentPayments={recentPayments}
      expiringTenants={expiringTenants}
      allTenants={allTenants}
      stats={{
        occupiedRooms,
        totalRooms,
        totalRentCollected,
        totalRentExpected,
        pendingDues,
        expiriesCount,
      }}
    />
  );
}
