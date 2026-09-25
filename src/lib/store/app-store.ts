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
  const targetRoom = rooms.find((r) => r.id === roomId);
  if (!targetRoom) return;

  // Active occupants (ACTIVE or NOTICE_PERIOD are still occupying beds)
  const activeTenants = tenants.filter(
    (t) => t.room_id === roomId && (t.status === 'ACTIVE' || t.status === 'NOTICE_PERIOD')
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

  saveLocalRoom({
    ...targetRoom,
    status: newStatus,
    current_occupancy: totalOccupants,
    can_someone_get_in: canSomeoneGetIn,
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
  const index = payments.findIndex((p) => {
    if (p.id === payment.id) return true;
    const pMonth = (p.billing_period_month || '').slice(0, 7);
    return Boolean(p.tenant_id && p.tenant_id === payment.tenant_id && targetMonth && pMonth === targetMonth);
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
