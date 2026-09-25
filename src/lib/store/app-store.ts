import { Room, Tenant, Payment, DocumentRecord } from '@/types/database';
import { DEFAULT_ROOMS } from '@/lib/constants/rooms';

const ROOMS_STORAGE_KEY = 'rentvault_rooms_data';
const TENANTS_STORAGE_KEY = 'rentvault_tenants_data';
const PAYMENTS_STORAGE_KEY = 'rentvault_payments_data';
const DOCUMENTS_STORAGE_KEY = 'rentvault_documents_data';
const PROFILE_STORAGE_KEY = 'rentvault_landlord_profile';

export interface LandlordProfile {
  name: string;
  phone: string;
  email: string;
  upiId: string;
  propertyName: string;
  address: string;
}

export const DEFAULT_LANDLORD_PROFILE: LandlordProfile = {
  name: '',
  phone: '',
  email: '',
  upiId: '',
  propertyName: 'RentVault Property',
  address: 'Main Building Units',
};

// Dispatch global event for instant cross-component updates
function notifyDataChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('rentvault_data_updated'));
  }
}

// ==================== ROOMS ====================
export function getLocalRooms(): Room[] {
  if (typeof window === 'undefined') return DEFAULT_ROOMS;
  try {
    const raw = localStorage.getItem(ROOMS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(DEFAULT_ROOMS));
      return DEFAULT_ROOMS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(DEFAULT_ROOMS));
      return DEFAULT_ROOMS;
    }
    return parsed;
  } catch {
    return DEFAULT_ROOMS;
  }
}

export function saveLocalRoom(updatedRoom: Room): Room[] {
  const rooms = getLocalRooms();
  const index = rooms.findIndex((r) => r.id === updatedRoom.id || r.room_number === updatedRoom.room_number);
  let newRooms: Room[];
  if (index >= 0) {
    newRooms = [...rooms];
    newRooms[index] = { ...newRooms[index], ...updatedRoom, updated_at: new Date().toISOString() };
  } else {
    newRooms = [...rooms, updatedRoom];
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(newRooms));
  }
  notifyDataChange();
  return newRooms;
}

// ==================== TENANTS ====================
export function getLocalTenants(): Tenant[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TENANTS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function syncLocalRoomOccupancy(roomId: string, currentTenants?: Tenant[]) {
  const tenants = currentTenants || getLocalTenants();
  const rooms = getLocalRooms();
  const targetRoom = rooms.find(
    (r) =>
      r.id === roomId ||
      r.room_number.toUpperCase() === String(roomId).toUpperCase() ||
      r.id.toLowerCase() === String(roomId).toLowerCase()
  );
  if (!targetRoom) return;

  // Active occupants (ACTIVE or NOTICE_PERIOD are still occupying beds)
  const activeTenants = tenants.filter(
    (t) =>
      (t.status === 'ACTIVE' || t.status === 'NOTICE_PERIOD') &&
      (t.room_id === targetRoom.id ||
       t.room_id === targetRoom.room_number ||
       (t.room && t.room.room_number === targetRoom.room_number) ||
       String(t.room_id).toLowerCase() === targetRoom.id.toLowerCase() ||
       String(t.room_id).toUpperCase() === targetRoom.room_number.toUpperCase())
  );

  let totalOccupants = 0;
  for (const t of activeTenants) {
    if (t.tenant_type === 'BACHELORS' && t.occupants && t.occupants.length > 0) {
      totalOccupants += t.occupants.length;
    } else {
      totalOccupants += t.family_members_count || 1;
    }
  }

  const capacity = targetRoom.capacity || 2;
  const newStatus = totalOccupants === 0 ? 'VACANT' : 'OCCUPIED';
  const canSomeoneGetIn = totalOccupants < capacity;

  const updatedRoom: Room = {
    ...targetRoom,
    status: newStatus,
    current_occupancy: totalOccupants,
    can_someone_get_in: canSomeoneGetIn,
    updated_at: new Date().toISOString(),
  };

  saveLocalRoom(updatedRoom);

  // Sync to Supabase in the background so remote database stays 100% updated
  if (typeof window !== 'undefined') {
    import('@/lib/supabase/client')
      .then(({ createClient }) => {
        const supabase = createClient();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetRoom.id);
        const query = supabase.from('rooms').update({
          status: newStatus,
          current_occupancy: totalOccupants,
          can_someone_get_in: canSomeoneGetIn,
          updated_at: new Date().toISOString(),
        });
        if (isUuid) {
          query.eq('id', targetRoom.id).then();
        } else {
          query.eq('room_number', targetRoom.room_number).then();
        }
      })
      .catch((err) => {
        console.warn('Room occupancy remote sync note:', err);
      });
  }
}

