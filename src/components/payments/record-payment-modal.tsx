'use client';

import React, { useState } from 'react';
import { 
  X, IndianRupee, User, Building2, Calendar, 
  CheckCircle2, Save, CreditCard, Tag, FileText, UserCheck
} from 'lucide-react';
import { Payment, Tenant, Room, PaymentMethod, PaymentStatus, PaymentReceiver, PaymentType } from '@/types/database';
import { getLocalTenants, getLocalRooms, saveLocalPayment, getLandlordProfile } from '@/lib/store/app-store';
import { createClient } from '@/lib/supabase/client';

const CATEGORY_OPTIONS: { value: PaymentType; label: string; icon: string; desc: string }[] = [
  { value: 'RENT', label: 'Rent', icon: '🏠', desc: 'Monthly stay' },
  { value: 'MAINTENANCE', label: 'Maintenance', icon: '🛠️', desc: 'Water, cleaning, lift' },
  { value: 'SECURITY_DEPOSIT', label: 'Advance / Deposit', icon: '🔐', desc: 'Move-in security' },
  { value: 'ELECTRICITY', label: 'Electricity', icon: '⚡', desc: 'EB meter units' },
  { value: 'OTHER', label: 'Other', icon: '📝', desc: 'Miscellaneous' },
];

const QUICK_NOTE_TAGS = [
  'Monthly Rent',
  'Maintenance (Water/Lift)',
  'Move-in Advance Deposit',
  'EB Meter Bill',
  'Full Settlement',
  'Partial Payment (Balance Pending)',
];

interface RecordPaymentModalProps {
  payment?: Payment | null;
  preselectedTenantId?: string;
  preselectedRoomId?: string;
  tenants?: Tenant[];
  rooms?: Room[];
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (payment: Payment) => void;
}

