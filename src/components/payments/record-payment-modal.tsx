'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, IndianRupee, User, Building2, Calendar, 
  CheckCircle2, Save, CreditCard, Tag, FileText, UserCheck,
  Sparkles, Layers, AlertCircle, Clock, Check, ShieldCheck
} from 'lucide-react';
import { Payment, Tenant, Room, PaymentMethod, PaymentStatus, PaymentReceiver, PaymentType } from '@/types/database';
import { 
  getLocalTenants, getLocalRooms, getLocalPayments, saveLocalPayment, 
  getLandlordProfile, isTenantMoveInThisMonth, getNextYearMonth, getDefaultRentBillingMonth 
} from '@/lib/store/app-store';
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
  'Advance Token (Slice 1)',
  'Advance Installment (Slice 2)',
  'Advance Final Settlement',
  'EB Meter Bill',
  'Full Settlement',
  'Partial Payment (Balance Pending)',
];

function generateSlicePresets(remaining: number, total: number): number[] {
  if (remaining <= 0) return [total];
  const presets: number[] = [remaining];
  
  if (remaining > 10000) presets.push(10000);
  if (remaining > 5000 && !presets.includes(5000)) presets.push(5000);
  if (remaining > 2000 && !presets.includes(2000) && presets.length < 4) presets.push(2000);
  const half = Math.round(remaining / 2);
  if (half > 1000 && !presets.includes(half) && presets.length < 4) presets.push(half);
  
  return Array.from(new Set(presets)).sort((a, b) => b - a);
}

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
  const [tenants, setTenants] = useState<Tenant[]>(() => (propTenants && propTenants.length > 0 ? propTenants : getLocalTenants()));
  const [rooms, setRooms] = useState<Room[]>(() => (propRooms && propRooms.length > 0 ? propRooms : getLocalRooms()));
  const [allPayments, setAllPayments] = useState<Payment[]>(() => getLocalPayments());

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

  const profile = getLandlordProfile();
  const defaultReceiver = profile.name ? `${profile.name} (Owner)` : 'Landlord';

  // Initial State Setup
  const [selectedTenantId, setSelectedTenantId] = useState(() => 
    payment?.tenant_id || preselectedTenantId || (tenants[0]?.id || '')
  );

  const initialTenant = tenants.find((t) => t.id === selectedTenantId) || tenants[0];
  const initialRoomId = payment?.room_id || preselectedRoomId || (initialTenant?.room_id || rooms[0]?.id || '');
  const initialDue = payment?.amount_due !== undefined ? payment.amount_due : (initialTenant?.monthly_rent || 0);

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

  // Re-sync all state when modal opens
  useEffect(() => {
    if (isOpen) {
      const currentTenants = propTenants && propTenants.length > 0 ? propTenants : getLocalTenants();
      const currentRooms = propRooms && propRooms.length > 0 ? propRooms : getLocalRooms();
      setTenants(currentTenants);
      setRooms(currentRooms);
      setAllPayments(getLocalPayments());

      const tId = payment?.tenant_id || preselectedTenantId || (currentTenants[0]?.id || '');
      const activeT = currentTenants.find((t) => t.id === tId) || currentTenants[0];
      const rId = payment?.room_id || preselectedRoomId || (activeT?.room_id || currentRooms[0]?.id || '');
      const defaultDue = payment?.amount_due !== undefined ? payment.amount_due : (activeT?.monthly_rent || 0);

      setSelectedTenantId(tId);
      setSelectedRoomId(rId);
      setPaymentType(payment?.payment_type || 'RENT');
      setBillingMonthYear(
        payment?.billing_period_month && /^\d{4}-\d{2}/.test(payment.billing_period_month)
          ? payment.billing_period_month.slice(0, 7)
          : (activeT && (payment?.payment_type || 'RENT') === 'RENT'
              ? getDefaultRentBillingMonth(activeT)
              : defaultYearMonth())
      );
      setAmountDue(String(defaultDue));
      setAmountPaid(String(payment?.amount_paid ?? defaultDue));
      setPaymentMethod(payment?.payment_method || 'UPI');
      setPaymentStatus(payment?.payment_status || 'PAID');
      setReceivedBy(payment?.received_by || defaultReceiver);
      setTransactionRef(payment?.transaction_ref || '');
      setPaymentDate(payment?.payment_date || new Date().toISOString().split('T')[0]);
      setNotes(payment?.notes || '');
      setSaving(false);
      setSuccess(false);
    }
  }, [isOpen, payment, preselectedTenantId, preselectedRoomId, propTenants, propRooms]);

  const activeTenant = tenants.find((t) => t.id === selectedTenantId);
  const activeRoom = rooms.find((r) => r.id === selectedRoomId);

  // 1. Advance / Security Deposit Smart Slices Calculations
  const targetAdvanceTotal = Number(activeTenant?.security_deposit_paid || activeRoom?.security_deposit || 20000);
  const pastAdvancePayments = allPayments.filter((p) =>
    p.tenant_id === selectedTenantId &&
    p.payment_type === 'SECURITY_DEPOSIT' &&
    Number(p.amount_paid) > 0 &&
    p.id !== payment?.id
  );
  const totalAdvanceCollectedSoFar = pastAdvancePayments.reduce(
    (acc, p) => acc + Number(p.amount_paid || 0),
    0
  );
  const remainingAdvanceToCollect = Math.max(0, targetAdvanceTotal - totalAdvanceCollectedSoFar);
  const nextAdvanceSliceIndex = pastAdvancePayments.length + 1;

  // 2. Rent Smart Slices Calculations
  const targetRentTotal = Number(activeTenant?.monthly_rent || activeRoom?.base_rent || 0);
  const pastRentPayments = allPayments.filter((p) =>
    p.tenant_id === selectedTenantId &&
    p.payment_type === 'RENT' &&
    (p.billing_period_month || '').slice(0, 7) === billingMonthYear &&
    Number(p.amount_paid) > 0 &&
    p.id !== payment?.id
  );
  const totalRentCollectedSoFar = pastRentPayments.reduce(
    (acc, p) => acc + Number(p.amount_paid || 0),
    0
  );
  const remainingRentToCollect = Math.max(0, targetRentTotal - totalRentCollectedSoFar);
  const nextRentSliceIndex = pastRentPayments.length + 1;

  if (!isOpen) return null;

  // Handle switching payment category with intelligent auto-fill
  const handleCategoryChange = (newType: PaymentType) => {
    setPaymentType(newType);
    
    if (newType === 'RENT') {
      if (activeTenant) {
        setBillingMonthYear(getDefaultRentBillingMonth(activeTenant));
      }
      const remaining = remainingRentToCollect > 0 ? remainingRentToCollect : targetRentTotal;
      if (remaining > 0) {
        setAmountDue(String(remaining));
        setAmountPaid(String(remaining));
      }
      if (totalRentCollectedSoFar > 0) {
        setNotes(`Monthly Rent - Slice #${nextRentSliceIndex} (Paid so far: ₹${totalRentCollectedSoFar.toLocaleString('en-IN')})`);
      } else if (!notes || notes.includes('Advance') || notes.includes('Maintenance')) {
        setNotes('Monthly Rent');
      }
    } else if (newType === 'MAINTENANCE') {
      if (!amountDue || amountDue === String(targetRentTotal)) {
        setAmountDue('1000');
        setAmountPaid('1000');
      }
      setNotes('Monthly Maintenance (Water & Cleaning)');
    } else if (newType === 'SECURITY_DEPOSIT') {
      const remaining = remainingAdvanceToCollect > 0 ? remainingAdvanceToCollect : targetAdvanceTotal;
      setAmountDue(String(remaining));
      setAmountPaid(String(remaining));
      if (totalAdvanceCollectedSoFar > 0) {
        setNotes(`Advance Deposit - Slice #${nextAdvanceSliceIndex} (Agreed: ₹${targetAdvanceTotal.toLocaleString('en-IN')}, Prev Paid: ₹${totalAdvanceCollectedSoFar.toLocaleString('en-IN')})`);
      } else {
        setNotes(`Advance / Security Deposit - Slice #1 (Agreed Total: ₹${targetAdvanceTotal.toLocaleString('en-IN')})`);
      }
    } else if (newType === 'ELECTRICITY') {
      if (!notes) setNotes('EB Electricity Bill (Meter units)');
    }
  };

  const handleApplySlice = (
    sliceAmount: number, 
    type: 'SECURITY_DEPOSIT' | 'RENT', 
    totalTarget: number, 
    alreadyCollected: number, 
    sliceIndex: number
  ) => {
    const remainingBefore = Math.max(0, totalTarget - alreadyCollected);
    setAmountDue(String(remainingBefore));
    setAmountPaid(String(sliceAmount));

    const remainingAfter = Math.max(0, remainingBefore - sliceAmount);
    if (remainingAfter === 0) {
      setPaymentStatus('PAID');
      if (type === 'SECURITY_DEPOSIT') {
        setNotes(`Advance Deposit - Slice #${sliceIndex} (Final Settlement • Fully Paid ₹${totalTarget.toLocaleString('en-IN')})`);
      } else {
        setNotes(`Monthly Rent - Slice #${sliceIndex} (Final Settlement • Fully Paid)`);
      }
    } else {
      setPaymentStatus('PARTIAL');
      if (type === 'SECURITY_DEPOSIT') {
        setNotes(`Advance Deposit - Slice #${sliceIndex} (Paid ₹${sliceAmount.toLocaleString('en-IN')} • Remaining Balance: ₹${remainingAfter.toLocaleString('en-IN')})`);
      } else {
        setNotes(`Monthly Rent - Slice #${sliceIndex} (Paid ₹${sliceAmount.toLocaleString('en-IN')} • Remaining Balance: ₹${remainingAfter.toLocaleString('en-IN')})`);
      }
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

  // When user changes tenant, automatically fill their room & monthly rent / advance
  const handleTenantSelect = (tenantId: string) => {
    setSelectedTenantId(tenantId);
    const chosen = tenants.find((t) => t.id === tenantId);
    if (chosen) {
      if (chosen.room_id) setSelectedRoomId(chosen.room_id);
      
      const chosenPastAdvance = allPayments.filter((p) =>
        p.tenant_id === tenantId &&
        p.payment_type === 'SECURITY_DEPOSIT' &&
        Number(p.amount_paid) > 0 &&
        p.id !== payment?.id
      );
      const chosenAdvancePaid = chosenPastAdvance.reduce((a, p) => a + Number(p.amount_paid || 0), 0);
      const chosenTargetAdvance = Number(chosen.security_deposit_paid || 20000);
      const chosenRemainingAdvance = Math.max(0, chosenTargetAdvance - chosenAdvancePaid);

      if (paymentType === 'RENT') {
        setBillingMonthYear(getDefaultRentBillingMonth(chosen));
        if (chosen.monthly_rent) {
          setAmountDue(String(chosen.monthly_rent));
          setAmountPaid(String(chosen.monthly_rent));
        }
      } else if (paymentType === 'SECURITY_DEPOSIT') {
        const amt = chosenRemainingAdvance > 0 ? chosenRemainingAdvance : chosenTargetAdvance;
        setAmountDue(String(amt));
        setAmountPaid(String(amt));
        if (chosenAdvancePaid > 0) {
          setNotes(`Advance Deposit - Slice #${chosenPastAdvance.length + 1} (Agreed: ₹${chosenTargetAdvance.toLocaleString('en-IN')}, Prev Paid: ₹${chosenAdvancePaid.toLocaleString('en-IN')})`);
        } else {
          setNotes(`Advance / Security Deposit - Slice #1 (Agreed Total: ₹${chosenTargetAdvance.toLocaleString('en-IN')})`);
        }
      }
    }
  };

  const dueNum = Math.max(0, Number(amountDue) || 0);
  const paidNum = Math.max(0, Number(amountPaid) || 0);
  const pendingNum = Math.max(0, dueNum - paidNum);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const isAdvance = paymentType === 'SECURITY_DEPOSIT';
    const isRent = paymentType === 'RENT';

    const sliceNumber = isAdvance 
      ? nextAdvanceSliceIndex 
      : (isRent && totalRentCollectedSoFar > 0 ? nextRentSliceIndex : 1);

    const totalTarget = isAdvance 
      ? targetAdvanceTotal 
      : (isRent ? targetRentTotal : dueNum);

    // Standardize billing_period_month to YYYY-MM-01 (Postgres DATE requirement)
    const isoBillingPeriod = `${billingMonthYear}-01`;
    const billingDisplay = new Date(`${billingMonthYear}-15`).toLocaleString('en-IN', { month: 'long', year: 'numeric' });

    let finalPaymentId = payment?.id || `pay-${Date.now()}`;

    const paymentRecord: Payment = {
      id: finalPaymentId,
      tenant_id: selectedTenantId,
      room_id: selectedRoomId,
      payment_type: paymentType,
      installment_number: sliceNumber,
      total_target_amount: totalTarget,
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
              {paymentType === 'RENT' && activeTenant && isTenantMoveInThisMonth(activeTenant) && (
                <div className="mt-1.5 p-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-[11px] font-medium flex items-center gap-1.5">
                  <span className="font-bold bg-blue-200 text-blue-900 px-1.5 py-0.5 rounded text-[10px] shrink-0">
                    ✨ Move-In Policy
                  </span>
                  <span>Joined {activeTenant.move_in_date || 'this month'}. First monthly rent is scheduled for next month.</span>
                </div>
              )}
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

          {/* Smart Advance / Security Deposit (One-Time Payment Tracker) */}
          {paymentType === 'SECURITY_DEPOSIT' && (
            <div className="p-4 bg-gradient-to-br from-purple-50 via-amber-50/40 to-orange-50/50 border-2 border-purple-300 rounded-xl space-y-3">
              {/* Advance Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-md bg-purple-700 text-white">
                    <ShieldCheck className="w-4 h-4" />
                  </span>
                  <div>
                    <span className="text-xs font-black text-purple-950 uppercase tracking-wide block">
                      One-Time Advance Deposit Tracker
                    </span>
                    <span className="text-[11px] text-purple-800 font-medium">
                      One-time move-in capital, separate from monthly recurring rent
                    </span>
                  </div>
                </div>
                <span className="text-xs font-black text-purple-950 bg-white px-2.5 py-1 rounded-lg border border-purple-200 shadow-2xs">
                  Agreed Total: ₹{targetAdvanceTotal.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Did they pay or not? Status Banner */}
              {targetAdvanceTotal > 0 && totalAdvanceCollectedSoFar >= targetAdvanceTotal ? (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-xs font-black text-emerald-950">
                        Advance Status: FULLY PAID (Done ✓)
                      </p>
                      <p className="text-[11px] text-emerald-800">
                        The entire agreed advance of ₹{targetAdvanceTotal.toLocaleString('en-IN')} was collected across {pastAdvancePayments.length} piece{pastAdvancePayments.length > 1 ? 's' : ''}.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-600 text-white text-[11px] font-black rounded-lg shrink-0">
                    Done ✓
                  </span>
                </div>
              ) : totalAdvanceCollectedSoFar > 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-xs font-black text-amber-950">
                        Advance Status: PARTIALLY PAID IN PIECES ({pastAdvancePayments.length} piece{pastAdvancePayments.length > 1 ? 's' : ''} paid)
                      </p>
                      <p className="text-[11px] text-amber-800">
                        ₹{totalAdvanceCollectedSoFar.toLocaleString('en-IN')} paid so far. <strong>₹{remainingAdvanceToCollect.toLocaleString('en-IN')} is NOT PAID</strong> yet.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-amber-500 text-white text-[11px] font-bold rounded-lg shrink-0">
                    Partial
                  </span>
                </div>
              ) : (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                    <div>
                      <p className="text-xs font-black text-rose-950">
                        Advance Status: NOT PAID YET
                      </p>
                      <p className="text-[11px] text-rose-800">
                        Zero advance paid so far. Full amount <strong>₹{targetAdvanceTotal.toLocaleString('en-IN')}</strong> is unpaid.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-rose-600 text-white text-[11px] font-bold rounded-lg shrink-0">
                    Unpaid
                  </span>
                </div>
              )}

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 bg-white rounded-lg border border-purple-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Agreed Target</span>
                  <span className="font-extrabold text-slate-900 block mt-0.5">₹{targetAdvanceTotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-purple-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Paid So Far</span>
                  <span className="font-extrabold text-emerald-700 block mt-0.5">₹{totalAdvanceCollectedSoFar.toLocaleString('en-IN')}</span>
                  <span className="text-[9px] text-slate-400 block font-medium mt-0.5">({pastAdvancePayments.length} piece{pastAdvancePayments.length !== 1 ? 's' : ''})</span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-purple-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Remaining Unpaid</span>
                  <span className={`font-extrabold block mt-0.5 ${remainingAdvanceToCollect > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {remainingAdvanceToCollect > 0 ? `₹${remainingAdvanceToCollect.toLocaleString('en-IN')}` : '₹0 (Done ✓)'}
                  </span>
                </div>
              </div>

              {/* When and how much: itemized pieces breakdown across different dates */}
              {pastAdvancePayments.length > 0 && (
                <div className="bg-white rounded-xl border border-purple-200 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-800 border-b border-slate-100 pb-1">
                    <span className="flex items-center gap-1 text-purple-900">
                      <Layers className="w-3.5 h-3.5" />
                      Pieces Paid Across Different Dates ({pastAdvancePayments.length}):
                    </span>
                    <span className="text-emerald-700 font-extrabold">₹{totalAdvanceCollectedSoFar.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-32 overflow-y-auto">
                    {pastAdvancePayments
                      .sort((a, b) => new Date(a.payment_date || '').getTime() - new Date(b.payment_date || '').getTime())
                      .map((piece, i) => (
                        <div key={piece.id || i} className="py-1.5 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-slate-900">
                              Piece #{piece.installment_number || i + 1}: ₹{Number(piece.amount_paid).toLocaleString('en-IN')}
                            </span>
                            <span className="text-[10px] text-slate-500 ml-1.5">
                              on {piece.payment_date ? new Date(piece.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'} via {piece.payment_method || 'UPI'}
                            </span>
                            {piece.notes && (
                              <span className="text-[10px] text-slate-400 block truncate max-w-[280px]">
                                {piece.notes}
                              </span>
                            )}
                          </div>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                            Paid ✓
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="w-full bg-purple-100 rounded-full h-2.5 overflow-hidden flex">
                  <div 
                    className="bg-emerald-600 h-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.round((totalAdvanceCollectedSoFar / (targetAdvanceTotal || 1)) * 100))}%` }}
                  />
                  {paidNum > 0 && (
                    <div 
                      className="bg-purple-600 h-full transition-all duration-300 opacity-90"
                      style={{ width: `${Math.min(100 - Math.min(100, Math.round((totalAdvanceCollectedSoFar / (targetAdvanceTotal || 1)) * 100)), Math.round((paidNum / (targetAdvanceTotal || 1)) * 100))}%` }}
                    />
                  )}
                </div>
                <div className="flex justify-between text-[11px] font-bold text-purple-950">
                  <span>
                    {Math.round(((totalAdvanceCollectedSoFar + paidNum) / (targetAdvanceTotal || 1)) * 100)}% Total Advance Paid
                  </span>
                  <span>
                    {Math.max(0, targetAdvanceTotal - totalAdvanceCollectedSoFar - paidNum) === 0 ? (
                      <span className="text-emerald-700 font-black">🎉 Advance count fully settled (Done ✓)!</span>
                    ) : (
                      <span className="text-purple-900 font-medium">₹{Math.max(0, targetAdvanceTotal - totalAdvanceCollectedSoFar - paidNum).toLocaleString('en-IN')} will remain unpaid</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Quick Slices Buttons (when balance remains) */}
              {remainingAdvanceToCollect > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-purple-200/60">
                  <span className="text-[11px] font-bold text-purple-900">Choose Piece Amount:</span>
                  {generateSlicePresets(remainingAdvanceToCollect, targetAdvanceTotal).map((sliceAmt) => (
                    <button
                      key={sliceAmt}
                      type="button"
                      onClick={() => handleApplySlice(sliceAmt, 'SECURITY_DEPOSIT', targetAdvanceTotal, totalAdvanceCollectedSoFar, nextAdvanceSliceIndex)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                        paidNum === sliceAmt
                          ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                          : 'bg-white text-purple-950 border-purple-300 hover:bg-purple-100'
                      }`}
                    >
                      {sliceAmt === remainingAdvanceToCollect ? `⚡ Full Remaining (₹${sliceAmt.toLocaleString('en-IN')})` : `+ ₹${sliceAmt.toLocaleString('en-IN')}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Smart Monthly Rent Slices Tracker (shown if partial payments exist for the month) */}
          {paymentType === 'RENT' && totalRentCollectedSoFar > 0 && (
            <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50/50 border-2 border-indigo-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-md bg-indigo-600 text-white">
                    <Sparkles className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <span className="text-xs font-black text-indigo-950 uppercase tracking-wide block">
                      Monthly Rent Slices Tracker
                    </span>
                    <span className="text-[11px] text-indigo-800 font-medium">
                      Slice #{nextRentSliceIndex} for {new Date(`${billingMonthYear}-15`).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-black text-indigo-950 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 shadow-2xs">
                  Monthly Rent: ₹{targetRentTotal.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 bg-white rounded-lg border border-indigo-100">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Monthly Rent</span>
                  <span className="font-extrabold text-slate-900 block mt-0.5">₹{targetRentTotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-indigo-100">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Already Paid</span>
                  <span className="font-extrabold text-emerald-700 block mt-0.5">₹{totalRentCollectedSoFar.toLocaleString('en-IN')}</span>
                  <span className="text-[9px] text-slate-400 block font-medium mt-0.5">({pastRentPayments.length} slice{pastRentPayments.length !== 1 ? 's' : ''})</span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-indigo-100">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Remaining Rent</span>
                  <span className="font-extrabold text-rose-700 block mt-0.5">₹{remainingRentToCollect.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Quick Slices Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-indigo-100">
                <span className="text-[11px] font-bold text-indigo-900">Choose Slice:</span>
                {generateSlicePresets(remainingRentToCollect, targetRentTotal).map((sliceAmt) => (
                  <button
                    key={sliceAmt}
                    type="button"
                    onClick={() => handleApplySlice(sliceAmt, 'RENT', targetRentTotal, totalRentCollectedSoFar, nextRentSliceIndex)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      paidNum === sliceAmt
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-indigo-950 border-indigo-300 hover:bg-indigo-100'
                    }`}
                  >
                    {sliceAmt === remainingRentToCollect ? `⚡ Full Remaining (₹${sliceAmt.toLocaleString('en-IN')})` : `+ ₹${sliceAmt.toLocaleString('en-IN')}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Financial Amounts */}
          <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-0.5">
                <IndianRupee className="w-3 h-3 text-slate-600" /> Amount Due *
              </label>
              <input
                type="number"
                min="0"
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
                min="0"
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