export function syncAllRoomsWithTenants(currentTenants?: Tenant[], currentRooms?: Room[]) {
  const tenants = currentTenants || getLocalTenants();
  const rooms = currentRooms || getLocalRooms();
  for (const room of rooms) {
    syncLocalRoomOccupancy(room.id, tenants);
  }
}

export function mergeTenants(local: Tenant[], remote: Tenant[]): Tenant[] {
  const map = new Map<string, Tenant>();
  for (const t of remote) {
    map.set(t.id, t);
  }
  for (const t of local) {
    const existing = map.get(t.id);
    if (!existing) {
      map.set(t.id, t);
    } else {
      const isLocalNewer = !existing.updated_at || (t.updated_at && t.updated_at >= existing.updated_at);
      if (isLocalNewer) {
        map.set(t.id, { ...existing, ...t });
      }
    }
  }
  return Array.from(map.values());
}

export function mergeRooms(local: Room[], remote: Room[], tenants?: Tenant[]): Room[] {
  const map = new Map<string, Room>();
  for (const r of remote) {
    map.set(r.room_number, r);
  }
  for (const r of local) {
    const existing = map.get(r.room_number);
    if (!existing) {
      map.set(r.room_number, r);
    } else {
      map.set(r.room_number, { ...existing, ...r });
    }
  }
  const merged = Array.from(map.values());
  const activeTenants = tenants || getLocalTenants();

  return merged.map((room) => {
    const matchingTenants = activeTenants.filter(
      (t) =>
        (t.status === 'ACTIVE' || t.status === 'NOTICE_PERIOD') &&
        (t.room_id === room.id ||
         t.room_id === room.room_number ||
         (t.room && t.room.room_number === room.room_number) ||
         String(t.room_id).toLowerCase() === room.id.toLowerCase() ||
         String(t.room_id).toUpperCase() === room.room_number.toUpperCase())
    );
    let totalOccupants = 0;
    for (const t of matchingTenants) {
      if (t.tenant_type === 'BACHELORS' && t.occupants && t.occupants.length > 0) {
        totalOccupants += t.occupants.length;
      } else {
        totalOccupants += t.family_members_count || 1;
      }
    }
    const capacity = room.capacity || 2;
    const status = totalOccupants === 0 ? 'VACANT' : 'OCCUPIED';
    const canSomeoneGetIn = totalOccupants < capacity;
    return {
      ...room,
      status,
      current_occupancy: totalOccupants,
      can_someone_get_in: canSomeoneGetIn,
    };
  });
}

export function saveLocalTenant(tenant: Tenant): Tenant[] {
  const tenants = getLocalTenants();
  const index = tenants.findIndex((t) => t.id === tenant.id);
  const oldRoomId = index >= 0 ? tenants[index].room_id : null;
  let newTenants: Tenant[];

  if (index >= 0) {
    newTenants = [...tenants];
    newTenants[index] = { ...newTenants[index], ...tenant, updated_at: new Date().toISOString() };
  } else {
    newTenants = [tenant, ...tenants];
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem(TENANTS_STORAGE_KEY, JSON.stringify(newTenants));
  }

  // Sync occupancy for the new room
  if (tenant.room_id) {
    syncLocalRoomOccupancy(tenant.room_id, newTenants);
  }
  // Sync occupancy for the previous room if tenant changed rooms
  if (oldRoomId && oldRoomId !== tenant.room_id) {
    syncLocalRoomOccupancy(oldRoomId, newTenants);
  }

  // Also comprehensively ensure all rooms reflect current tenancy
  syncAllRoomsWithTenants(newTenants);

  notifyDataChange();
  return newTenants;
}

