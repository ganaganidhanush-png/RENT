'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, Plus, Edit3, Users, 
  CheckCircle2, AlertCircle 
} from 'lucide-react';
import { Room } from '@/types/database';
import { DEFAULT_ROOMS } from '@/lib/constants/rooms';
import { getLocalRooms } from '@/lib/store/app-store';
import { createClient } from '@/lib/supabase/client';
import EditRoomModal from '@/components/rooms/edit-room-modal';

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>(DEFAULT_ROOMS);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    async function fetchRooms() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('rooms')
          .select('*')
          .order('floor', { ascending: true });

        if (!error && data && data.length > 0) {
          // Merge with DEFAULT_ROOMS to ensure G1, 2A, 2B, 3A, 3B, P1 all exist
          const merged = DEFAULT_ROOMS.map((def) => {
            const found = data.find((r) => r.room_number === def.room_number);
            return found || def;
          });
          setRooms(merged);
        } else {
          setRooms(getLocalRooms());
        }
      } catch {
        setRooms(getLocalRooms());
      }
    }

    fetchRooms();
  }, []);

  const handleEditClick = (room: Room) => {
    setEditingRoom(room);
    setIsEditModalOpen(true);
  };

  const handleRoomSaved = (updatedRoom: Room) => {
    setRooms((prev) =>
      prev.map((r) => (r.id === updatedRoom.id || r.room_number === updatedRoom.room_number ? updatedRoom : r))
    );
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
      const remaining = Math.max(1, (room.capacity || 2) - (room.current_occupancy || 1));
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-900 border border-indigo-300 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
          Bed Available ({remaining} Space to Get In!)
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
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Rental Units (6 Rooms)</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                G1, 2A, 2B, 3A, 3B, P1
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-600 mt-0.5">
              Live capacity tracking, vacancy status & option to edit room details
            </p>
          </div>
        </div>

        <Link
          href="/tenants/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all"
        >
          <Plus className="w-4 h-4" />
          Assign New Tenant
        </Link>
      </div>

      {/* 6 Rooms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms.map((room) => {
          const capacity = room.capacity || 2;
          const occupants = room.current_occupancy || 0;
          const hasSpace = room.can_someone_get_in ?? (room.status === 'VACANT' || occupants < capacity);

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

                {/* Occupancy & Sharing Details */}
                <div className="space-y-2 mb-3 text-xs">
                  <div className="flex items-center justify-between font-semibold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-indigo-600" />
                      Sharing / Bed Capacity:
                    </span>
                    <span className="font-bold text-slate-900">
                      {occupants} of {capacity} Occupied
                    </span>
                  </div>

                  {/* Progress bar of beds */}
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        occupants === 0
                          ? 'bg-emerald-500 w-0'
                          : occupants >= capacity
                          ? 'bg-slate-600 w-full'
                          : 'bg-indigo-600 w-1/2'
                      }`}
                      style={{ width: `${Math.min(100, (occupants / capacity) * 100)}%` }}
                    />
                  </div>

                  {/* Chance for someone to get in indicator */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-semibold">Any chance to get in?</span>
                    <span className={`font-bold flex items-center gap-1 ${hasSpace ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {hasSpace ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Yes, Bed Open
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 text-slate-400" /> Full / None
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {room.notes ? (
                  <p className="text-xs font-medium text-slate-600 line-clamp-2 leading-relaxed italic">
                    {room.notes}
                  </p>
                ) : null}
              </div>

              {/* Actions Footer */}
              <div className="mt-5 pt-3 border-t border-slate-200 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleEditClick(room)}
                  className="flex-1 text-center py-2 px-3 text-xs font-bold text-slate-700 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Edit Details
                </button>

                {hasSpace ? (
                  <Link
                    href={`/tenants/new?room_id=${room.id}`}
                    className="flex-1 text-center py-2 px-3 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
                  >
                    + Add Occupant
                  </Link>
                ) : (
                  <Link
                    href="/tenants"
                    className="flex-1 text-center py-2 px-3 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    View Tenants →
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
    </div>
  );
}
