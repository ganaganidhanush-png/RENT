'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  ShieldCheck, FileText, User, CheckCircle, 
  Loader2, AlertCircle, ArrowLeft 
} from 'lucide-react';
import Link from 'next/link';
import { Room } from '@/types/database';

interface AddTenantFormProps {
  vacantRooms?: Room[];
}

export default function AddTenantForm({ vacantRooms: initialVacantRooms }: AddTenantFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedRoomId = searchParams.get('room_id') || '';

  const supabase = createClient();

  const [rooms, setRooms] = useState<Room[]>(initialVacantRooms || []);
  const [loading, setLoading] = useState(false);
  const [fetchingRooms, setFetchingRooms] = useState(!initialVacantRooms);
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    roomId: preselectedRoomId,
    fullName: '',
    phone: '',
    email: '',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelation: 'Parent',
    moveInDate: new Date().toISOString().split('T')[0],
    leaseEndDate: '',
    monthlyRent: '',
    securityDeposit: '',
  });

  // Vault Files
  const [aadharFile, setAadharFile] = useState<File | null>(null);
  const [agreementFile, setAgreementFile] = useState<File | null>(null);
  const [tenantPhoto, setTenantPhoto] = useState<File | null>(null);

  useEffect(() => {
    async function loadRooms() {
      try {
        const { data } = await supabase
          .from('rooms')
          .select('*')
          .eq('status', 'VACANT')
          .order('room_number');

        if (data && data.length > 0) {
          setRooms(data);
          const activeRoom = data.find((r) => r.id === preselectedRoomId) || data[0];
          setFormData((prev) => ({
            ...prev,
            roomId: activeRoom.id,
            monthlyRent: String(activeRoom.base_rent),
            securityDeposit: String(activeRoom.security_deposit),
          }));
        } else {
          setRooms([]);
        }
      } catch (err) {
        console.error('Error fetching rooms:', err);
      } finally {
        setFetchingRooms(false);
      }
    }

    if (!initialVacantRooms) {
      loadRooms();
    }
  }, [initialVacantRooms, preselectedRoomId, supabase]);

  const handleRoomSelect = (roomId: string) => {
    const selected = rooms.find((r) => r.id === roomId);
    setFormData((prev) => ({
      ...prev,
      roomId,
      monthlyRent: selected ? String(selected.base_rent) : prev.monthlyRent,
      securityDeposit: selected ? String(selected.security_deposit) : prev.securityDeposit,
    }));
  };

  const uploadToVault = async (file: File, tenantId: string, docType: string) => {
    const fileExt = file.name.split('.').pop();
    const filePath = `tenants/${tenantId}/${docType}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('tenant-vault')
      .upload(filePath, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      console.warn('Storage upload note:', uploadError.message);
    }

    // Save metadata reference
    await supabase.from('documents').insert({
      tenant_id: tenantId,
      room_id: formData.roomId,
      doc_type: docType,
      storage_path: filePath,
      file_name: file.name,
      mime_type: file.type,
      file_size_bytes: file.size,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMessage(null);

    try {
      if (!formData.roomId) throw new Error('Please select a room.');
      if (!formData.leaseEndDate) throw new Error('Please specify lease expiry date.');

      // 1. Insert Tenant Record
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          room_id: formData.roomId,
          full_name: formData.fullName,
          phone: formData.phone,
          email: formData.email || null,
          emergency_contact_name: formData.emergencyName,
          emergency_contact_phone: formData.emergencyPhone,
          emergency_contact_relation: formData.emergencyRelation,
          move_in_date: formData.moveInDate,
          lease_end_date: formData.leaseEndDate,
          monthly_rent: Number(formData.monthlyRent),
          security_deposit_paid: Number(formData.securityDeposit),
          status: 'ACTIVE',
        })
        .select()
        .single();

      if (tenantError) throw tenantError;

      // 2. Upload Document Vault Files
      if (tenant) {
        if (aadharFile) await uploadToVault(aadharFile, tenant.id, 'AADHAR_CARD');
        if (agreementFile) await uploadToVault(agreementFile, tenant.id, 'RENTAL_AGREEMENT');
        if (tenantPhoto) await uploadToVault(tenantPhoto, tenant.id, 'TENANT_PHOTO');
      }

      setStatusMessage({ type: 'success', text: 'Tenant registered successfully!' });
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 1000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to register tenant. Please check Supabase table configuration.';
      setStatusMessage({ 
        type: 'error', 
        text: message 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link 
          href="/" 
          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Add New Tenant</h1>
          <p className="text-xs text-slate-500">Record tenant terms, emergency contacts, and store ID proofs securely</p>
        </div>
      </div>

      {statusMessage && (
        <div className={`p-4 rounded-xl text-xs flex items-center gap-2.5 font-medium ${
          statusMessage.type === 'error' 
            ? 'bg-rose-50 text-rose-700 border border-rose-200' 
            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {statusMessage.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl shadow-xs p-6 sm:p-8 space-y-8">
        {/* Section 1: Room Selection & Financial Terms */}
        <div className="space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">1. Room Assignment & Terms</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Assigned Room *</label>
              <select
                value={formData.roomId}
                onChange={(e) => handleRoomSelect(e.target.value)}
                required
                disabled={fetchingRooms}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
              >
                <option value="">-- Select Vacant Room --</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.room_number} (Base: ₹{room.base_rent})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Monthly Rent (₹) *</label>
              <input
                type="number"
                value={formData.monthlyRent}
                onChange={(e) => setFormData({ ...formData, monthlyRent: e.target.value })}
                required
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Security Deposit Paid (₹) *</label>
              <input
                type="number"
                value={formData.securityDeposit}
                onChange={(e) => setFormData({ ...formData, securityDeposit: e.target.value })}
                required
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Move-In Date *</label>
              <input
                type="date"
                value={formData.moveInDate}
                onChange={(e) => setFormData({ ...formData, moveInDate: e.target.value })}
                required
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Lease End Date *</label>
              <input
                type="date"
                value={formData.leaseEndDate}
                onChange={(e) => setFormData({ ...formData, leaseEndDate: e.target.value })}
                required
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Tenant Information */}
        <div className="space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">2. Tenant Identity</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Legal Name *</label>
              <input
                type="text"
                placeholder="e.g. Rahul Sharma"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Phone Number *</label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address (Optional)</label>
              <input
                type="email"
                placeholder="rahul@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Emergency Contacts */}
        <div className="space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">3. Emergency Contact</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Contact Name *</label>
              <input
                type="text"
                placeholder="e.g. Ramesh Sharma"
                value={formData.emergencyName}
                onChange={(e) => setFormData({ ...formData, emergencyName: e.target.value })}
                required
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Emergency Phone *</label>
              <input
                type="tel"
                placeholder="+91 98765 00000"
                value={formData.emergencyPhone}
                onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                required
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Relationship *</label>
              <select
                value={formData.emergencyRelation}
                onChange={(e) => setFormData({ ...formData, emergencyRelation: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
              >
                <option value="Parent">Parent</option>
                <option value="Spouse">Spouse</option>
                <option value="Sibling">Sibling</option>
                <option value="Guardian">Guardian</option>
                <option value="Colleague / Friend">Colleague / Friend</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 4: Document Vault Uploads */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              4. Document Vault (Private & Encrypted)
            </h2>
            <span className="text-[11px] text-slate-400">PDF, JPG, PNG up to 10MB</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Aadhar Upload */}
            <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-400 transition-colors text-center bg-slate-50/50">
              <ShieldCheck className="w-7 h-7 text-indigo-500 mx-auto mb-2" />
              <span className="text-xs font-semibold text-slate-800 block">Aadhar Card / ID Proof</span>
              <p className="text-[10px] text-slate-400 mt-0.5">Front/Back or PDF</p>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setAadharFile(e.target.files?.[0] || null)}
                className="hidden"
                id="aadhar-upload"
              />
              <label
                htmlFor="aadhar-upload"
                className="mt-2.5 inline-block px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg cursor-pointer transition-colors"
              >
                {aadharFile ? 'Replace File' : 'Choose File'}
              </label>
              {aadharFile && (
                <p className="text-[11px] text-emerald-600 mt-2 truncate flex items-center justify-center gap-1 font-medium">
                  <CheckCircle className="w-3.5 h-3.5" /> {aadharFile.name}
                </p>
              )}
            </div>

            {/* Signed Agreement */}
            <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-400 transition-colors text-center bg-slate-50/50">
              <FileText className="w-7 h-7 text-slate-500 mx-auto mb-2" />
              <span className="text-xs font-semibold text-slate-800 block">Signed Agreement</span>
              <p className="text-[10px] text-slate-400 mt-0.5">Scanned PDF or photo</p>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setAgreementFile(e.target.files?.[0] || null)}
                className="hidden"
                id="agreement-upload"
              />
              <label
                htmlFor="agreement-upload"
                className="mt-2.5 inline-block px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg cursor-pointer transition-colors"
              >
                {agreementFile ? 'Replace File' : 'Choose File'}
              </label>
              {agreementFile && (
                <p className="text-[11px] text-emerald-600 mt-2 truncate flex items-center justify-center gap-1 font-medium">
                  <CheckCircle className="w-3.5 h-3.5" /> {agreementFile.name}
                </p>
              )}
            </div>

            {/* Tenant Photo */}
            <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-400 transition-colors text-center bg-slate-50/50">
              <User className="w-7 h-7 text-amber-500 mx-auto mb-2" />
              <span className="text-xs font-semibold text-slate-800 block">Tenant Photo</span>
              <p className="text-[10px] text-slate-400 mt-0.5">Passport size photo</p>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setTenantPhoto(e.target.files?.[0] || null)}
                className="hidden"
                id="photo-upload"
              />
              <label
                htmlFor="photo-upload"
                className="mt-2.5 inline-block px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg cursor-pointer transition-colors"
              >
                {tenantPhoto ? 'Replace File' : 'Choose File'}
              </label>
              {tenantPhoto && (
                <p className="text-[11px] text-emerald-600 mt-2 truncate flex items-center justify-center gap-1 font-medium">
                  <CheckCircle className="w-3.5 h-3.5" /> {tenantPhoto.name}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <Link
            href="/"
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-lg shadow-xs transition-all cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Registering & Archiving...
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