export function deleteLocalTenant(tenantId: string): Tenant[] {
  const tenants = getLocalTenants();
  const toDelete = tenants.find((t) => t.id === tenantId);
  const newTenants = tenants.filter((t) => t.id !== tenantId);
  if (typeof window !== 'undefined') {
    localStorage.setItem(TENANTS_STORAGE_KEY, JSON.stringify(newTenants));
  }

  // Accurately recalculate room occupancy when tenant is removed
  if (toDelete?.room_id) {
    syncLocalRoomOccupancy(toDelete.room_id, newTenants);
  }
  syncAllRoomsWithTenants(newTenants);

  notifyDataChange();
  return newTenants;
}

// ==================== PAYMENTS ====================
export function getLocalPayments(): Payment[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PAYMENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: Payment[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Auto-normalize billing_period_month and billing_month for all stored payments
    return parsed.map((p) => {
      const ym = getPaymentYearMonth(p);
      const isoPeriod = `${ym}-01`;
      const displayMonth = formatBillingMonth(p);
      return {
        ...p,
        billing_period_month: isoPeriod,
        billing_month: p.billing_month || displayMonth,
      };
    });
  } catch {
    return [];
  }
}

export function saveLocalPayment(payment: Payment): Payment[] {
  const payments = getLocalPayments();
  const targetYm = getPaymentYearMonth(payment);
  const targetIso = `${targetYm}-01`;
  const targetDisplay = formatBillingMonth(payment);
  const normalizedPayment: Payment = {
    ...payment,
    billing_period_month: targetIso,
    billing_month: targetDisplay,
    updated_at: new Date().toISOString(),
  };

  const targetType = normalizedPayment.payment_type || 'RENT';
  const index = payments.findIndex((p) => {
    // 1. Direct match by ID
    if (p.id === normalizedPayment.id) return true;
    
    // 2. Only replace if the existing record was an unfulfilled placeholder with zero payment
    const pYm = getPaymentYearMonth(p);
    const pType = p.payment_type || 'RENT';
    const isUnpaidPlaceholder = p.amount_paid === 0 && p.payment_status === 'PENDING';
    
    return Boolean(
      isUnpaidPlaceholder &&
      p.tenant_id &&
      p.tenant_id === normalizedPayment.tenant_id &&
      targetYm &&
      pYm === targetYm &&
      pType === targetType
    );
  });

  let newPayments: Payment[];
  if (index >= 0) {
    newPayments = [...payments];
    newPayments[index] = { ...newPayments[index], ...normalizedPayment };
  } else {
    newPayments = [normalizedPayment, ...payments];
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(newPayments));
  }
  notifyDataChange();
  return newPayments;
}

export function deleteLocalPayment(paymentId: string): Payment[] {
  const payments = getLocalPayments();
  const newPayments = payments.filter((p) => p.id !== paymentId);
  if (typeof window !== 'undefined') {
    localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(newPayments));
  }
  notifyDataChange();
  return newPayments;
}

// ==================== DOCUMENTS ====================
export function getLocalDocuments(): DocumentRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DOCUMENTS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveLocalDocument(doc: DocumentRecord): DocumentRecord[] {
  const docs = getLocalDocuments();
  const index = docs.findIndex((d) => d.id === doc.id);
  let newDocs: DocumentRecord[];
  if (index >= 0) {
    newDocs = [...docs];
    newDocs[index] = { ...newDocs[index], ...doc };
  } else {
    newDocs = [doc, ...docs];
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(newDocs));
  }
  notifyDataChange();
  return newDocs;
}

export function deleteLocalDocument(docId: string): DocumentRecord[] {
  const docs = getLocalDocuments();
  const newDocs = docs.filter((d) => d.id !== docId);
  if (typeof window !== 'undefined') {
    localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(newDocs));
  }
  notifyDataChange();
  return newDocs;
}