export default function RecordPaymentModal({
  payment,
  preselectedTenantId,
  preselectedRoomId,
  tenants: propTenants,
  rooms: propRooms,
  isOpen,
  onClose,
  onSaved,
}: RecordPaymentModalProps) {
  const [tenants] = useState<Tenant[]>(() => (propTenants && propTenants.length > 0 ? propTenants : getLocalTenants()));
  const [rooms] = useState<Room[]>(() => (propRooms && propRooms.length > 0 ? propRooms : getLocalRooms()));

  const defaultYearMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const initialYearMonth = () => {
    if (!payment?.billing_period_month) return defaultYearMonth();
    if (/^\d{4}-\d{2}/.test(payment.billing_period_month)) {
      return payment.billing_period_month.slice(0, 7);
    }
    return defaultYearMonth();
  };

  // Initial State Setup
  const [selectedTenantId, setSelectedTenantId] = useState(() => 
    payment?.tenant_id || preselectedTenantId || (tenants[0]?.id || '')
  );

  const initialTenant = tenants.find((t) => t.id === selectedTenantId) || tenants[0];
  const initialRoomId = payment?.room_id || preselectedRoomId || (initialTenant?.room_id || rooms[0]?.id || '');
  const initialDue = payment?.amount_due !== undefined ? payment.amount_due : (initialTenant?.monthly_rent || 0);

  const profile = getLandlordProfile();
  const defaultReceiver = profile.name ? `${profile.name} (Owner)` : 'Landlord';

  const [paymentType, setPaymentType] = useState<PaymentType>(() => payment?.payment_type || 'RENT');
  const [selectedRoomId, setSelectedRoomId] = useState(initialRoomId);
  const [billingMonthYear, setBillingMonthYear] = useState(initialYearMonth);
  const [amountDue, setAmountDue] = useState(() => String(initialDue));
  const [amountPaid, setAmountPaid] = useState(() => String(payment?.amount_paid ?? initialDue));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() => payment?.payment_method || 'UPI');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(() => payment?.payment_status || 'PAID');
  const [receivedBy, setReceivedBy] = useState<PaymentReceiver>(() => payment?.received_by || defaultReceiver);
  const [transactionRef, setTransactionRef] = useState(() => payment?.transaction_ref || '');
  const [paymentDate, setPaymentDate] = useState(() => payment?.payment_date || new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState(() => payment?.notes || '');

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  // Handle switching payment category with intelligent auto-fill
  const handleCategoryChange = (newType: PaymentType) => {
    setPaymentType(newType);
    const activeTenant = tenants.find((t) => t.id === selectedTenantId);
    
    if (newType === 'RENT') {
      const rent = activeTenant?.monthly_rent || 0;
      if (rent > 0) {
        setAmountDue(String(rent));
        setAmountPaid(String(rent));
      }
      if (!notes || notes.includes('Advance') || notes.includes('Maintenance')) {
        setNotes('Monthly Rent');
      }
    } else if (newType === 'MAINTENANCE') {
      if (!amountDue || amountDue === String(activeTenant?.monthly_rent)) {
        setAmountDue('1000');
        setAmountPaid('1000');
      }
      setNotes('Monthly Maintenance (Water & Cleaning)');
    } else if (newType === 'SECURITY_DEPOSIT') {
      const dep = activeTenant?.security_deposit_paid || (activeTenant?.monthly_rent ? activeTenant.monthly_rent * 2 : 20000);
      setAmountDue(String(dep));
      setAmountPaid(String(dep));
      setNotes('Move-in Security Deposit / Advance Payment');
    } else if (newType === 'ELECTRICITY') {
      if (!notes) setNotes('EB Electricity Bill (Meter units)');
    }
  };

  const handleAppendNote = (tag: string) => {
    setNotes((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return tag;
      if (trimmed.includes(tag)) return trimmed;
      return `${trimmed} • ${tag}`;
    });
  };

  // When user changes tenant, automatically fill their room & monthly rent
  const handleTenantSelect = (tenantId: string) => {
    setSelectedTenantId(tenantId);
    const chosen = tenants.find((t) => t.id === tenantId);
    if (chosen) {
      if (chosen.room_id) setSelectedRoomId(chosen.room_id);
      if (paymentType === 'RENT' && chosen.monthly_rent) {
        setAmountDue(String(chosen.monthly_rent));
        setAmountPaid(String(chosen.monthly_rent));
      } else if (paymentType === 'SECURITY_DEPOSIT') {
        const dep = chosen.security_deposit_paid || (chosen.monthly_rent ? chosen.monthly_rent * 2 : 20000);
        setAmountDue(String(dep));
        setAmountPaid(String(dep));
      }
    }
  };

  const dueNum = Number(amountDue) || 0;
  const paidNum = Number(amountPaid) || 0;
  const pendingNum = Math.max(0, dueNum - paidNum);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const activeTenant = tenants.find((t) => t.id === selectedTenantId);
    const activeRoom = rooms.find((r) => r.id === selectedRoomId);

    // Standardize billing_period_month to YYYY-MM-01 (Postgres DATE requirement)
    const isoBillingPeriod = `${billingMonthYear}-01`;
    const billingDisplay = new Date(`${billingMonthYear}-15`).toLocaleString('en-IN', { month: 'long', year: 'numeric' });

    let finalPaymentId = payment?.id || `pay-${Date.now()}`;

    const paymentRecord: Payment = {
      id: finalPaymentId,
      tenant_id: selectedTenantId,
      room_id: selectedRoomId,
      payment_type: paymentType,
      billing_period_month: isoBillingPeriod,
      billing_month: billingDisplay,
      amount_due: dueNum,
      amount_paid: paidNum,
      amount_pending: pendingNum,
      payment_status: paymentStatus,
      payment_date: paymentDate,
      payment_method: paymentMethod,
      received_by: receivedBy,
      transaction_ref: transactionRef || null,
      notes: notes || null,
      created_at: payment?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tenant: activeTenant,
      room: activeRoom,
    };

    // 1. Save in local store
    saveLocalPayment(paymentRecord);

    // 2. Sync to Supabase
    try {
      const supabase = createClient();
      const payload: Record<string, unknown> = {
        tenant_id: paymentRecord.tenant_id,
        room_id: paymentRecord.room_id,
        payment_type: paymentRecord.payment_type || 'RENT',
        billing_period_month: isoBillingPeriod,
        amount_due: paymentRecord.amount_due,
        amount_paid: paymentRecord.amount_paid,
        payment_status: paymentRecord.payment_status,
        payment_date: paymentRecord.payment_date,
        payment_method: paymentRecord.payment_method,
        received_by: paymentRecord.received_by,
        transaction_ref: paymentRecord.transaction_ref,
        notes: paymentRecord.notes,
      };

      if (paymentRecord.id && !paymentRecord.id.startsWith('pay-')) {
        payload.id = paymentRecord.id;
      }

      let { data: dbData, error: dbErr } = await supabase
        .from('payments')
        .upsert(payload)
        .select()
        .single();

      // If remote Supabase table has old enum on received_by, fallback to 'LANDLORD'
      if (dbErr && (dbErr.message?.includes('payment_receiver') || dbErr.code === '22P02')) {
        payload.received_by = 'LANDLORD';
        const retry = await supabase.from('payments').upsert(payload).select().single();
        dbData = retry.data;
        dbErr = retry.error;
      }

      if (!dbErr && dbData?.id) {
        finalPaymentId = dbData.id;
        paymentRecord.id = dbData.id;
        // Keep local cache synced with real database UUID
        saveLocalPayment(paymentRecord);
      }
    } catch (err) {
      console.warn('Supabase payment sync note:', err);
    }

    setSaving(false);
    setSuccess(true);
    if (onSaved) onSaved(paymentRecord);

    setTimeout(() => {
      setSuccess(false);
      onClose();
    }, 600);
  };

  const activeCategory = CATEGORY_OPTIONS.find((c) => c.value === paymentType) || CATEGORY_OPTIONS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white border border-slate-300 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white text-base">
              {activeCategory.icon}
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                {payment ? `Edit ${activeCategory.label} Record` : `Record ${activeCategory.label}`}
              </h2>
              <p className="text-[11px] text-slate-300">
                Log {activeCategory.desc.toLowerCase()} & receipts
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Payment transaction saved successfully!</span>
            </div>
          )}

          {/* Payment Category / Purpose */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-600" />
                Amount Type / Purpose *
              </span>
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                {activeCategory.label}
              </span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORY_OPTIONS.map((cat) => {
                const isSelected = paymentType === cat.value;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => handleCategoryChange(cat.value)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all text-left cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-600 text-indigo-900 shadow-xs ring-1 ring-indigo-600'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400'
                    }`}
                  >
                    <span className="text-base">{cat.icon}</span>
                    <div className="min-w-0">
                      <span className="block leading-tight font-bold truncate">{cat.label}</span>
                      <span className="text-[10px] font-medium text-slate-500 block leading-tight truncate">
                        {cat.desc}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tenant & Room Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-indigo-600" /> Tenant *
              </label>
              <select
                value={selectedTenantId}
                onChange={(e) => handleTenantSelect(e.target.value)}
                required
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:border-indigo-600"
              >
                {tenants.length === 0 && <option value="">-- No tenants registered --</option>}
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name} ({t.tenant_type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" /> Room *
              </label>
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                required
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:border-indigo-600"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    Room {r.room_number} (Fl {r.floor})
                  </option>
                ))}
              </select>
            </div>

            {(() => {
              const activeTenant = tenants.find((t) => t.id === selectedTenantId);
              if (!activeTenant) return null;
              const due = activeTenant.rent_due_day || 5;
              const suffix = due === 1 ? 'st' : due === 2 ? 'nd' : due === 3 ? 'rd' : 'th';
              return (
                <div className="sm:col-span-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs flex flex-wrap items-center justify-between text-indigo-950 font-medium">
                  <span>
                    Monthly Rent: <strong>₹{Number(activeTenant.monthly_rent).toLocaleString('en-IN')}</strong>
                  </span>
                  <span className="font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                    📅 Rent Due: {due}{suffix} of every month
                  </span>
                </div>
              );
            })()}
          </div>

          {/* Billing Period & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" /> Month / Period *
              </label>
              <input
                type="month"
                required
                value={billingMonthYear}
                onChange={(e) => setBillingMonthYear(e.target.value)}
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:border-indigo-600"
              />
              <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">
                Period: {new Date(`${billingMonthYear}-15`).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Payment Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          {/* Financial Amounts */}
          <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-0.5">
                <IndianRupee className="w-3 h-3 text-slate-600" /> Amount Due *
              </label>
              <input
                type="number"
                required
                value={amountDue}
                onChange={(e) => setAmountDue(e.target.value)}
                className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-emerald-800 mb-1 flex items-center gap-0.5">
                <IndianRupee className="w-3 h-3 text-emerald-600" /> Paid (₹) *
              </label>
              <input
                type="number"
                required
                value={amountPaid}
                onChange={(e) => {
                  const val = e.target.value;
                  setAmountPaid(val);
                  const pNum = Number(val) || 0;
                  if (pNum >= dueNum && dueNum > 0) setPaymentStatus('PAID');
                  else if (pNum > 0) setPaymentStatus('PARTIAL');
                  else setPaymentStatus('PENDING');
                }}
                className="w-full text-xs font-bold border border-emerald-300 rounded-lg p-2 bg-white text-emerald-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Pending (₹)</label>
              <div className="w-full text-xs font-black p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-800">
                ₹{pendingNum.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Payment Method & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:border-indigo-600"
              >
                <option value="UPI">UPI (GPay/PhonePe)</option>
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank NEFT/IMPS</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Payment Status</label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:border-indigo-600"
              >
                <option value="PAID">PAID</option>
                <option value="PARTIAL">PARTIAL</option>
                <option value="PENDING">PENDING</option>
                <option value="OVERDUE">OVERDUE</option>
              </select>
            </div>
          </div>

          {/* Received By (Who Took the Money) */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                Who Took / Received the Money? *
              </label>
              <span className="text-[10px] text-slate-500 font-semibold">Write name or choose preset</span>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5">
              {[
                profile.name ? `${profile.name} (Owner)` : 'Landlord (Direct)',
                'Caretaker',
                'Property Manager',
                'Self',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setReceivedBy(preset)}
                  className="px-2 py-0.5 rounded-md bg-white hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 text-slate-700 text-[10px] font-semibold border border-slate-300 transition-colors cursor-pointer"
                >
                  + {preset}
                </button>
              ))}
            </div>

            <input
              type="text"
              required
              value={receivedBy}
              onChange={(e) => setReceivedBy(e.target.value)}
              placeholder="Write the name of person who took money (e.g. Dhanush, Suresh Caretaker, Watchman)"
              className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:border-indigo-600"
            />
          </div>

          {/* Transaction Ref */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">UPI Ref / UTR # (Optional)</label>
            <input
              type="text"
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              placeholder="e.g. 12-digit UPI transaction reference or Cheque number"
              className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:border-indigo-600"
            />
          </div>

          {/* Notes & Remarks with Quick Suggestions */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                Notes & Remarks
              </label>
              <span className="text-[10px] text-slate-500 font-semibold">Click quick tag to append</span>
            </div>

            {/* Quick Note Tags */}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_NOTE_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleAppendNote(tag)}
                  className="px-2 py-0.5 rounded-md bg-white hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 text-slate-700 text-[10px] font-semibold border border-slate-300 transition-colors cursor-pointer"
                >
                  + {tag}
                </button>
              ))}
            </div>

            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Paid via GPay, includes water charges & cleaning for March"
              className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:border-indigo-600 resize-none"
            />
          </div>

          {/* Footer Buttons */}
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
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : `Save ${activeCategory.label}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
