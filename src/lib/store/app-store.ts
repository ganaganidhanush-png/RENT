import { Room, Tenant } from '@/types/database';
import { DEFAULT_ROOMS } from '@/lib/constants/rooms';

const ROOMS_STORAGE_KEY = 'rentvault_rooms_data';
const TENANTS_STORAGE_KEY = 'rentvault_tenants_data';
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

// Client-side local persistence utilities
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
  return newRooms;
}

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
  if (index >= 0) {
    newTenants = [...tenants];
    newTenants[index] = { ...newTenants[index], ...tenant, updated_at: new Date().toISOString() };
  } else {
    newTenants = [tenant, ...tenants];
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem(TENANTS_STORAGE_KEY, JSON.stringify(newTenants));
  }

  // Update room occupancy automatically
  if (tenant.room_id) {
    const rooms = getLocalRooms();
    const targetRoom = rooms.find((r) => r.id === tenant.room_id);
    if (targetRoom) {
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

  return newTenants;
}

export function deleteLocalTenant(tenantId: string): Tenant[] {
  const tenants = getLocalTenants();
  const toDelete = tenants.find((t) => t.id === tenantId);
  const newTenants = tenants.filter((t) => t.id !== tenantId);
  if (typeof window !== 'undefined') {
    localStorage.setItem(TENANTS_STORAGE_KEY, JSON.stringify(newTenants));
  }

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

  return newTenants;
}

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
  return updated;
}