// ==================== LANDLORD PROFILE ====================
export function getLandlordProfile(): LandlordProfile {
  if (typeof window === 'undefined') return DEFAULT_LANDLORD_PROFILE;
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return DEFAULT_LANDLORD_PROFILE;
    const parsed = JSON.parse(raw);
    const cleaned: LandlordProfile = {
      name: parsed.name === 'Landlord / Property Owner' ? '' : (parsed.name || ''),
      phone: parsed.phone === '+91 98765 43210' ? '' : (parsed.phone || ''),
      email: parsed.email === 'owner@rentvault.com' ? '' : (parsed.email || ''),
      upiId: parsed.upiId === 'landlord@upi' ? '' : (parsed.upiId || ''),
      propertyName: parsed.propertyName || DEFAULT_LANDLORD_PROFILE.propertyName,
      address: parsed.address || DEFAULT_LANDLORD_PROFILE.address,
    };
    return cleaned;
  } catch {
    return DEFAULT_LANDLORD_PROFILE;
  }
}

export function saveLandlordProfile(profile: Partial<LandlordProfile>): LandlordProfile {
  const current = getLandlordProfile();
  const updated = { ...current, ...profile };
  if (typeof window !== 'undefined') {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('landlord_profile_updated'));
  }
  notifyDataChange();
  return updated;
}

// ==================== RENT CYCLE & MOVE-IN POLICY ====================

/**
 * Returns true if a tenant moved in during the given target month or in the future.
 * Under standard policy: If a tenant moved in this month, their monthly rent is taken next month.
 */
export function isTenantMoveInThisMonth(
  tenantOrMoveInDate?: Tenant | string | null,
  targetYearMonth?: string
): boolean {
  if (!tenantOrMoveInDate) return false;
  const moveInStr = typeof tenantOrMoveInDate === 'string'
    ? tenantOrMoveInDate
    : tenantOrMoveInDate.move_in_date;
  if (!moveInStr) return false;
  const moveInYM = moveInStr.slice(0, 7);
  const currentYM = targetYearMonth || new Date().toISOString().slice(0, 7);
  return moveInYM >= currentYM;
}

/**
 * Given a year-month string 'YYYY-MM', returns the subsequent month 'YYYY-MM'.
 */
