'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, Plus, Phone, ArrowLeft, Mail, Calendar, 
  GraduationCap, Edit3, Trash2, CreditCard, LogOut 
} from 'lucide-react';
import { Tenant, Room, Payment } from '@/types/database';
import { getLocalTenants, deleteLocalTenant, getLocalRooms, saveLocalTenant } from '@/lib/store/app-store';
import { createClient } from '@/lib/supabase/client';
import EditTenantModal from '@/components/tenants/edit-tenant-modal';
import RecordPaymentModal from '@/components/payments/record-payment-modal';

function getOrdinal(d: number) {
  if (d > 3 && d < 21) return 'th';
  switch (d % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<'ALL' | 'BACHELORS' | 'FAMILY'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'MOVED_OUT'>('ALL');

  useEffect(() => {
    async function loadData() {
      const localRooms = getLocalRooms();
      setRooms(localRooms);

      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('tenants')
          .select('*, room:rooms(*)')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          setTenants(data);
        } else {
          setTenants(getLocalTenants());
        }
      } catch {
        setTenants(getLocalTenants());
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

  const handleEditClick = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setIsEditModalOpen(true);
  };

  const handleTenantSaved = (updatedTenant: Tenant) => {
    setTenants((prev) =>
      prev.map((t) => (t.id === updatedTenant.id ? updatedTenant : t))
    );
  };

  const handleDeleteTenant = async (tenantId: string) => {
    if (confirm('Are you sure you want to remove this tenant from the directory?')) {
      deleteLocalTenant(tenantId);
      setTenants((prev) => prev.filter((t) => t.id !== tenantId));
      try {
        const supabase = createClient();
        await supabase.from('tenants').delete().eq('id', tenantId);
      } catch (err) {
        console.warn('Supabase delete note:', err);
      }
    }
  };

  const handleMarkMovedOut = async (tenant: Tenant) => {
    if (confirm(`Mark "${tenant.full_name}" as Moved Out? This will record today's date as the move-out date and free up room vacancy.`)) {
      const today = new Date().toISOString().split('T')[0];
      const updatedTenant: Tenant = {
        ...tenant,
        status: 'MOVED_OUT',
        actual_move_out_date: today,
        updated_at: new Date().toISOString(),
      };
      saveLocalTenant(updatedTenant);
      setTenants((prev) => prev.map((t) => (t.id === tenant.id ? updatedTenant : t)));
      setRooms(getLocalRooms());

      try {
        const supabase = createClient();
        await supabase
          .from('tenants')
          .update({
            status: 'MOVED_OUT',
            actual_move_out_date: today,
            updated_at: new Date().toISOString(),
          })
          .eq('id', tenant.id);
      } catch (err) {
        console.warn('Supabase move-out update note:', err);
      }
    }
  };

  const filteredTenants = tenants.filter((t) => {
    const matchesCategory = filterType === 'ALL' || t.tenant_type === filterType;
    const matchesStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'ACTIVE'
        ? t.status === 'ACTIVE' || t.status === 'NOTICE_PERIOD'
        : t.status === 'MOVED_OUT';
    return matchesCategory && matchesStatus;
  });

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
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Tenants Directory</h1>
            <p className="text-xs font-semibold text-slate-600 mt-0.5">
              Bachelors (students & working) and Family profiles with individual roommate information
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-300 text-xs font-bold text-slate-700">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${statusFilter === 'ALL' ? 'bg-white shadow-xs text-indigo-700' : 'hover:text-slate-900'}`}
            >
              All Status
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${statusFilter === 'ACTIVE' ? 'bg-white shadow-xs text-emerald-700' : 'hover:text-slate-900'}`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter('MOVED_OUT')}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${statusFilter === 'MOVED_OUT' ? 'bg-white shadow-xs text-slate-700' : 'hover:text-slate-900'}`}
            >
              Vacated
            </button>
          </div>

          {/* Category Filter */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-300 text-xs font-bold text-slate-700">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${filterType === 'ALL' ? 'bg-white shadow-xs text-indigo-700' : 'hover:text-slate-900'}`}
            >
              All Types ({tenants.length})
            </button>
            <button
              onClick={() => setFilterType('BACHELORS')}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${filterType === 'BACHELORS' ? 'bg-white shadow-xs text-indigo-700' : 'hover:text-slate-900'}`}
            >
              Bachelors ({tenants.filter((t) => t.tenant_type === 'BACHELORS').length})
            </button>
            <button
              onClick={() => setFilterType('FAMILY')}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${filterType === 'FAMILY' ? 'bg-white shadow-xs text-indigo-700' : 'hover:text-slate-900'}`}
            >
              Family ({tenants.filter((t) => t.tenant_type === 'FAMILY').length})
            </button>
          </div>

          <Link
            href="/tenants/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add New Tenant
          </Link>
        </div>
      </div>

      {/* Tenants Cards */}
      {filteredTenants.length === 0 ? (
        <div className="text-center py-16 bg-white border-2 border-dashed border-slate-300 rounded-2xl p-8">
          <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900">No tenants registered in this category</h2>
          <p className="text-xs font-semibold text-slate-600 mt-1 max-w-sm mx-auto">
            Click &quot;Add New Tenant&quot; to register either Bachelors (with college/company &amp; roommate details) or a Family.
          </p>
          <Link
            href="/tenants/new"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            Register Tenant Now
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTenants.map((t) => {
            const isBachelors = t.tenant_type === 'BACHELORS';
            const occupantList = t.occupants && t.occupants.length > 0 ? t.occupants : [];

            return (
              <div
                key={t.id}
                className="bg-white border-2 border-slate-200 rounded-2xl p-5 shadow-sm hover:border-indigo-400 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-black text-indigo-800 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full flex items-center gap-1.5">
                      Room {t.room?.room_number || 'Room'}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                        isBachelors
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}>
                        {isBachelors ? <GraduationCap className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                        {isBachelors ? 'Bachelors' : 'Family'}
                      </span>

                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        t.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : t.status === 'NOTICE_PERIOD'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-slate-100 text-slate-700 border border-slate-300'
                      }`}>
                        {t.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Primary Name */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{t.full_name}</h3>
                      <p className="text-xs font-semibold text-slate-600 mt-0.5">
                        {isBachelors 
                          ? `${occupantList.length} Bachelor Occupant${occupantList.length > 1 ? 's' : ''}`
                          : `Family of ${t.family_members_count || 2} Members`}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleEditClick(t)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                        title="Edit tenant profile and occupants"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTenant(t.id)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Remove tenant"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="mt-3 space-y-1.5 text-xs text-slate-700">
                    <div className="flex items-center gap-2 font-medium">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <span className="font-bold text-slate-900">{t.phone}</span>
                    </div>

                    {t.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                        <span className="truncate">{t.email}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 font-medium text-slate-600">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{t.move_in_date} → {t.lease_end_date}</span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-indigo-50/80 border border-indigo-200 text-xs">
                      <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                        Rent Due:
                      </span>
                      <span className="font-extrabold text-indigo-900 bg-white px-2 py-0.5 rounded shadow-2xs border border-indigo-100">
                        {t.rent_due_day || 5}{getOrdinal(t.rent_due_day || 5)} of every month
                      </span>
                    </div>
                  </div>

                  {/* If BACHELORS: Detailed Individual Occupants Breakdown */}
                  {isBachelors && occupantList.length > 0 && (
                    <div className="mt-4 p-3 bg-indigo-50/60 rounded-xl border border-indigo-200 space-y-2">
                      <span className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider block">
                        Roommates & College / Job Info:
                      </span>
                      <div className="space-y-2 divide-y divide-indigo-100">
                        {occupantList.map((occ, idx) => (
                          <div key={idx} className={`${idx > 0 ? 'pt-2' : ''} text-xs`}>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900">
                                {idx + 1}. {occ.name || 'Occupant'}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-white text-indigo-700 rounded border border-indigo-200">
                                {occ.occupation}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-700 font-medium mt-0.5">
                              {occ.organization} {occ.role_or_course ? `(${occ.role_or_course})` : ''}
                            </p>
                            {occ.phone && (
                              <p className="text-[10px] text-slate-500 font-medium">Phone: {occ.phone}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* If FAMILY: Family info */}
                  {!isBachelors && (
                    <div className="mt-4 p-3 bg-blue-50/60 rounded-xl border border-blue-200 text-xs text-slate-800 space-y-1">
                      <span className="text-[11px] font-bold text-blue-950 uppercase tracking-wider block">
                        Family Household Info:
                      </span>
                      <p className="font-medium">
                        Total Members: <span className="font-bold text-slate-900">{t.family_members_count || 2}</span>
                      </p>
                      {t.primary_occupation && (
                        <p className="font-medium">
                          Earner&apos;s Job: <span className="font-bold text-slate-900">{t.primary_occupation}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Emergency Contact */}
                  <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700 space-y-0.5">
                    <p className="font-bold text-slate-900">Emergency Contact ({t.emergency_contact_relation}):</p>
                    <p className="font-medium">{t.emergency_contact_name} • <span className="font-bold text-slate-900">{t.emergency_contact_phone}</span></p>
                  </div>
                </div>

                {/* Card Footer: Financials & Actions */}
                <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-black text-slate-900 text-sm">
                      ₹{Number(t.monthly_rent).toLocaleString('en-IN')}
                      <span className="font-normal text-slate-500 text-xs"> /mo</span>
                    </span>
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded ml-2">
                      Dep: ₹{Number(t.security_deposit_paid).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {t.status !== 'MOVED_OUT' && (
                      <button
                        type="button"
                        onClick={() => handleMarkMovedOut(t)}
                        className="inline-flex items-center gap-1 font-bold text-amber-900 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-300 transition-colors cursor-pointer"
                        title="Mark tenant as moved out and free up room vacancy"
                      >
                        <LogOut className="w-3.5 h-3.5" /> Move Out
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        const roomObj = rooms.find((r) => r.id === t.room_id) || t.room || undefined;
                        const now = new Date();
                        const currentMonthIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
                        const monthStr = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
                        setEditingPayment({
                          id: `pay-${Date.now()}`,
                          tenant_id: t.id,
                          room_id: t.room_id || '',
                          billing_period_month: currentMonthIso,
                          billing_month: monthStr,
                          amount_due: Number(t.monthly_rent),
                          amount_paid: Number(t.monthly_rent),
                          amount_pending: 0,
                          payment_status: 'PAID',
                          payment_date: new Date().toISOString().split('T')[0],
                          payment_method: 'UPI',
                          received_by: 'LANDLORD',
                          created_at: new Date().toISOString(),
                          tenant: t,
                          room: roomObj,
                        });
                        setIsPaymentModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1 font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-lg border border-emerald-300 transition-colors cursor-pointer"
                      title="Record rent payment for this tenant"
                    >
                      <CreditCard className="w-3.5 h-3.5" /> + Payment
                    </button>

                    <button
                      type="button"
                      onClick={() => handleEditClick(t)}
                      className="inline-flex items-center gap-1 font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit Profile
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Tenant Modal */}
      {isEditModalOpen && editingTenant && (
        <EditTenantModal
          tenant={editingTenant}
          rooms={rooms}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingTenant(null);
          }}
          onSaved={handleTenantSaved}
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
            // Handled via rentvault_data_updated event
          }}
        />
      )}
    </div>
  );
}
