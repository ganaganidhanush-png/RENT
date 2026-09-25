'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  ShieldCheck, FileText, User, CheckCircle, 
  Loader2, AlertCircle, ArrowLeft, GraduationCap, Users, Plus, Trash2, Building2, IndianRupee, Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { Room, Tenant, BachelorOccupant, TenantType } from '@/types/database';
import { DEFAULT_ROOMS } from '@/lib/constants/rooms';
import { getLocalRooms, saveLocalTenant } from '@/lib/store/app-store';

interface AddTenantFormProps {
  vacantRooms?: Room[];
}

export default function AddTenantForm({ vacantRooms: initialVacantRooms }: AddTenantFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedRoomId = searchParams.get('room_id') || '';

  const [rooms, setRooms] = useState<Room[]>(initialVacantRooms && initialVacantRooms.length > 0 ? initialVacantRooms : DEFAULT_ROOMS);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Tenant Type: BACHELORS vs FAMILY
  const [tenantType, setTenantType] = useState<TenantType>('BACHELORS');

  // Primary Contact & Terms
  const [formData, setFormData] = useState(() => ({
    roomId: preselectedRoomId || DEFAULT_ROOMS[0].id,
    fullName: '',
    phone: '',
    email: '',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelation: 'Parent',
    moveInDate: new Date().toISOString().split('T')[0],
    leaseEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    monthlyRent: String(DEFAULT_ROOMS[0].base_rent),
    securityDeposit: String(DEFAULT_ROOMS[0].security_deposit),
    familyMembersCount: 2,
    primaryOccupation: '',
  }));

  // Dynamic list of Bachelor Occupants
  const [occupants, setOccupants] = useState<BachelorOccupant[]>([
    {
      name: '',
      phone: '',
      occupation: 'College Student',
      organization: '',
      role_or_course: '',
      aadhar_number: '',
    },
  ]);

  // Document Vault Files
  const [aadharFile, setAadharFile] = useState<File | null>(null);
  const [agreementFile, setAgreementFile] = useState<File | null>(null);
  const [tenantPhoto, setTenantPhoto] = useState<File | null>(null);

  useEffect(() => {
    async function loadRooms() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('rooms')
          .select('*')
          .order('room_number');

        if (!error && data && data.length > 0) {
          setRooms(data);
          const activeRoom = data.find((r) => r.id === preselectedRoomId) || data[0];
          setFormData((prev) => ({
            ...prev,
            roomId: activeRoom.id,
            monthlyRent: String(activeRoom.base_rent),
            securityDeposit: String(activeRoom.security_deposit),
          }));
        } else {
          // Fallback to local rooms (G1, 2A, 2B, 3A, 3B, P1)
          const local = getLocalRooms();
          setRooms(local);
          const activeRoom = local.find((r) => r.id === preselectedRoomId) || local[0];
          if (activeRoom) {
            setFormData((prev) => ({
              ...prev,
              roomId: activeRoom.id,
              monthlyRent: String(activeRoom.base_rent),
              securityDeposit: String(activeRoom.security_deposit),
            }));
          }
        }
      } catch (err) {
        console.warn('Rooms fetch note:', err);
        setRooms(getLocalRooms());
      }
    }

    loadRooms();
  }, [preselectedRoomId]);

  const handleRoomSelect = (roomId: string) => {
    const selected = rooms.find((r) => r.id === roomId);
    setFormData((prev) => ({
      ...prev,
      roomId,
      monthlyRent: selected ? String(selected.base_rent) : prev.monthlyRent,
      securityDeposit: selected ? String(selected.security_deposit) : prev.securityDeposit,
    }));
  };

  const handleAddOccupant = () => {
    setOccupants([
      ...occupants,
      {
        name: '',
        phone: '',
        occupation: 'College Student',
        organization: '',
        role_or_course: '',
        aadhar_number: '',
      },
    ]);
  };

  const handleRemoveOccupant = (index: number) => {
    setOccupants(occupants.filter((_, i) => i !== index));
  };

  const handleOccupantChange = (index: number, field: keyof BachelorOccupant, val: string) => {
    const updated = [...occupants];
    updated[index] = { ...updated[index], [field]: val };
    setOccupants(updated);
  };

  const uploadToVault = async (file: File, tenantId: string, docType: string) => {
    try {
      const supabase = createClient();
      const fileExt = file.name.split('.').pop();
      const filePath = `tenants/${tenantId}/${docType}_${Date.now()}.${fileExt}`;

      await supabase.storage
        .from('tenant-vault')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      await supabase.from('documents').insert({
        tenant_id: tenantId,
        room_id: formData.roomId,
        doc_type: docType,
        storage_path: filePath,
        file_name: file.name,
        mime_type: file.type,
        file_size_bytes: file.size,
      });
    } catch (err) {
      console.warn('Vault upload note:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMessage(null);

    try {
      if (!formData.roomId) throw new Error('Please select an assigned room.');
      if (!formData.fullName) throw new Error('Please enter the primary tenant name.');

      const selectedRoom = rooms.find((r) => r.id === formData.roomId);
      const generatedId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `tenant-${Date.now()}`;

      // Build structured tenant object
      const newTenant: Tenant = {
        id: generatedId,
        room_id: formData.roomId,
        full_name: formData.fullName,
        phone: formData.phone || (occupants[0]?.phone || ''),
        email: formData.email || null,
        tenant_type: tenantType,
        occupants: tenantType === 'BACHELORS' ? occupants : null,
        family_members_count: tenantType === 'FAMILY' ? Number(formData.familyMembersCount) : null,
        primary_occupation: tenantType === 'FAMILY' ? formData.primaryOccupation : (occupants[0]?.occupation || null),
        college_or_company: tenantType === 'FAMILY' ? null : (occupants[0]?.organization || null),
        emergency_contact_name: formData.emergencyName,
        emergency_contact_phone: formData.emergencyPhone,
        emergency_contact_relation: formData.emergencyRelation,
        move_in_date: formData.moveInDate,
        lease_end_date: formData.leaseEndDate,
        monthly_rent: Number(formData.monthlyRent),
        security_deposit_paid: Number(formData.securityDeposit),
        status: 'ACTIVE',
        room: selectedRoom,
        created_at: new Date().toISOString(),
      };

      // 1. Save in local app store immediately (so it instantly shows on UI)
      saveLocalTenant(newTenant);

      // 2. Try inserting into Supabase
      try {
        const supabase = createClient();
        const { data: tenant, error: tenantError } = await supabase
          .from('tenants')
          .insert({
            id: generatedId,
            room_id: newTenant.room_id,
            full_name: newTenant.full_name,
            phone: newTenant.phone,
            email: newTenant.email,
            tenant_type: newTenant.tenant_type,
            occupants: newTenant.occupants,
            family_members_count: newTenant.family_members_count,
            primary_occupation: newTenant.primary_occupation,
            college_or_company: newTenant.college_or_company,
            emergency_contact_name: newTenant.emergency_contact_name,
            emergency_contact_phone: newTenant.emergency_contact_phone,
            emergency_contact_relation: newTenant.emergency_contact_relation,
            move_in_date: newTenant.move_in_date,
            lease_end_date: newTenant.lease_end_date,
            monthly_rent: newTenant.monthly_rent,
            security_deposit_paid: newTenant.security_deposit_paid,
            status: 'ACTIVE',
          })
          .select()
          .single();

        if (!tenantError && tenant) {
          if (aadharFile) await uploadToVault(aadharFile, tenant.id, 'AADHAR_CARD');
          if (agreementFile) await uploadToVault(agreementFile, tenant.id, 'RENTAL_AGREEMENT');
          if (tenantPhoto) await uploadToVault(tenantPhoto, tenant.id, 'TENANT_PHOTO');
        }
      } catch (dbErr) {
        console.warn('Supabase tenant direct insert note:', dbErr);
      }

      setStatusMessage({ 
        type: 'success', 
        text: `Tenant ${formData.fullName} successfully registered for Room ${selectedRoom?.room_number || ''}!` 
      });

      setTimeout(() => {
        router.push('/tenants');
        router.refresh();
      }, 1000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to register tenant.';
      setStatusMessage({ type: 'error', text: message });
    } finally {
      setLoading(false);
    }
  };

  const currentSelectedRoom = rooms.find((r) => r.id === formData.roomId);

  return (
    <div className="max-w-4xl mx-auto p-6 lg:p-8 space-y-6">
      {/* Top Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link 
          href="/tenants" 
          className="p-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Add New Tenant / Occupants</h1>
          <p className="text-xs font-semibold text-slate-600">
            Record details for Bachelors (students/job) or Family, store ID proofs & assign rooms
          </p>
        </div>
      </div>

      {statusMessage && (
        <div className={`p-4 rounded-xl text-xs flex items-center gap-2.5 font-bold ${
          statusMessage.type === 'error' 
            ? 'bg-rose-50 text-rose-800 border border-rose-300' 
            : 'bg-emerald-50 text-emerald-800 border border-emerald-300'
        }`}>
          {statusMessage.type === 'error' ? <AlertCircle className="w-5 h-5 text-rose-600" /> : <CheckCircle className="w-5 h-5 text-emerald-600" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-slate-300 rounded-2xl shadow-sm p-6 sm:p-8 space-y-8">
        
        {/* Step 1: Category Selection - Bachelors or Family */}
        <div className="space-y-3">
          <div className="border-b border-slate-200 pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              1. Tenant Category (Who is moving in?)
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setTenantType('BACHELORS')}
              className={`p-4 rounded-xl border-2 text-left flex items-start gap-3.5 transition-all cursor-pointer ${
                tenantType === 'BACHELORS'
                  ? 'border-indigo-600 bg-indigo-50/80 shadow-sm'
                  : 'border-slate-300 bg-slate-50/50 hover:border-slate-400'
              }`}
            >
              <div className={`p-2.5 rounded-lg ${tenantType === 'BACHELORS' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 block">Bachelors (Students / Working)</span>
                <p className="text-xs text-slate-600 mt-1">
                  Upload individual details for each bachelor: college name, company, course, role & Aadhar proofs.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTenantType('FAMILY')}
              className={`p-4 rounded-xl border-2 text-left flex items-start gap-3.5 transition-all cursor-pointer ${
                tenantType === 'FAMILY'
                  ? 'border-indigo-600 bg-indigo-50/80 shadow-sm'
                  : 'border-slate-300 bg-slate-50/50 hover:border-slate-400'
              }`}
            >
              <div className={`p-2.5 rounded-lg ${tenantType === 'FAMILY' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                <Users className="w-6 h-6" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 block">Family Household</span>
                <p className="text-xs text-slate-600 mt-1">
                  Single family tenancy with primary earner, family member count, and emergency contact.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Step 2: Room Assignment & Rent Details */}
        <div className="space-y-4">
          <div className="border-b border-slate-200 pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              2. Room Assignment & Terms (6 Units)
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Assigned Room *</label>
              <select
                value={formData.roomId}
                onChange={(e) => handleRoomSelect(e.target.value)}
                required
                className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
              >
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    Room {room.room_number} (Floor {room.floor} • Base ₹{Number(room.base_rent).toLocaleString('en-IN')})
                  </option>
                ))}
              </select>

              {currentSelectedRoom && (
                <div className="mt-2 p-2 bg-slate-100 rounded-lg border border-slate-200 text-[11px] text-slate-700">
                  <span className="font-bold text-slate-900">Room {currentSelectedRoom.room_number}: </span>
                  {currentSelectedRoom.can_someone_get_in !== false ? (
                    <span className="text-emerald-700 font-bold">🟢 Space Available (Can get in)</span>
                  ) : (
                    <span className="text-rose-700 font-bold">🔴 Fully Booked</span>
                  )}
                  <span className="block text-slate-600 mt-0.5 font-medium">
                    Capacity: {currentSelectedRoom.capacity || 2} Beds • Current: {currentSelectedRoom.current_occupancy || 0} Occupants
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1">
                <IndianRupee className="w-3.5 h-3.5 text-indigo-600" />
                Monthly Rent (₹) *
              </label>
              <input
                type="number"
                value={formData.monthlyRent}
                onChange={(e) => setFormData({ ...formData, monthlyRent: e.target.value })}
                required
                className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1">
                <IndianRupee className="w-3.5 h-3.5 text-indigo-600" />
                Security Deposit (₹) *
              </label>
              <input
                type="number"
                value={formData.securityDeposit}
                onChange={(e) => setFormData({ ...formData, securityDeposit: e.target.value })}
                required
                className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Move-In Date *</label>
              <input
                type="date"
                value={formData.moveInDate}
                onChange={(e) => setFormData({ ...formData, moveInDate: e.target.value })}
                required
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Lease End Date *</label>
              <input
                type="date"
                value={formData.leaseEndDate}
                onChange={(e) => setFormData({ ...formData, leaseEndDate: e.target.value })}
                required
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Step 3: Primary Contact / Lead Person */}
        <div className="space-y-4">
          <div className="border-b border-slate-200 pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-600" />
              3. Primary Contact Person
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Full Legal Name *</label>
              <input
                type="text"
                placeholder="Enter full legal name"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Contact Phone *</label>
              <input
                type="tel"
                placeholder="Enter 10-digit mobile number"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Email Address</label>
              <input
                type="email"
                placeholder="Enter email address"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Step 4: If BACHELORS -> Individual Details for EACH Bachelor occupant */}
        {tenantType === 'BACHELORS' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-indigo-600" />
                  4. Bachelor Roommates ({occupants.length} Occupants in Room)
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Enter details for each person: are they in college, working, which university/company, etc.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddOccupant}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3.5 py-1.5 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Bachelor
              </button>
            </div>

            <div className="space-y-4">
              {occupants.map((occ, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-3">
                  <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                    <span className="text-xs font-bold text-indigo-900 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      Bachelor #{idx + 1} {occ.name ? `• ${occ.name}` : ''}
                    </span>
                    {occupants.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOccupant(idx)}
                        className="text-rose-600 hover:text-rose-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-800 mb-1">Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="Enter roommate name"
                        value={occ.name}
                        onChange={(e) => handleOccupantChange(idx, 'name', e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:border-indigo-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-800 mb-1">Phone Number *</label>
                      <input
                        type="tel"
                        required
                        placeholder="Enter phone number"
                        value={occ.phone}
                        onChange={(e) => handleOccupantChange(idx, 'phone', e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:border-indigo-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-800 mb-1">What do they do? *</label>
                      <select
                        value={occ.occupation}
                        onChange={(e) => handleOccupantChange(idx, 'occupation', e.target.value)}
                        className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none"
                      >
                        <option value="College Student">College Student</option>
                        <option value="Working Professional">Working Professional / Job</option>
                        <option value="Competitive Exam Aspirant">Competitive Exam Aspirant (UPSC/GATE)</option>
                        <option value="Intern">Intern / Trainee</option>
                        <option value="Freelancer">Freelancer / Remote</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-800 mb-1">College or Company Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="Enter college or company name"
                        value={occ.organization}
                        onChange={(e) => handleOccupantChange(idx, 'organization', e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:border-indigo-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-800 mb-1">Course / Year or Designation</label>
                      <input
                        type="text"
                        placeholder="e.g. Course, branch, or designation"
                        value={occ.role_or_course || ''}
                        onChange={(e) => handleOccupantChange(idx, 'role_or_course', e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:border-indigo-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-800 mb-1">Aadhar Number (Optional)</label>
                      <input
                        type="text"
                        placeholder="12-digit Aadhar"
                        value={occ.aadhar_number || ''}
                        onChange={(e) => handleOccupantChange(idx, 'aadhar_number', e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:border-indigo-600"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* If FAMILY -> Family details */}
        {tenantType === 'FAMILY' && (
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              4. Family Members & Primary Earner
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Total Family Members Moving In *</label>
                <input
                  type="number"
                  min={1}
                  value={formData.familyMembersCount}
                  onChange={(e) => setFormData({ ...formData, familyMembersCount: Number(e.target.value) })}
                  className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Primary Earner&apos;s Occupation</label>
                <input
                  type="text"
                  placeholder="e.g. Senior Software Architect / Govt Officer"
                  value={formData.primaryOccupation}
                  onChange={(e) => setFormData({ ...formData, primaryOccupation: e.target.value })}
                  className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Emergency Contact */}
        <div className="space-y-4">
          <div className="border-b border-slate-200 pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              5. Emergency Contact (Parents / Guardian)
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Contact Name *</label>
              <input
                type="text"
                placeholder="Enter emergency contact name"
                value={formData.emergencyName}
                onChange={(e) => setFormData({ ...formData, emergencyName: e.target.value })}
                required
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Emergency Phone *</label>
              <input
                type="tel"
                placeholder="Enter emergency phone number"
                value={formData.emergencyPhone}
                onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                required
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Relationship *</label>
              <select
                value={formData.emergencyRelation}
                onChange={(e) => setFormData({ ...formData, emergencyRelation: e.target.value })}
                className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
              >
                <option value="Parent">Parent</option>
                <option value="Spouse">Spouse</option>
                <option value="Sibling">Sibling</option>
                <option value="Guardian">Guardian</option>
                <option value="Friend">Friend</option>
              </select>
            </div>
          </div>
        </div>

        {/* Step 6: Document Vault Uploads */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              6. Document Vault (Private & Encrypted)
            </h2>
            <span className="text-xs font-semibold text-slate-500">PDF, JPG, PNG up to 10MB</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Aadhar Upload */}
            <div className="p-4 border-2 border-dashed border-slate-300 rounded-xl hover:border-indigo-500 transition-colors text-center bg-slate-50">
              <ShieldCheck className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
              <span className="text-xs font-bold text-slate-900 block">Aadhar Card / ID Proof</span>
              <p className="text-[11px] text-slate-600 mt-0.5">Front/Back or PDF</p>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setAadharFile(e.target.files?.[0] || null)}
                className="hidden"
                id="aadhar-upload"
              />
              <label
                htmlFor="aadhar-upload"
                className="mt-2.5 inline-block px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded-lg cursor-pointer transition-colors"
              >
                {aadharFile ? 'Replace File' : 'Choose File'}
              </label>
              {aadharFile && (
                <p className="text-xs text-emerald-700 mt-2 truncate flex items-center justify-center gap-1 font-bold">
                  <CheckCircle className="w-3.5 h-3.5" /> {aadharFile.name}
                </p>
              )}
            </div>

            {/* Signed Agreement */}
            <div className="p-4 border-2 border-dashed border-slate-300 rounded-xl hover:border-indigo-500 transition-colors text-center bg-slate-50">
              <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <span className="text-xs font-bold text-slate-900 block">Signed Agreement</span>
              <p className="text-[11px] text-slate-600 mt-0.5">Scanned PDF or photo</p>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setAgreementFile(e.target.files?.[0] || null)}
                className="hidden"
                id="agreement-upload"
              />
              <label
                htmlFor="agreement-upload"
                className="mt-2.5 inline-block px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded-lg cursor-pointer transition-colors"
              >
                {agreementFile ? 'Replace File' : 'Choose File'}
              </label>
              {agreementFile && (
                <p className="text-xs text-emerald-700 mt-2 truncate flex items-center justify-center gap-1 font-bold">
                  <CheckCircle className="w-3.5 h-3.5" /> {agreementFile.name}
                </p>
              )}
            </div>

            {/* Tenant Photo */}
            <div className="p-4 border-2 border-dashed border-slate-300 rounded-xl hover:border-indigo-500 transition-colors text-center bg-slate-50">
              <User className="w-8 h-8 text-amber-600 mx-auto mb-2" />
              <span className="text-xs font-bold text-slate-900 block">Tenant Photo</span>
              <p className="text-[11px] text-slate-600 mt-0.5">Passport size photo</p>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setTenantPhoto(e.target.files?.[0] || null)}
                className="hidden"
                id="photo-upload"
              />
              <label
                htmlFor="photo-upload"
                className="mt-2.5 inline-block px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded-lg cursor-pointer transition-colors"
              >
                {tenantPhoto ? 'Replace File' : 'Choose File'}
              </label>
              {tenantPhoto && (
                <p className="text-xs text-emerald-700 mt-2 truncate flex items-center justify-center gap-1 font-bold">
                  <CheckCircle className="w-3.5 h-3.5" /> {tenantPhoto.name}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-300">
          <Link
            href="/tenants"
            className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-lg shadow-sm transition-all cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving Registration & Vault Files...
              </>
            ) : (
              'Complete Registration'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