export function getNextYearMonth(yearMonth?: string): string {
  const base = yearMonth && /^\d{4}-\d{2}$/.test(yearMonth)
    ? new Date(Number(yearMonth.slice(0, 4)), Number(yearMonth.slice(5, 7)) - 1, 1)
    : new Date();
  const nextDate = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  return `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Determines the default billing month for rent payments for a tenant.
 * If the tenant moved in during the current month (or future), their first rent
 * cycle starts next month. Otherwise, it defaults to the current month.
 */
export function getDefaultRentBillingMonth(tenant?: Tenant | null, currentYearMonth?: string): string {
  const currentYM = currentYearMonth || new Date().toISOString().slice(0, 7);
  if (!tenant?.move_in_date) return currentYM;
  if (isTenantMoveInThisMonth(tenant.move_in_date, currentYM)) {
    return getNextYearMonth(tenant.move_in_date.slice(0, 7));
  }
  return currentYM;
}

/**
 * Safely extracts standard 'YYYY-MM' from any payment record or date string.
 * Handles ISO dates ('2026-10-01'), human month names ('October 2026'),
 * and legacy records without timezone drift.
 */
export function getPaymentYearMonth(
  paymentOrDate?: Payment | { billing_period_month?: string; billing_month?: string; payment_date?: string } | string | null
): string {
  if (!paymentOrDate) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  let str = '';
  if (typeof paymentOrDate === 'string') {
    str = paymentOrDate.trim();
  } else {
    // Check billing_period_month first, then billing_month, then payment_date
    str = (paymentOrDate.billing_period_month || paymentOrDate.billing_month || paymentOrDate.payment_date || '').trim();
  }

  // 1. Direct YYYY-MM match (e.g. '2026-10' or '2026-10-01')
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    return `${y}-${m}`;
  }

  // 2. Human month string match (e.g. 'October 2026' or 'Oct 2026')
  const humanMatch = str.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (humanMatch) {
    const monthName = humanMatch[1].toLowerCase();
    const year = humanMatch[2];
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const idx = months.findIndex((m) => monthName.startsWith(m));
    if (idx >= 0) {
      return `${year}-${String(idx + 1).padStart(2, '0')}`;
    }
  }

  // 3. Fallback
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Accurately formats a payment's billing month for UI display (e.g., 'October 2026').
 * Completely eliminates ISO date strings ('2026-10-01') in the display and prevents
 * timezone off-by-one shifts.
 */
export function formatBillingMonth(
  paymentOrDate?: Payment | { billing_period_month?: string; billing_month?: string; payment_date?: string } | string | null
): string {
  if (!paymentOrDate) return 'Current';

  if (typeof paymentOrDate === 'object' && paymentOrDate !== null) {
    if (paymentOrDate.billing_month && /^[A-Za-z]+\s+\d{4}$/.test(paymentOrDate.billing_month.trim())) {
      return paymentOrDate.billing_month.trim();
    }
  }

  const ym = getPaymentYearMonth(paymentOrDate);
  const parts = ym.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return 'Current';
  }

  // Noon on 15th prevents any timezone day-boundary leap
  const safeDate = new Date(year, month - 1, 15, 12, 0, 0);
  return safeDate.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

// ==================== ADVANCE / SECURITY DEPOSIT TRACKING ====================

export interface AdvancePiece {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  installment_number: number;
  notes?: string | null;
  transaction_ref?: string | null;
}

export interface AdvanceTrackingSummary {
  agreedAdvance: number;
  totalPaid: number;
  remainingUnpaid: number;
  isFullyPaid: boolean;
  status: 'FULLY_PAID' | 'PARTIALLY_PAID' | 'UNPAID';
  piecesCount: number;
  pieces: AdvancePiece[];
  latestPaymentDate?: string | null;
}

/**
 * Computes the one-time advance / security deposit status for a tenant.
 * Determines whether advance was paid in full (Done), partially paid across pieces/dates,
 * or still unpaid, with complete itemization of each piece.
 */
export function getTenantAdvanceSummary(
  tenant: Tenant,
  room?: Room | null,
  allPayments?: Payment[]
): AdvanceTrackingSummary {
  const agreedAdvance = Number(tenant.security_deposit_paid || room?.security_deposit || 20000);
  const paymentsList = allPayments || getLocalPayments();
  
  const advancePayments = paymentsList
    .filter(
      (p) =>
        p.tenant_id === tenant.id &&
        p.payment_type === 'SECURITY_DEPOSIT' &&
        Number(p.amount_paid) > 0
    )
    .sort((a, b) => new Date(a.payment_date || a.created_at || '').getTime() - new Date(b.payment_date || b.created_at || '').getTime());

  const totalPaid = advancePayments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
  const remainingUnpaid = Math.max(0, agreedAdvance - totalPaid);
  const isFullyPaid = totalPaid >= agreedAdvance && agreedAdvance > 0;

  const status: 'FULLY_PAID' | 'PARTIALLY_PAID' | 'UNPAID' = 
    isFullyPaid 
      ? 'FULLY_PAID' 
      : totalPaid > 0 
        ? 'PARTIALLY_PAID' 
        : 'UNPAID';

  const pieces: AdvancePiece[] = advancePayments.map((p, idx) => ({
    id: p.id,
    amount: Number(p.amount_paid || 0),
    payment_date: p.payment_date || (p.created_at ? p.created_at.slice(0, 10) : 'Move-in'),
    payment_method: p.payment_method || 'UPI',
    installment_number: p.installment_number || idx + 1,
    notes: p.notes || null,
    transaction_ref: p.transaction_ref || null,
  }));

  const latestPaymentDate = pieces.length > 0 ? pieces[pieces.length - 1].payment_date : null;

  return {
    agreedAdvance,
    totalPaid,
    remainingUnpaid,
    isFullyPaid,
    status,
    piecesCount: pieces.length,
    pieces,
    latestPaymentDate,
  };
}
