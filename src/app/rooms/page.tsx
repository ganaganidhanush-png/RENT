'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, Plus, Edit3, Users, 
  CheckCircle2, AlertCircle, CreditCard, GraduationCap 
} from 'lucide-react';
import { Room, Tenant, Payment } from '@/types/database';
import { DEFAULT_ROOMS } from '@/lib/constants/rooms';
import { getLocalRooms, getLocalTenants } from '@/lib/store/app-store';
import { createClient } from '@/lib/supabase/client';
import EditRoomModal from '@/components/rooms/edit-room-modal';
import EditTenantModal from '@/components/tenants/edit-tenant-modal';
import RecordPaymentModal from '@/components/payments/record-payment-modal';

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>(DEFAULT_ROOMS);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddRoomModalOpen, setIsAddRoomModalOpen] = useState(false);

  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [isTenantModalOpen, setIsTenantModalOpen] = useState(false);

  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      const localRooms = getLocalRooms();
      setRooms(localRooms);
      setTenants(getLocalTenants());

      try {
        const supabase = createClient();
        const [{ data: roomsData }, { data: tenantsData }] = await Promise.all([
          supabase.from('rooms').select('*').order('floor', { ascending: true }).order('room_number'),
          supabase.from('tenants').select('*, room:rooms(*)').order('created_at', { ascending: false })
        ]);

        if (roomsData && roomsData.length > 0) {
          setRooms(roomsData);
        } else if (localRooms && localRooms.length > 0) {
          setRooms(localRooms);
        }

        if (tenantsData && tenantsData.length > 0) {
          setTenants(tenantsData);
        }
      } catch (err) {
        console.warn('Rooms/Tenants fetch note:', err);
      }
    }

    loadData();

    const handleDataChange = () => {
      setRooms(getLocalRooms());
      setTenants(getLocalTenants());
    };

    window.addEventListener('rentvault_data_updated', handleDataChange);
    return () => window.removeEventListener('rentvault_data_updated', handleDataChange);
  }, []);

  const handleEditClick = (room: Room) => {
    setEditingRoom(room);
    setIsEditModalOpen(true);
  };

  const handleRoomSaved = (updatedRoom: Room) => {
    setRooms((prev) => {
      const exists = prev.some((r) => r.id === updatedRoom.id || r.room_number === updatedRoom.room_number);
      if (exists) {
        return prev.map((r) => (r.id === updatedRoom.id || r.room_number === updatedRoom.room_number ? updatedRoom : r));
      }
      return [...prev, updatedRoom];
    });
  };

  const getMoveInBadge = (room: Room) => {
    if (room.status === 'MAINTENANCE') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          Under Maintenance
        </span>
      );
    }

    if (room.status === 'VACANT' || room.current_occupancy === 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Empty / Ready for Move-In
        </span>
      );
    }

    if (room.can_someone_get_in) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-900 border border-indigo-300 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
          Vacancy Available (Space to Move In)
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300">
        <span className="w-2 h-2 rounded-full bg-slate-500"></span>
        Fully Occupied (No Vacancy)
      </span>
    );
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-300 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Rental Units</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                {rooms.length} Units Active
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-600 mt-0.5">
              Live capacity tracking, vacancy status & option to add or edit room details
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAddRoomModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Room Unit
          </button>

          <Link
            href="/tenants/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            Assign New Tenant
          </Link>
        </div>
      </div>

      {/* 6 Rooms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms.map((room) => {
          const roomTenants = tenants.filter(
            (t) => (t.room_id === room.id || (t.room && t.room.room_number === room.room_number)) && t.status !== 'MOVED_OUT'
          );
          // Count actual members staying in room (not by bed)
          const membersStaying = roomTenants.reduce((sum, t) => {
            if (t.tenant_type === 'BACHELORS') {
              return sum + (t.occupants && t.occupants.length > 0 ? t.occupants.length : 1);
            }
            return sum + (t.family_members_count || 2);
          }, 0);

          const maxCapacity = room.capacity || 2;
          const hasSpace = room.can_someone_get_in ?? (room.status === 'VACANT' || membersStaying < maxCapacity);

          return (
            <div
              key={room.id}
              className="bg-white border-2 border-slate-200 rounded-2xl p-5 shadow-sm hover:border-indigo-400 hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Top Row: Room Number & Move-in status */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-black text-slate-900 tracking-tight">
                        Room {room.room_number}
                      </span>
                      <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        {room.floor === 0 ? 'Ground Floor' : room.floor === 4 ? 'Penthouse (4th)' : `Floor ${room.floor}`}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleEditClick(room)}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 transition-colors cursor-pointer"
                    title="Edit room profile & details"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>

                {/* Move-in / Vacancy Status Banner */}
                <div className="mb-4">{getMoveInBadge(room)}</div>

                {/* Pricing & Terms */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600">Base Rent:</span>
                    <span className="text-sm font-black text-slate-900">
                      ₹{Number(room.base_rent).toLocaleString('en-IN')}{' '}
                      <span className="text-xs font-semibold text-slate-500">/mo</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600">Security Deposit:</span>
                    <span className="text-xs font-bold text-slate-800">
                      ₹{Number(room.security_deposit).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Occupancy & Member Details */}
                <div className="space-y-2 mb-3 text-xs">
                  <div className="flex items-center justify-between font-semibold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-indigo-600" />
                      Members Staying in Room:
                    </span>
                    <span className="font-bold text-slate-900">
                      {membersStaying} of {maxCapacity} Members
                    </span>
                  </div>

                  {/* Progress bar of members */}
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        membersStaying === 0
                          ? 'bg-emerald-500 w-0'
                          : membersStaying >= maxCapacity
                          ? 'bg-slate-600 w-full'
                          : 'bg-indigo-600'
                      }`}
                      style={{ width: `${Math.min(100, (membersStaying / maxCapacity) * 100)}%` }}
                    />
                  </div>

                  {/* Chance for someone to get in indicator */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-semibold">Any vacancy to move in?</span>
                    <span className={`font-bold flex items-center gap-1 ${hasSpace ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {hasSpace ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Yes, Space Open
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 text-slate-400" /> Fully Occupied
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Assigned Tenant / Occupants Info if occupied */}
                {(() => {
                  const roomTenants = tenants.filter(
                    (t) => (t.room_id === room.id || (t.room && t.room.room_number === room.room_number)) && t.status !== 'MOVED_OUT'
                  );
                  const primaryTenant = roomTenants[0];

                  if (primaryTenant) {
                    return (
                      <div className="mt-3 p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1">
                            {primaryTenant.tenant_type === 'BACHELORS' ? (
                              <GraduationCap className="w-3.5 h-3.5 text-purple-700" />
                            ) : (
                              <Users className="w-3.5 h-3.5 text-blue-700" />
                            )}
                            {primaryTenant.tenant_type === 'BACHELORS' ? 'Bachelors' : 'Family'} Occupant:
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTenant(primaryTenant);
                              setIsTenantModalOpen(true);
                            }}
                            className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" /> Edit
                          </button>
                        </div>
                        <p className="text-xs font-bold text-slate-900">
                          {roomTenants.map((t) => t.full_name).join(', ')}
                        </p>
                        <p className="text-[11px] text-slate-600 font-medium">
                          Phone: {primaryTenant.phone} • Rent: ₹{Number(primaryTenant.monthly_rent || room.base_rent).toLocaleString('en-IN')}/mo
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}

                {room.notes ? (
                  <p className="text-xs font-medium text-slate-600 line-clamp-2 leading-relaxed italic mt-2">
                    {room.notes}
                  </p>
                ) : null}
              </div>

              {/* Actions Footer */}
              {(() => {
                const roomTenants = tenants.filter(
                  (t) => t.room_id === room.id || (t.room && t.room.room_number === room.room_number)
                );
                const primaryTenant = roomTenants[0];

                return (
                  <div className="mt-5 pt-3 border-t border-slate-200 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditClick(room)}
                      className="flex-1 min-w-[90px] text-center py-2 px-2.5 text-xs font-bold text-slate-700 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      Edit Room
                    </button>

                    {primaryTenant ? (
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          const currentMonthIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
                          const monthStr = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
                          setEditingPayment({
                            id: `pay-${Date.now()}`,
                            tenant_id: primaryTenant.id,
                            room_id: room.id,
                            billing_period_month: currentMonthIso,
                            billing_month: monthStr,
                            amount_due: Number(primaryTenant.monthly_rent || room.base_rent),
                            amount_paid: Number(primaryTenant.monthly_rent || room.base_rent),
                            amount_pending: 0,
                            payment_status: 'PAID',
                            payment_date: new Date().toISOString().split('T')[0],
                            payment_method: 'UPI',
                            received_by: 'LANDLORD',
                            created_at: new Date().toISOString(),
                            tenant: primaryTenant,
                            room: room,
                          });
                          setIsPaymentModalOpen(true);
                        }}
                        className="flex-1 min-w-[100px] text-center py-2 px-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1"
                        title="Record rent payment for this unit"
                      >
                        <CreditCard className="w-3.5 h-3.5" /> Record Rent
                      </button>
                    ) : null}

                    {hasSpace ? (
                      <Link
                        href={`/tenants/new?room_id=${room.id}`}
                        className="flex-1 min-w-[100px] text-center py-2 px-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
                      >
                        + Add Occupant
                      </Link>
                    ) : (
                      <Link
                        href="/tenants"
                        className="flex-1 min-w-[90px] text-center py-2 px-2.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                      >
                        Tenants →
                      </Link>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Add New Room Unit Modal */}
      {isAddRoomModalOpen && (
        <EditRoomModal
          room={null}
          isNew={true}
          isOpen={isAddRoomModalOpen}
          onClose={() => setIsAddRoomModalOpen(false)}
          onSaved={(newRoom) => {
            handleRoomSaved(newRoom);
            setIsAddRoomModalOpen(false);
          }}
        />
      )}

      {/* Edit Room Modal */}
      {isEditModalOpen && editingRoom && (
        <EditRoomModal
          room={editingRoom}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingRoom(null);
          }}
          onSaved={handleRoomSaved}
        />
      )}

      {/* Edit Tenant Modal */}
      {isTenantModalOpen && editingTenant && (
        <EditTenantModal
          tenant={editingTenant}
          rooms={rooms}
          isOpen={isTenantModalOpen}
          onClose={() => {
            setIsTenantModalOpen(false);
            setEditingTenant(null);
          }}
          onSaved={(updated) => {
            setTenants((prev) =>
              prev.map((t) => (t.id === updated.id ? updated : t))
            );
          }}
        />
      )}

      {/* Record Payment Modal */}
      {isPaymentModalOpen && (
        <RecordPaymentModal
          payment={editingPayment}
          tenants={tenants}
          rooms={rooms}
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setEditingPayment(null);
          }}
          onSaved={() => {
            // Updated payments will propagate via rentvault_data_updated event
          }}
        />
      )}
    </div>
  );
}
