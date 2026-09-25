'use client';

import React, { useState } from 'react';
import { X, Building2, IndianRupee, CheckCircle2, Save, Sparkles } from 'lucide-react';
import { Room, RoomStatus } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { saveLocalRoom } from '@/lib/store/app-store';

interface EditRoomModalProps {
  room: Room | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (updatedRoom: Room) => void;
  isNew?: boolean;
}

export default function EditRoomModal({ room, isOpen, onClose, onSaved, isNew = false }: EditRoomModalProps) {
  const [formData, setFormData] = useState(() => ({
    roomNumber: room?.room_number || '',
    floor: room?.floor ?? 1,
    baseRent: room?.base_rent !== undefined ? Number(room.base_rent) : 0,
    securityDeposit: room?.security_deposit !== undefined ? Number(room.security_deposit) : 0,
    status: (room?.status || 'VACANT') as RoomStatus,
    capacity: room?.capacity ?? 2,
    currentOccupancy: room?.current_occupancy ?? 0,
    canSomeoneGetIn: room?.can_someone_get_in ?? (room?.status === 'VACANT' || !room),
    notes: room?.notes || '',
  }));

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const generatedId = (room?.id && !room.id.startsWith('room-'))
      ? room.id
      : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `room-${Date.now()}`);

    const updatedRoom: Room = {
      id: room?.id || generatedId,
      room_number: formData.roomNumber.trim().toUpperCase(),
      floor: Number(formData.floor) || 0,
      base_rent: Math.max(0, Number(formData.baseRent) || 0),
      security_deposit: Math.max(0, Number(formData.securityDeposit) || 0),
      status: formData.status,
      capacity: Math.max(1, Number(formData.capacity) || 1),
      current_occupancy: Math.max(0, Number(formData.currentOccupancy) || 0),
      can_someone_get_in: Boolean(formData.canSomeoneGetIn),
      notes: formData.notes,
      updated_at: new Date().toISOString(),
      created_at: room?.created_at || new Date().toISOString(),
    };

    // 1. Save in local store for immediate UI update
    saveLocalRoom(updatedRoom);

    // 2. Sync to Supabase if available
    try {
      const supabase = createClient();
      if (isNew || !room?.id) {
        const { data: inserted } = await supabase
          .from('rooms')
          .insert({
            room_number: updatedRoom.room_number,
            floor: updatedRoom.floor,
            base_rent: updatedRoom.base_rent,
            security_deposit: updatedRoom.security_deposit,
            status: updatedRoom.status,
            capacity: updatedRoom.capacity,
            current_occupancy: updatedRoom.current_occupancy,
            can_someone_get_in: updatedRoom.can_someone_get_in,
            notes: updatedRoom.notes,
          })
          .select()
          .single();

        if (inserted?.id) {
          updatedRoom.id = inserted.id;
          saveLocalRoom(updatedRoom);
        }
      } else {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(room.id);
        const query = supabase.from('rooms').update({
          room_number: updatedRoom.room_number,
          floor: updatedRoom.floor,
          base_rent: updatedRoom.base_rent,
          security_deposit: updatedRoom.security_deposit,
          status: updatedRoom.status,
          capacity: updatedRoom.capacity,
          current_occupancy: updatedRoom.current_occupancy,
          can_someone_get_in: updatedRoom.can_someone_get_in,
          notes: updatedRoom.notes,
        });

        const { data: updated } = isUuid
          ? await query.eq('id', room.id).select().single()
          : await query.eq('room_number', room.room_number).select().single();

        if (updated?.id) {
          updatedRoom.id = updated.id;
          saveLocalRoom(updatedRoom);
        }
      }
    } catch (err) {
      console.warn('Supabase rooms sync note:', err);
    }

    setSaving(false);
    setSuccess(true);
    if (onSaved) onSaved(updatedRoom);

    setTimeout(() => {
      setSuccess(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white border border-slate-300 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                {isNew || !room ? 'Add New Room Unit' : `Edit Room Details: ${room.room_number}`}
              </h2>
              <p className="text-[11px] text-slate-300">
                {isNew ? 'Define unit number, floor, base rent & capacity' : 'Update rent, status & move-in availability'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Room details saved and updated!</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Room Number *</label>
              <input
                type="text"
                required
                value={formData.roomNumber}
                onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
                placeholder="e.g. G1, 2A, 2B, 3A, 3B, P1"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Floor Level *</label>
              <select
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: Number(e.target.value) })}
                className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
              >
                <option value={0}>Ground Floor (0)</option>
                <option value={1}>1st Floor (1)</option>
                <option value={2}>2nd Floor (2)</option>
                <option value={3}>3rd Floor (3)</option>
                <option value={4}>4th Floor / Penthouse (4)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                <IndianRupee className="w-3.5 h-3.5 text-indigo-600" />
                Base Rent (₹ / month) *
              </label>
              <input
                type="number"
                required
                value={formData.baseRent}
                onChange={(e) => setFormData({ ...formData, baseRent: Number(e.target.value) })}
                className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                <IndianRupee className="w-3.5 h-3.5 text-indigo-600" />
                Security Deposit (₹) *
              </label>
              <input
                type="number"
                required
                value={formData.securityDeposit}
                onChange={(e) => setFormData({ ...formData, securityDeposit: Number(e.target.value) })}
                className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
              />
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, securityDeposit: 0 })}
                  className={`px-2 py-0.5 text-[11px] font-bold rounded-md border transition-colors cursor-pointer ${
                    formData.securityDeposit === 0
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50'
                  }`}
                >
                  ⚡ ₹0 (No Deposit)
                </button>
                {formData.baseRent > 0 && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, securityDeposit: formData.baseRent })}
                    className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    1 Mo (₹{formData.baseRent.toLocaleString('en-IN')})
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Occupancy & Availability Configuration */}
          <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200/80 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                Occupancy & Move-in Chance Settings
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Room Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => {
                    const newStatus = e.target.value as RoomStatus;
                    setFormData({
                      ...formData,
                      status: newStatus,
                      canSomeoneGetIn: newStatus === 'VACANT' ? true : formData.canSomeoneGetIn,
                    });
                  }}
                  className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none"
                >
                  <option value="VACANT">VACANT (To-Let)</option>
                  <option value="OCCUPIED">OCCUPIED</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Max Member Capacity</label>
                <select
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                  className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none"
                >
                  <option value={1}>1 Member</option>
                  <option value={2}>2 Members</option>
                  <option value={3}>3 Members</option>
                  <option value={4}>4 Members</option>
                  <option value={5}>5 Members</option>
                  <option value={6}>6 Members</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Members Currently Staying</label>
                <input
                  type="number"
                  min={0}
                  max={formData.capacity}
                  value={formData.currentOccupancy}
                  onChange={(e) => {
                    const occ = Number(e.target.value);
                    setFormData({
                      ...formData,
                      currentOccupancy: occ,
                      canSomeoneGetIn: occ < formData.capacity,
                      status: occ > 0 ? 'OCCUPIED' : formData.status,
                    });
                  }}
                  className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none"
                />
              </div>
            </div>

            {/* Is there any chance for someone to get in? */}
            <div className="pt-2 border-t border-indigo-200/60 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  Any vacancy for someone to move in?
                </span>
                <p className="text-[11px] text-slate-600">
                  {formData.canSomeoneGetIn 
                    ? '🟢 Yes! Space available for new occupant to move in.' 
                    : '🔴 No. Room is fully occupied.'}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.canSomeoneGetIn}
                  onChange={(e) => setFormData({ ...formData, canSomeoneGetIn: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">Room Notes / Amenities</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
              placeholder="e.g. Attached bathroom, balcony, geyser installed, east facing..."
            />
          </div>

          {/* Controls */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save Room Details'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
