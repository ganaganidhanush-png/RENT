'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  ShieldCheck, FileText, User, CheckCircle, 
  Loader2, AlertCircle, ArrowLeft, GraduationCap, Users, Plus, Trash2, Building2, IndianRupee, Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { Room, Tenant, BachelorOccupant, TenantType, Payment, DocumentRecord } from '@/types/database';
import { DEFAULT_ROOMS } from '@/lib/constants/rooms';
import { getLocalRooms, saveLocalTenant, saveLocalPayment, saveLocalDocument } from '@/lib/store/app-store';

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
    advancePaidToday: String(DEFAULT_ROOMS[0].security_deposit),
    rentDueDay: 5,
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
            advancePaidToday: String(activeRoom.security_deposit),
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
              advancePaidToday: String(activeRoom.security_deposit),
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
      advancePaidToday: selected ? String(selected.security_deposit) : prev.advancePaidToday,
    }));
  };

  const handleTenantTypeSelect = (type: TenantType) => {
    setTenantType(type);
    if (type === 'FAMILY') {
      if (occupants[0]?.name && !formData.fullName) {
        setFormData((prev) => ({
          ...prev,
          fullName: occupants[0].name,
          phone: occupants[0].phone || prev.phone,
        }));
      }
    } else {
      if (formData.fullName) {
        const updated = [...occupants];
        updated[0] = {
          ...updated[0],
          name: formData.fullName,
          phone: formData.phone,
        };
        setOccupants(updated);
      }
    }
  };

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
      setFormData((prev) => ({ ...prev, familyMembersCount: target }));
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
      setFormData((prev) => ({
        ...prev,
        fullName: updated[0].name,
        phone: updated[0].phone,
      }));
    }
  };

  const handleOccupantChange = (index: number, field: keyof BachelorOccupant, val: string) => {
    const updated = [...occupants];
    updated[index] = { ...updated[index], [field]: val };
    setOccupants(updated);
    if (index === 0) {
      if (field === 'name') setFormData((prev) => ({ ...prev, fullName: val }));
      if (field === 'phone') setFormData((prev) => ({ ...prev, phone: val }));
    }
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

      const isBachelors = tenantType === 'BACHELORS';
      const primaryFullName = (isBachelors ? (occupants[0]?.name || formData.fullName) : formData.fullName).trim();
      const primaryPhone = (isBachelors ? (occupants[0]?.phone || formData.phone) : formData.phone).trim();

      if (!primaryFullName) {
        throw new Error(isBachelors ? 'Please enter Member #1 (Lead Tenant) full legal name.' : 'Please enter the primary person full legal name.');
      }
      if (!primaryPhone) {
        throw new Error(isBachelors ? 'Please enter Member #1 contact phone number.' : 'Please enter the primary person contact phone number.');
      }

      if (isBachelors) {
        for (let i = 0; i < occupants.length; i++) {
          if (!occupants[i].name?.trim()) {
            throw new Error(`Please enter the name for Bachelor Member #${i + 1}.`);
          }
          if (!occupants[i].phone?.trim()) {
            throw new Error(`Please enter the phone number for Bachelor Member #${i + 1}.`);
          }
        }
      }

      if (!formData.emergencyName?.trim()) {
        throw new Error('Please enter the emergency contact person name.');
      }
      if (!formData.emergencyPhone?.trim()) {
        throw new Error('Please enter the emergency contact phone number.');
      }

      const selectedRoom = rooms.find((r) => r.id === formData.roomId);
      const generatedId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });

      const advancePaidTodayNum = Math.max(0, Number(formData.advancePaidToday) || 0);
      const totalDepositTarget = Number(formData.securityDeposit) || 0;

      // Build structured tenant object
        const newTenant: Tenant = {
          id: generatedId,
          room_id: formData.roomId,
          full_name: primaryFullName,
          phone: primaryPhone,
          email: formData.email || null,
          tenant_type: tenantType,
          occupants: isBachelors ? occupants : null,
          family_members_count: isBachelors ? occupants.length : Number(formData.familyMembersCount || 1),
          primary_occupation: isBachelors ? (occupants[0]?.occupation || null) : (formData.primaryOccupation || null),
          college_or_company: isBachelors ? (occupants[0]?.organization || null) : null,
          emergency_contact_name: formData.emergencyName,
          emergency_contact_phone: formData.emergencyPhone,
          emergency_contact_relation: formData.emergencyRelation,
          move_in_date: formData.moveInDate,
          lease_end_date: formData.leaseEndDate,
          monthly_rent: Math.max(0, Number(formData.monthlyRent) || 0),
          security_deposit_paid: advancePaidTodayNum,
          rent_due_day: Math.max(1, Math.min(31, Number(formData.rentDueDay || 5))),
          status: 'ACTIVE',
          room: selectedRoom,
          created_at: new Date().toISOString(),
        };

        // 1. Save in local app store immediately (so it instantly shows on UI and auto-syncs all room occupancies)
        saveLocalTenant(newTenant);

        const now = new Date();
        const currentMonthIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const currentMonthName = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

        // If an upfront advance or token slice was paid today, record Slice #1
        let depositPayment: Payment | null = null;
        if (advancePaidTodayNum > 0) {
          const isFullDeposit = advancePaidTodayNum >= totalDepositTarget;
          depositPayment = {
            id: `pay-advance-${Date.now()}`,
            tenant_id: generatedId,
            room_id: formData.roomId,
            billing_period_month: currentMonthIso,
            billing_month: currentMonthName,
            amount_due: totalDepositTarget,
            amount_paid: advancePaidTodayNum,
            amount_pending: Math.max(0, totalDepositTarget - advancePaidTodayNum),
            payment_status: isFullDeposit ? 'PAID' : 'PARTIAL',
            payment_date: new Date().toISOString().split('T')[0],
            payment_method: 'UPI',
            payment_type: 'SECURITY_DEPOSIT',
            installment_number: 1,
            total_target_amount: totalDepositTarget,
            received_by: 'LANDLORD',
            notes: isFullDeposit
              ? `Full upfront advance of ₹${advancePaidTodayNum.toLocaleString('en-IN')} paid at move-in.`
              : `Advance Slice #1 (token advance) of ₹${advancePaidTodayNum.toLocaleString('en-IN')} paid. Remaining ₹${Math.max(0, totalDepositTarget - advancePaidTodayNum).toLocaleString('en-IN')} pending in slices.`,
            created_at: new Date().toISOString(),
            tenant: newTenant,
            room: selectedRoom,
          };
          saveLocalPayment(depositPayment);
        }

        // Auto-create initial billing payment entry for the tenant's upcoming monthly rent
        const initialPayment: Payment = {
          id: `pay-${Date.now() + 1}`,
          tenant_id: generatedId,
          room_id: formData.roomId,
          billing_period_month: currentMonthIso,
          billing_month: currentMonthName,
          amount_due: Number(formData.monthlyRent),
          amount_paid: 0,
          amount_pending: Number(formData.monthlyRent),
          payment_status: 'PENDING',
          payment_date: null,
          payment_method: 'UPI',
          payment_type: 'RENT',
          received_by: 'LANDLORD',
          created_at: new Date().toISOString(),
          tenant: newTenant,
          room: selectedRoom,
        };
        saveLocalPayment(initialPayment);

        // Record uploaded documents in local store
        if (aadharFile) {
          const aadharDoc: DocumentRecord = {
            id: `doc-aadhar-${Date.now()}`,
            tenant_id: generatedId,
            room_id: formData.roomId,
            doc_type: 'AADHAR_CARD',
            storage_path: `tenants/${generatedId}/aadhar_${aadharFile.name}`,
            file_name: aadharFile.name,
            mime_type: aadharFile.type || 'application/pdf',
            file_size_bytes: aadharFile.size,
            created_at: new Date().toISOString(),
            tenant: newTenant,
            room: selectedRoom,
          };
          saveLocalDocument(aadharDoc);
        }

        if (agreementFile) {
          const agreementDoc: DocumentRecord = {
            id: `doc-agreement-${Date.now()}`,
            tenant_id: generatedId,
            room_id: formData.roomId,
            doc_type: 'RENTAL_AGREEMENT',
            storage_path: `tenants/${generatedId}/agreement_${agreementFile.name}`,
            file_name: agreementFile.name,
            mime_type: agreementFile.type || 'application/pdf',
            file_size_bytes: agreementFile.size,
            created_at: new Date().toISOString(),
            tenant: newTenant,
            room: selectedRoom,
          };
          saveLocalDocument(agreementDoc);
        }

        if (tenantPhoto) {
          const photoDoc: DocumentRecord = {
            id: `doc-photo-${Date.now()}`,
            tenant_id: generatedId,
            room_id: formData.roomId,
            doc_type: 'TENANT_PHOTO',
            storage_path: `tenants/${generatedId}/photo_${tenantPhoto.name}`,
            file_name: tenantPhoto.name,
            mime_type: tenantPhoto.type || 'image/jpeg',
            file_size_bytes: tenantPhoto.size,
            created_at: new Date().toISOString(),
            tenant: newTenant,
            room: selectedRoom,
          };
          saveLocalDocument(photoDoc);
        }

        // 2. Sync to Supabase
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
              rent_due_day: newTenant.rent_due_day || 5,
              status: 'ACTIVE',
            })
            .select()
            .single();

          if (!tenantError && tenant) {
            if (aadharFile) await uploadToVault(aadharFile, tenant.id, 'AADHAR_CARD');
            if (agreementFile) await uploadToVault(agreementFile, tenant.id, 'RENTAL_AGREEMENT');
            if (tenantPhoto) await uploadToVault(tenantPhoto, tenant.id, 'TENANT_PHOTO');
          }

          // If advance slice was recorded, sync payment to Supabase
          if (depositPayment) {
            await supabase.from('payments').insert({
              id: depositPayment.id,
              tenant_id: generatedId,
              room_id: formData.roomId,
              billing_period_month: currentMonthIso,
              billing_month: currentMonthName,
              amount_due: depositPayment.amount_due,
              amount_paid: depositPayment.amount_paid,
              amount_pending: depositPayment.amount_pending,
              payment_status: depositPayment.payment_status,
              payment_date: depositPayment.payment_date,
              payment_method: depositPayment.payment_method,
              payment_type: 'SECURITY_DEPOSIT',
              installment_number: 1,
              total_target_amount: depositPayment.total_target_amount,
              received_by: 'LANDLORD',
              notes: depositPayment.notes,
            });
          }

          // Smartly update the room status and occupancy in Supabase
          if (selectedRoom) {
            const totalOccupants = isBachelors ? occupants.length : Number(formData.familyMembersCount || 1);
            const capacity = selectedRoom.capacity || 2;
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedRoom.id);
            const roomQuery = supabase.from('rooms').update({
              status: 'OCCUPIED',
              current_occupancy: totalOccupants,
              can_someone_get_in: totalOccupants < capacity,
              updated_at: new Date().toISOString(),
            });
            if (isUuid) {
              await roomQuery.eq('id', selectedRoom.id);
            } else {
              await roomQuery.eq('room_number', selectedRoom.room_number);
            }
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
              onClick={() => handleTenantTypeSelect('BACHELORS')}
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
                  Choose number of members to take each person&apos;s college/company & role details.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleTenantTypeSelect('FAMILY')}
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
                  Family tenancy: requires only 1 primary person (Head of Family) and emergency contact.
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
              2. Room Assignment & Terms
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
                    Max Capacity: {currentSelectedRoom.capacity || 2} Members • Members Staying: {currentSelectedRoom.current_occupancy || 0} Members
                  </span>
                </div>
              )}

              {currentSelectedRoom && (tenantType === 'BACHELORS' ? occupants.length : Number(formData.familyMembersCount || 1)) > (currentSelectedRoom.capacity || 2) && (
                <div className="mt-2 p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-[11px] text-amber-900 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Capacity Notice:</strong> {tenantType === 'BACHELORS' ? occupants.length : Number(formData.familyMembersCount || 1)} occupants exceeds this room&apos;s registered capacity ({currentSelectedRoom.capacity || 2}). The room will be marked 100% full upon booking.
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
                Agreed Security Deposit Target (₹) *
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

          {/* Smart Upfront Advance / Slices Collection Section */}
          <div className="p-4 rounded-xl border-2 border-indigo-200 bg-indigo-50/50 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-black text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  Smart Advance Collection (Initial Slice or Token)
                </span>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Does the tenant pay the full advance today, or a token slice now and the rest in smaller slices over time?
                </p>
              </div>

              {(() => {
                const depositTarget = Number(formData.securityDeposit) || 0;
                const advanceToday = Number(formData.advancePaidToday) || 0;
                if (advanceToday >= depositTarget && depositTarget > 0) {
                  return (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-full whitespace-nowrap">
                      🟢 Full Advance Paid (₹{advanceToday.toLocaleString('en-IN')})
                    </span>
                  );
                } else if (advanceToday > 0) {
                  return (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-full whitespace-nowrap">
                      🟡 Slice #1: ₹{advanceToday.toLocaleString('en-IN')} (₹{Math.max(0, depositTarget - advanceToday).toLocaleString('en-IN')} due in slices)
                    </span>
                  );
                } else {
                  return (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-200 border border-slate-300 px-2.5 py-1 rounded-full whitespace-nowrap">
                      ⚪ Pay in Slices Later (₹0 Today)
                    </span>
                  );
                }
              })()}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1">
                  <IndianRupee className="w-3.5 h-3.5 text-indigo-600" />
                  Advance Amount Paid Today (₹)
                </label>
                <input
                  type="number"
                  value={formData.advancePaidToday}
                  onChange={(e) => setFormData({ ...formData, advancePaidToday: e.target.value })}
                  placeholder="e.g. 5000"
                  className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                  ⚡ Quick Slice Presets:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, advancePaidToday: formData.securityDeposit })}
                    className="px-2.5 py-1 text-xs font-bold bg-white text-indigo-700 border border-indigo-300 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                  >
                    ⚡ Full (₹{Number(formData.securityDeposit || 0).toLocaleString('en-IN')})
                  </button>
                  {Number(formData.securityDeposit) > 5000 && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, advancePaidToday: '5000' })}
                      className="px-2.5 py-1 text-xs font-bold bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Token: ₹5,000
                    </button>
                  )}
                  {Number(formData.securityDeposit) > 10000 && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, advancePaidToday: '10000' })}
                      className="px-2.5 py-1 text-xs font-bold bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Slice: ₹10,000
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, advancePaidToday: '0' })}
                    className="px-2.5 py-1 text-xs font-bold bg-white text-rose-700 border border-rose-300 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  >
                    Pay Later (₹0)
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Rent Due Date (Every Month) *
                </label>
                <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  {formData.rentDueDay}{formData.rentDueDay === 1 ? 'st' : formData.rentDueDay === 2 ? 'nd' : formData.rentDueDay === 3 ? 'rd' : 'th'} of month
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={formData.rentDueDay}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10);
                    if (!isNaN(parsed)) {
                      setFormData({ ...formData, rentDueDay: Math.max(1, Math.min(31, parsed)) });
                    }
                  }}
                  required
                  placeholder="Day (1-31)"
                  className="w-20 text-xs font-bold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
                />
                <div className="flex flex-wrap gap-1">
                  {[1, 5, 10, 15].map((dayNum) => (
                    <button
                      key={dayNum}
                      type="button"
                      onClick={() => setFormData({ ...formData, rentDueDay: dayNum })}
                      className={`px-2 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                        Number(formData.rentDueDay) === dayNum
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {dayNum}{dayNum === 1 ? 'st' : dayNum === 2 ? 'nd' : dayNum === 3 ? 'rd' : 'th'}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                Day of the month when tenant must pay rent
              </p>
            </div>
          </div>
        </div>

        {/* Step 3: Dynamic Members Staying in Room */}
        {/* If BACHELORS: Choose number of members -> Takes each member's individual details */}
        {tenantType === 'BACHELORS' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-indigo-600" />
                  3. Bachelor Roommates ({occupants.length} Members Staying in Room)
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Select how many members stay in this room. Details are collected for each individual roommate.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">No. of Members:</span>
                <div className="inline-flex rounded-lg border border-slate-300 p-0.5 bg-slate-100">
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleMemberCountChange(num)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
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

            <div className="space-y-4">
              {occupants.map((occ, idx) => (
                <div key={idx} className="p-4 rounded-xl border-2 border-indigo-200 bg-indigo-50/40 space-y-3">
                  <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                    <span className="text-xs font-bold text-indigo-950 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      {idx === 0 ? 'Member #1 (Lead / Primary Tenant)' : `Member #${idx + 1} (Roommate)`}
                      {occ.name ? ` • ${occ.name}` : ''}
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
                      <label className="block text-[11px] font-bold text-slate-800 mb-1">
                        Full Legal Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={idx === 0 ? 'Enter lead tenant name' : 'Enter roommate name'}
                        value={occ.name}
                        onChange={(e) => handleOccupantChange(idx, 'name', e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:border-indigo-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-800 mb-1">
                        Contact Phone *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="Enter 10-digit mobile number"
                        value={occ.phone}
                        onChange={(e) => handleOccupantChange(idx, 'phone', e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:border-indigo-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-800 mb-1">
                        What do they do? *
                      </label>
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
                      <label className="block text-[11px] font-bold text-slate-800 mb-1">
                        College or Company Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. IIT, NIT, TCS, Infosys, etc."
                        value={occ.organization}
                        onChange={(e) => handleOccupantChange(idx, 'organization', e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:border-indigo-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-800 mb-1">
                        Course / Year or Designation
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. B.Tech 3rd Yr or SDE-1"
                        value={occ.role_or_course || ''}
                        onChange={(e) => handleOccupantChange(idx, 'role_or_course', e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:border-indigo-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-800 mb-1">
                        {idx === 0 ? 'Email Address (Optional)' : 'Aadhar / ID Number (Optional)'}
                      </label>
                      {idx === 0 ? (
                        <input
                          type="email"
                          placeholder="Lead contact email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:border-indigo-600"
                        />
                      ) : (
                        <input
                          type="text"
                          placeholder="12-digit Aadhar"
                          value={occ.aadhar_number || ''}
                          onChange={(e) => handleOccupantChange(idx, 'aadhar_number', e.target.value)}
                          className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:border-indigo-600"
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAddOccupant}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> + Add Another Bachelor Member
              </button>
            </div>
          </div>
        )}

        {/* If FAMILY: Choose number of members -> Only 1 Person Details & Emergency Details */}
        {tenantType === 'FAMILY' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  3. Family Members Count ({formData.familyMembersCount} Members Staying in Room)
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Select how many family members stay in the room. For families, only the 1 primary person and emergency details are required.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">No. of Members:</span>
                <div className="inline-flex rounded-lg border border-slate-300 p-0.5 bg-slate-100">
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleMemberCountChange(num)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        formData.familyMembersCount === num
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

            {/* Note banner explaining 1 person policy for family */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-semibold flex items-center gap-2">
              <span className="text-base">👨‍👩‍👧‍👦</span>
              <span>
                <strong>Family Tenancy:</strong> Since this is a family, you only need to provide details for <strong>1 primary person</strong> (Head of Family) and emergency details.
              </span>
            </div>

            {/* Primary Person (Head of Family / Earning Member) */}
            <div className="p-5 rounded-xl border-2 border-slate-200 bg-slate-50 space-y-4">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600" />
                Primary Person (Head of Family / Main Tenant)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">Full Legal Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter head of family name"
                    value={formData.fullName}
                    onChange={(e) => {
                      setFormData({ ...formData, fullName: e.target.value });
                      if (occupants.length > 0) {
                        const updated = [...occupants];
                        updated[0] = { ...updated[0], name: e.target.value };
                        setOccupants(updated);
                      }
                    }}
                    className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">Contact Phone *</label>
                  <input
                    type="tel"
                    required
                    placeholder="Enter 10-digit mobile number"
                    value={formData.phone}
                    onChange={(e) => {
                      setFormData({ ...formData, phone: e.target.value });
                      if (occupants.length > 0) {
                        const updated = [...occupants];
                        updated[0] = { ...updated[0], phone: e.target.value };
                        setOccupants(updated);
                      }
                    }}
                    className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">Email Address (Optional)</label>
                  <input
                    type="email"
                    placeholder="Enter email address"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">Primary Earner&apos;s Profession / Occupation</label>
                  <input
                    type="text"
                    placeholder="e.g. Senior Software Architect / Govt Officer / Business"
                    value={formData.primaryOccupation}
                    onChange={(e) => setFormData({ ...formData, primaryOccupation: e.target.value })}
                    className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Emergency Contact Details */}
        <div className="space-y-4">
          <div className="border-b border-slate-200 pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              4. Emergency Contact Details
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              {tenantType === 'FAMILY' 
                ? 'Emergency contact person outside or within the family (Relative, Sibling, Parent, Friend)' 
                : 'Emergency contact (Parents / Guardian) for the roommates'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Emergency Contact Name *</label>
              <input
                type="text"
                placeholder="Enter contact name"
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
                placeholder="Enter 10-digit mobile"
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
                <option value="Relative">Relative</option>
                <option value="Friend">Friend</option>
              </select>
            </div>
          </div>
        </div>

        {/* Step 5: Document Vault Uploads */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              5. Document Vault (Private & Encrypted)
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
