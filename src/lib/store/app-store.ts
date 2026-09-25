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
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveLocalPayment(payment: Payment): Payment[] {
  const payments = getLocalPayments();
  const targetMonth = (payment.billing_period_month || '').slice(0, 7);
  const targetType = payment.payment_type || 'RENT';
  const index = payments.findIndex((p) => {
    // 1. Direct match by ID
    if (p.id === payment.id) return true;
    
    // 2. Only replace if the existing record was an unfulfilled placeholder with zero payment
    const pMonth = (p.billing_period_month || '').slice(0, 7);
    const pType = p.payment_type || 'RENT';
    const isUnpaidPlaceholder = p.amount_paid === 0 && p.payment_status === 'PENDING';
    
    return Boolean(
      isUnpaidPlaceholder &&
      p.tenant_id &&
      p.tenant_id === payment.tenant_id &&
      targetMonth &&
      pMonth === targetMonth &&
      pType === targetType
    );
  });
  let newPayments: Payment[];
  if (index >= 0) {
    newPayments = [...payments];
    newPayments[index] = { ...newPayments[index], ...payment, updated_at: new Date().toISOString() };
  } else {
    newPayments = [payment, ...payments];
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
