import { createClient } from '@/lib/supabase/server';
import DashboardView from '@/components/dashboard/dashboard-view';
import { Room, Payment, Tenant } from '@/types/database';

export const revalidate = 0; // Fresh real-time data

export default async function DashboardPage() {
  const supabase = await createClient();

  let rooms: Room[] = [];
  let recentPayments: Payment[] = [];
  let expiringTenants: Tenant[] = [];

  let occupiedRooms = 0;
  let totalRooms = 5;
  let totalRentCollected = 0;
  let totalRentExpected = 39500;
  let pendingDues = 0;
  let expiriesCount = 0;

  try {
    // 1. Fetch Rooms
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
      // Default initial 5 rooms representation
      rooms = [
        { id: '1', room_number: 'Room 101', floor: 1, base_rent: 8500, security_deposit: 17000, status: 'OCCUPIED', notes: 'Ground floor master, attached bath' },
        { id: '2', room_number: 'Room 102', floor: 1, base_rent: 7500, security_deposit: 15000, status: 'VACANT', notes: 'Ground floor, garden view' },
        { id: '3', room_number: 'Room 201', floor: 2, base_rent: 8500, security_deposit: 17000, status: 'OCCUPIED', notes: 'First floor corner, balcony' },
        { id: '4', room_number: 'Room 202', floor: 2, base_rent: 8000, security_deposit: 16000, status: 'OCCUPIED', notes: 'First floor standard, ventilated' },
        { id: '5', room_number: 'Room 203', floor: 2, base_rent: 7000, security_deposit: 14000, status: 'MAINTENANCE', notes: 'Repainting & plumbing check' },
      ];
      occupiedRooms = 3;
      totalRooms = 5;
      totalRentCollected = 25000;
      totalRentExpected = 39500;
      pendingDues = 8000;
      expiriesCount = 1;
    }

    // 2. Fetch Recent Payments
    const { data: dbPayments } = await supabase
      .from('payments')
      .select('*, room:rooms(*), tenant:tenants(*)')
      .order('created_at', { ascending: false })
      .limit(5);

    if (dbPayments && dbPayments.length > 0) {
      recentPayments = dbPayments;
      totalRentCollected = dbPayments.reduce((acc, p) => acc + Number(p.amount_paid || 0), 0);
      pendingDues = dbPayments.reduce((acc, p) => acc + Number(p.amount_pending || 0), 0);
    } else if (rooms[0]?.id === '1') {
      // Sample initial payments
      recentPayments = [
        {
          id: 'pay-1',
          tenant_id: 't-1',
          room_id: '1',
          billing_period_month: '2026-09-01',
          amount_due: 8500,
          amount_paid: 8500,
          amount_pending: 0,
          payment_status: 'PAID',
          payment_date: '2026-09-05T10:00:00Z',
          payment_method: 'UPI',
          received_by: 'LANDLORD',
          transaction_ref: 'UPI/9837423984',
          room: rooms[0],
          tenant: { id: 't-1', room_id: '1', full_name: 'Rahul Sharma', phone: '+91 98765 43210', emergency_contact_name: 'Ramesh Sharma', emergency_contact_phone: '+91 98765 00000', emergency_contact_relation: 'Parent', move_in_date: '2026-01-01', lease_end_date: '2026-12-31', monthly_rent: 8500, security_deposit_paid: 17000, status: 'ACTIVE' },
        },
        {
          id: 'pay-2',
          tenant_id: 't-2',
          room_id: '3',
          billing_period_month: '2026-09-01',
          amount_due: 8500,
          amount_paid: 8500,
          amount_pending: 0,
          payment_status: 'PAID',
          payment_date: '2026-09-04T14:30:00Z',
          payment_method: 'BANK_TRANSFER',
          received_by: 'LANDLORD',
          transaction_ref: 'NEFT/23498234',
          room: rooms[2],
          tenant: { id: 't-2', room_id: '3', full_name: 'Priya Patel', phone: '+91 98111 22334', emergency_contact_name: 'Suresh Patel', emergency_contact_phone: '+91 98111 00000', emergency_contact_relation: 'Parent', move_in_date: '2026-02-01', lease_end_date: '2026-10-15', monthly_rent: 8500, security_deposit_paid: 17000, status: 'ACTIVE' },
        },
        {
          id: 'pay-3',
          tenant_id: 't-3',
          room_id: '4',
          billing_period_month: '2026-09-01',
          amount_due: 8000,
          amount_paid: 0,
          amount_pending: 8000,
          payment_status: 'OVERDUE',
          payment_date: null,
          payment_method: null,
          received_by: 'CARETAKER',
          transaction_ref: null,
          room: rooms[3],
          tenant: { id: 't-3', room_id: '4', full_name: 'Amit Verma', phone: '+91 97222 33445', emergency_contact_name: 'Sunita Verma', emergency_contact_phone: '+91 97222 00000', emergency_contact_relation: 'Spouse', move_in_date: '2026-03-01', lease_end_date: '2027-02-28', monthly_rent: 8000, security_deposit_paid: 16000, status: 'ACTIVE' },
        }
      ];
    }

    // 3. Fetch Expiring Leases
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
    } else if (rooms[0]?.id === '1') {
      expiringTenants = [
        {
          id: 't-2',
          room_id: '3',
          full_name: 'Priya Patel',
          phone: '+91 98111 22334',
          emergency_contact_name: 'Suresh Patel',
          emergency_contact_phone: '+91 98111 00000',
          emergency_contact_relation: 'Parent',
          move_in_date: '2026-02-01',
          lease_end_date: '2026-10-15',
          monthly_rent: 8500,
          security_deposit_paid: 17000,
          status: 'ACTIVE',
          room: rooms[2],
        }
      ];
      expiriesCount = 1;
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
