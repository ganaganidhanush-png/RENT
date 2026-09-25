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
  propertyName: 'RentVault (6 Units)',
  address: 'G1, 2A, 2B, 3A, 3B, P1',
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

export function saveLocalTenant(tenant: Tenant): Tenant[] {
  const tenants = getLocalTenants();
  const index = tenants.findIndex((t) => t.id === tenant.id);
  let newTenants: Tenant[];

  // If room changed, handle freeing up the old room
  if (index >= 0 && tenants[index].room_id && tenants[index].room_id !== tenant.room_id) {
    const oldRoomId = tenants[index].room_id;
    const remainingInOld = tenants.filter((t) => t.room_id === oldRoomId && t.id !== tenant.id && t.status === 'ACTIVE');
    if (remainingInOld.length === 0) {
      const rooms = getLocalRooms();
      const oldRoom = rooms.find((r) => r.id === oldRoomId);
      if (oldRoom) {
        saveLocalRoom({
          ...oldRoom,
          status: 'VACANT',
          current_occupancy: 0,
          can_someone_get_in: true,
        });
      }
    }
  }

  if (index >= 0) {
    newTenants = [...tenants];
    newTenants[index] = { ...newTenants[index], ...tenant, updated_at: new Date().toISOString() };
  } else {
    newTenants = [tenant, ...tenants];
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem(TENANTS_STORAGE_KEY, JSON.stringify(newTenants));
  }

  // Update new room occupancy automatically
  if (tenant.room_id) {
    const rooms = getLocalRooms();
    const targetRoom = rooms.find((r) => r.id === tenant.room_id);
    if (targetRoom) {
      if (tenant.status !== 'ACTIVE') {
        const remainingActive = newTenants.filter((t) => t.room_id === tenant.room_id && t.id !== tenant.id && t.status === 'ACTIVE');
        if (remainingActive.length === 0) {
          saveLocalRoom({
            ...targetRoom,
            status: 'VACANT',
            current_occupancy: 0,
            can_someone_get_in: true,
          });
        }
      } else {
        const occupantsCount = tenant.tenant_type === 'BACHELORS' && tenant.occupants
          ? tenant.occupants.length
          : (tenant.family_members_count || 1);

        const capacity = targetRoom.capacity || 2;
        const canGetIn = occupantsCount < capacity;

        saveLocalRoom({
          ...targetRoom,
          status: 'OCCUPIED',
          current_occupancy: occupantsCount,
          can_someone_get_in: canGetIn,
        });
      }
    }
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

  // Free up room when tenant is deleted
  if (toDelete?.room_id) {
    const rooms = getLocalRooms();
    const targetRoom = rooms.find((r) => r.id === toDelete.room_id);
    if (targetRoom) {
      saveLocalRoom({
        ...targetRoom,
        status: 'VACANT',
        current_occupancy: 0,
        can_someone_get_in: true,
      });
    }
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
  const index = payments.findIndex((p) => p.id === payment.id);
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
      propertyName: parsed.propertyName || 'RentVault (6 Units)',
      address: parsed.address || 'G1, 2A, 2B, 3A, 3B, P1',
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
