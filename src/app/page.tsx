import { createClient } from '@/lib/supabase/server';
import DashboardView from '@/components/dashboard/dashboard-view';
import { Room, Payment, Tenant } from '@/types/database';

export const revalidate = 0; // Real-time fresh data

export default async function DashboardPage() {
  const supabase = await createClient();

  let rooms: Room[] = [];
  let recentPayments: Payment[] = [];
  let expiringTenants: Tenant[] = [];

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
      .order('room_number');

    if (dbRooms && dbRooms.length > 0) {
      rooms = dbRooms;
      totalRooms = dbRooms.length;
      occupiedRooms = dbRooms.filter((r) => r.status === 'OCCUPIED').length;
      totalRentExpected = dbRooms.reduce((acc, r) => acc + Number(r.base_rent || 0), 0);
    } else {
      const { DEFAULT_ROOMS } = await import('@/lib/constants/rooms');
      rooms = DEFAULT_ROOMS;
      totalRooms = DEFAULT_ROOMS.length;
      occupiedRooms = 0;
      totalRentExpected = DEFAULT_ROOMS.reduce((acc, r) => acc + Number(r.base_rent || 0), 0);
    }

    // 2. Fetch Recent Payments from Supabase
    const { data: dbPayments } = await supabase
      .from('payments')
      .select('*, room:rooms(*), tenant:tenants(*)')
      .order('created_at', { ascending: false })
      .limit(5);

    if (dbPayments && dbPayments.length > 0) {
      recentPayments = dbPayments;
      totalRentCollected = dbPayments.reduce((acc, p) => acc + Number(p.amount_paid || 0), 0);
      pendingDues = dbPayments.reduce((acc, p) => acc + Number(p.amount_pending || 0), 0);
    }

    // 3. Fetch Expiring Leases from Supabase (Next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const dateStr = thirtyDaysFromNow.toISOString().split('T')[0];

    const { data: dbExpiring } = await supabase
      .from('tenants')
      .select('*, room:rooms(*)')
      .eq('status', 'ACTIVE')
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
