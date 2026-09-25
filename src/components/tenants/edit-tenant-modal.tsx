'use client';

import React, { useState } from 'react';
import { 
  X, User, GraduationCap, Plus, Trash2, 
  IndianRupee, Save, CheckCircle2, Building2, Users
} from 'lucide-react';
import { Tenant, Room, BachelorOccupant, TenantType, TenantStatus } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { saveLocalTenant, getLocalRooms, syncLocalRoomOccupancy } from '@/lib/store/app-store';

interface EditTenantModalProps {
  tenant: Tenant | null;
  rooms?: Room[];
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (updatedTenant: Tenant) => void;
}

export default function EditTenantModal(props: EditTenantModalProps) {
  if (!props.isOpen || !props.tenant) return null;
  return <EditTenantModalContent {...props} tenant={props.tenant} />;
}

function EditTenantModalContent({
  tenant,
  rooms: propRooms,
  onClose,
  onSaved,
}: {
  tenant: Tenant;
  rooms?: Room[];
  onClose: () => void;
  onSaved?: (updatedTenant: Tenant) => void;
}) {
  const [rooms] = useState<Room[]>(() => 
    propRooms && propRooms.length > 0 ? propRooms : getLocalRooms()
  );

  const [tenantType, setTenantType] = useState<TenantType>(() => tenant.tenant_type || 'BACHELORS');
  const [status, setStatus] = useState<TenantStatus>(() => tenant.status || 'ACTIVE');
  const [fullName, setFullName] = useState(() => tenant.full_name || '');
  const [phone, setPhone] = useState(() => tenant.phone || '');
  const [email, setEmail] = useState(() => tenant.email || '');
  const [roomId, setRoomId] = useState(() => tenant.room_id || '');
  const [monthlyRent, setMonthlyRent] = useState(() => String(tenant.monthly_rent || ''));
  const [securityDeposit, setSecurityDeposit] = useState(() => String(tenant.security_deposit_paid || ''));
  const [moveInDate, setMoveInDate] = useState(() => tenant.move_in_date || '');
  const [leaseEndDate, setLeaseEndDate] = useState(() => tenant.lease_end_date || '');
  const [rentDueDay, setRentDueDay] = useState<number>(() => tenant.rent_due_day || 5);
  const [actualMoveOutDate, setActualMoveOutDate] = useState(() => tenant.actual_move_out_date || '');
  const [emergencyName, setEmergencyName] = useState(() => tenant.emergency_contact_name || '');
  const [emergencyPhone, setEmergencyPhone] = useState(() => tenant.emergency_contact_phone || '');
  const [emergencyRelation, setEmergencyRelation] = useState(() => tenant.emergency_contact_relation || 'Parent');

  // Bachelors Occupants list
  const [occupants, setOccupants] = useState<BachelorOccupant[]>(() => {
    if (tenant.occupants && tenant.occupants.length > 0) {
      return tenant.occupants;
    }
    return [
      {
        name: tenant.full_name || '',
        phone: tenant.phone || '',
        occupation: tenant.primary_occupation || 'College Student',
        organization: tenant.college_or_company || '',
        role_or_course: '',
        aadhar_number: '',
      },
    ];
  });

  // Family fields
  const [familyMembersCount, setFamilyMembersCount] = useState(() => tenant.family_members_count || 2);
  const [primaryOccupation, setPrimaryOccupation] = useState(() => tenant.primary_occupation || '');

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleMemberCountChange = (count: number) => {
    const target = Math.max(1, Math.min(10, count));
    if (tenantType === 'BACHELORS') {
      const current = [...occupants];
      if (target > current.length) {
        const added: BachelorOccupant[] = Array.from(
          { length: target - current.length },
          () => ({
            name: '',
            phone: '',
            occupation: 'College Student',
            organization: '',
            role_or_course: '',
            aadhar_number: '',
          })
        );
        setOccupants([...current, ...added]);
      } else if (target < current.length) {
        setOccupants(current.slice(0, target));
      }
    } else {
      setFamilyMembersCount(target);
    }
  };

  const handleAddOccupant = () => {
    handleMemberCountChange(occupants.length + 1);
  };

  const handleRemoveOccupant = (index: number) => {
    if (occupants.length <= 1) return;
    const updated = occupants.filter((_, i) => i !== index);
    setOccupants(updated);
    if (index === 0 && updated.length > 0) {
      setFullName(updated[0].name);
      setPhone(updated[0].phone);
    }
  };

  const handleOccupantChange = (index: number, field: keyof BachelorOccupant, val: string) => {
    const updated = [...occupants];
    updated[index] = { ...updated[index], [field]: val };
    setOccupants(updated);
    if (index === 0) {
      if (field === 'name') setFullName(val);
      if (field === 'phone') setPhone(val);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const selectedRoom = rooms.find((r) => r.id === roomId);
    const isBachelors = tenantType === 'BACHELORS';
    const primaryName = (isBachelors ? (occupants[0]?.name || fullName) : fullName).trim();
    const primaryPhone = (isBachelors ? (occupants[0]?.phone || phone) : phone).trim();

    const updatedTenant: Tenant = {
      ...tenant,
      full_name: primaryName,
      phone: primaryPhone,
      email: email || null,
      tenant_type: tenantType,
      room_id: roomId || null,
      monthly_rent: Math.max(0, Number(monthlyRent) || 0),
      security_deposit_paid: Math.max(0, Number(securityDeposit) || 0),
      rent_due_day: Math.max(1, Math.min(31, Number(rentDueDay || 5))),
      move_in_date: moveInDate,
      lease_end_date: leaseEndDate,
      actual_move_out_date: status === 'MOVED_OUT' ? (actualMoveOutDate || new Date().toISOString().split('T')[0]) : null,
      status,
      emergency_contact_name: emergencyName,
      emergency_contact_phone: emergencyPhone,
      emergency_contact_relation: emergencyRelation,
      occupants: isBachelors ? occupants : null,
      family_members_count: isBachelors ? occupants.length : Number(familyMembersCount),
      primary_occupation: isBachelors ? (occupants[0]?.occupation || null) : primaryOccupation,
      college_or_company: isBachelors ? (occupants[0]?.organization || null) : null,
      room: selectedRoom,
      updated_at: new Date().toISOString(),
    };

    // 1. Local update
    saveLocalTenant(updatedTenant);

    // 2. Supabase sync
    try {
      const supabase = createClient();
      await supabase
        .from('tenants')
        .update({
          full_name: updatedTenant.full_name,
          phone: updatedTenant.phone,
          email: updatedTenant.email,
          tenant_type: updatedTenant.tenant_type,
          room_id: updatedTenant.room_id,
          monthly_rent: updatedTenant.monthly_rent,
          security_deposit_paid: updatedTenant.security_deposit_paid,
          rent_due_day: updatedTenant.rent_due_day,
          move_in_date: updatedTenant.move_in_date,
          lease_end_date: updatedTenant.lease_end_date,
          actual_move_out_date: updatedTenant.actual_move_out_date,
          status: updatedTenant.status,
          emergency_contact_name: updatedTenant.emergency_contact_name,
          emergency_contact_phone: updatedTenant.emergency_contact_phone,
          emergency_contact_relation: updatedTenant.emergency_contact_relation,
          occupants: updatedTenant.occupants,
          family_members_count: updatedTenant.family_members_count,
          primary_occupation: updatedTenant.primary_occupation,
          college_or_company: updatedTenant.college_or_company,
        })
        .eq('id', tenant.id);

      // Smartly sync room status and occupancy in Supabase
      if (updatedTenant.room_id) {
        syncLocalRoomOccupancy(updatedTenant.room_id);
      }
      if (tenant.room_id && tenant.room_id !== updatedTenant.room_id) {
        syncLocalRoomOccupancy(tenant.room_id);
      }
    } catch (err) {
      console.warn('Supabase tenant update note:', err);
    }

    setSaving(false);
    setSuccess(true);
    if (onSaved) onSaved(updatedTenant);

    setTimeout(() => {
      setSuccess(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white border border-slate-300 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Edit Tenant Details: {tenant.full_name}</h2>
              <p className="text-[11px] text-slate-300">
                Update category (Bachelors / Family), roommates, rent & lease
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
              <span>Tenant profile and roommate details updated successfully!</span>
            </div>
          )}

          {/* Tenant Type Switch */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">Tenant Category</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTenantType('BACHELORS')}
                className={`p-3 rounded-xl border-2 flex items-center gap-2.5 transition-all cursor-pointer ${
                  tenantType === 'BACHELORS'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${tenantType === 'BACHELORS' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold">Bachelors</div>
                  <div className="text-[10px] text-slate-500">College students & working professionals</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTenantType('FAMILY')}
                className={`p-3 rounded-xl border-2 flex items-center gap-2.5 transition-all cursor-pointer ${
                  tenantType === 'FAMILY'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${tenantType === 'FAMILY' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <Users className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold">Family</div>
                  <div className="text-[10px] text-slate-500">Family household unit</div>
                </div>
              </button>
            </div>
          </div>

          {/* Primary Contact Person */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Lead Contact Name *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter full legal name"
                className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Contact Phone *</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter 10-digit mobile number"
                className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email address"
                className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          {/* If BACHELORS: Dynamic Individual Details for each bachelor occupant */}
          {tenantType === 'BACHELORS' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-indigo-600" />
                    Bachelor Roommates ({occupants.length} Members in Room)
                  </h3>
                  <p className="text-[11px] text-slate-600">College / Job information for every person in this room</p>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-700">Members:</span>
                  <div className="inline-flex rounded-lg border border-slate-300 p-0.5 bg-slate-100">
                    {[1, 2, 3, 4, 5, 6].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleMemberCountChange(num)}
                        className={`px-2 py-0.5 text-xs font-bold rounded transition-all cursor-pointer ${
                          occupants.length === num
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {occupants.map((occ, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-3">
                    <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                      <span className="text-xs font-bold text-indigo-900">
                        {idx === 0 ? 'Member #1 (Lead / Primary Tenant)' : `Member #${idx + 1} (Roommate)`}
                        {occ.name ? ` • ${occ.name}` : ''}
                      </span>
                      {occupants.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOccupant(idx)}
                          className="text-rose-600 hover:text-rose-800 text-xs flex items-center gap-1 font-semibold cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Name *</label>
                        <input
                          type="text"
                          required
                          value={occ.name}
                          onChange={(e) => handleOccupantChange(idx, 'name', e.target.value)}
                          placeholder="Enter occupant name"
                          className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Phone Number</label>
                        <input
                          type="tel"
                          value={occ.phone}
                          onChange={(e) => handleOccupantChange(idx, 'phone', e.target.value)}
                          placeholder="Enter phone number"
                          className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">What do they do? *</label>
                        <select
                          value={occ.occupation}
                          onChange={(e) => handleOccupantChange(idx, 'occupation', e.target.value)}
                          className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none"
                        >
                          <option value="College Student">College Student</option>
                          <option value="Working Professional">Working Professional / Job</option>
                          <option value="Competitive Exam Aspirant">Competitive Exam Aspirant</option>
                          <option value="Intern">Intern / Trainee</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">College or Company *</label>
                        <input
                          type="text"
                          required
                          value={occ.organization}
                          onChange={(e) => handleOccupantChange(idx, 'organization', e.target.value)}
                          placeholder="Enter college or company name"
                          className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Course or Role</label>
                        <input
                          type="text"
                          value={occ.role_or_course || ''}
                          onChange={(e) => handleOccupantChange(idx, 'role_or_course', e.target.value)}
                          placeholder="e.g. Course, branch, or designation"
                          className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Aadhar / ID Number</label>
                        <input
                          type="text"
                          value={occ.aadhar_number || ''}
                          onChange={(e) => handleOccupantChange(idx, 'aadhar_number', e.target.value)}
                          placeholder="12-digit Aadhar"
                          className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleAddOccupant}
                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> + Add Another Bachelor Member
                </button>
              </div>
            </div>
          )}

          {/* If FAMILY: Family info */}
          {tenantType === 'FAMILY' && (
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <div>
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-indigo-600" />
                    Family Household ({familyMembersCount} Members in Room)
                  </span>
                  <p className="text-[11px] text-slate-600">
                    For family, only 1 primary person and emergency details are collected.
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-700">Members:</span>
                  <div className="inline-flex rounded-lg border border-slate-300 p-0.5 bg-slate-100">
                    {[1, 2, 3, 4, 5, 6].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleMemberCountChange(num)}
                        className={`px-2 py-0.5 text-xs font-bold rounded transition-all cursor-pointer ${
                          familyMembersCount === num
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Total Family Members Staying</label>
                  <input
                    type="number"
                    min={1}
                    value={familyMembersCount}
                    onChange={(e) => setFamilyMembersCount(Number(e.target.value))}
                    className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Primary Earner&apos;s Occupation</label>
                  <input
                    type="text"
                    value={primaryOccupation}
                    onChange={(e) => setPrimaryOccupation(e.target.value)}
                    placeholder="Enter occupation (e.g. Business, Salaried)"
                    className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Room Assignment & Financials */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" /> Assigned Room *
              </label>
              <select
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                required
                className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none"
              >
                <option value="">-- Select Room --</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    Room {r.room_number} (Floor {r.floor} • ₹{r.base_rent}/mo)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                <IndianRupee className="w-3.5 h-3.5 text-indigo-600" /> Monthly Rent (₹) *
              </label>
              <input
                type="number"
                required
                value={monthlyRent}
                onChange={(e) => setMonthlyRent(e.target.value)}
                className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                <IndianRupee className="w-3.5 h-3.5 text-indigo-600" /> Security Deposit (₹) *
              </label>
              <input
                type="number"
                required
                value={securityDeposit}
                onChange={(e) => setSecurityDeposit(e.target.value)}
                className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none"
              />
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSecurityDeposit('0')}
                  className={`px-2 py-0.5 text-[11px] font-bold rounded-md border transition-colors cursor-pointer ${
                    securityDeposit === '0'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50'
                  }`}
                >
                  ⚡ ₹0 (Zero Advance)
                </button>
                {monthlyRent && Number(monthlyRent) > 0 && (
                  <button
                    type="button"
                    onClick={() => setSecurityDeposit(String(Number(monthlyRent)))}
                    className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    1 Mo Rent (₹{Number(monthlyRent).toLocaleString('en-IN')})
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Monthly Rent Due Date */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>Monthly Rent Due Day *</span>
                <span className="text-[11px] font-semibold text-slate-500">(Day of every month when rent is expected)</span>
              </label>
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                {rentDueDay}{rentDueDay === 1 ? 'st' : rentDueDay === 2 ? 'nd' : rentDueDay === 3 ? 'rd' : 'th'} of every month
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={31}
                value={rentDueDay}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) setRentDueDay(Math.max(1, Math.min(31, val)));
                }}
                required
                className="w-20 text-xs font-bold border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none"
              />
              <div className="flex flex-wrap gap-1">
                {[1, 5, 10, 15].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setRentDueDay(d)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      rentDueDay === d
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {d}{d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Lease & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Move-In Date</label>
              <input
                type="date"
                value={moveInDate}
                onChange={(e) => setMoveInDate(e.target.value)}
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Lease End Date</label>
              <input
                type="date"
                value={leaseEndDate}
                onChange={(e) => setLeaseEndDate(e.target.value)}
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Tenancy Status</label>
              <select
                value={status}
                onChange={(e) => {
                  const newStatus = e.target.value as TenantStatus;
                  setStatus(newStatus);
                  if (newStatus === 'MOVED_OUT' && !actualMoveOutDate) {
                    setActualMoveOutDate(new Date().toISOString().split('T')[0]);
                  }
                }}
                className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none"
              >
                <option value="ACTIVE">ACTIVE (Currently Living)</option>
                <option value="NOTICE_PERIOD">NOTICE PERIOD (Vacating soon)</option>
                <option value="MOVED_OUT">MOVED OUT (Vacated)</option>
              </select>
            </div>

            {status === 'MOVED_OUT' && (
              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-amber-900 mb-1">Actual Move-Out Date</label>
                <input
                  type="date"
                  value={actualMoveOutDate}
                  onChange={(e) => setActualMoveOutDate(e.target.value)}
                  className="w-full text-xs font-semibold border border-amber-300 bg-amber-50/70 rounded-lg p-2 text-slate-900 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Emergency Contact */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <span className="text-xs font-bold text-slate-800 block">Emergency Contact</span>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Contact Name"
                value={emergencyName}
                onChange={(e) => setEmergencyName(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-900"
              />
              <input
                type="tel"
                placeholder="Phone"
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-900"
              />
              <input
                type="text"
                placeholder="Relation"
                value={emergencyRelation}
                onChange={(e) => setEmergencyRelation(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-900"
              />
            </div>
          </div>

          {/* Actions */}
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
              {saving ? 'Saving...' : 'Save Tenant Details'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
