'use client';

import React, { useState } from 'react';
import { 
  X, IndianRupee, User, Building2, Calendar, 
  CheckCircle2, Save, CreditCard
} from 'lucide-react';
import { Payment, Tenant, Room, PaymentMethod, PaymentStatus, PaymentReceiver } from '@/types/database';
import { getLocalTenants, getLocalRooms, saveLocalPayment } from '@/lib/store/app-store';
import { createClient } from '@/lib/supabase/client';

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

  const currentMonthStr = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  // Initial State Setup
  const [selectedTenantId, setSelectedTenantId] = useState(() => 
    payment?.tenant_id || preselectedTenantId || (tenants[0]?.id || '')
  );

  const initialTenant = tenants.find((t) => t.id === selectedTenantId) || tenants[0];
  const initialRoomId = payment?.room_id || preselectedRoomId || (initialTenant?.room_id || rooms[0]?.id || '');
  const initialDue = payment?.amount_due !== undefined ? payment.amount_due : (initialTenant?.monthly_rent || 0);

  const [selectedRoomId, setSelectedRoomId] = useState(initialRoomId);
  const [billingMonth, setBillingMonth] = useState(() => payment?.billing_period_month || currentMonthStr);
  const [amountDue, setAmountDue] = useState(() => String(initialDue));
  const [amountPaid, setAmountPaid] = useState(() => String(payment?.amount_paid ?? initialDue));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() => payment?.payment_method || 'UPI');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(() => payment?.payment_status || 'PAID');
  const [receivedBy, setReceivedBy] = useState<PaymentReceiver>(() => payment?.received_by || 'LANDLORD');
  const [transactionRef, setTransactionRef] = useState(() => payment?.transaction_ref || '');
  const [paymentDate, setPaymentDate] = useState(() => payment?.payment_date || new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState(() => payment?.notes || '');

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  // When user changes tenant, automatically fill their room & monthly rent
  const handleTenantSelect = (tenantId: string) => {
    setSelectedTenantId(tenantId);
    const chosen = tenants.find((t) => t.id === tenantId);
    if (chosen) {
      if (chosen.room_id) setSelectedRoomId(chosen.room_id);
      if (chosen.monthly_rent) {
        setAmountDue(String(chosen.monthly_rent));
        setAmountPaid(String(chosen.monthly_rent));
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

    const paymentRecord: Payment = {
      id: payment?.id || `pay-${Date.now()}`,
      tenant_id: selectedTenantId,
      room_id: selectedRoomId,
      billing_period_month: billingMonth,
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
      await supabase.from('payments').upsert({
        id: paymentRecord.id.startsWith('pay-') ? undefined : paymentRecord.id,
        tenant_id: paymentRecord.tenant_id,
        room_id: paymentRecord.room_id,
        billing_period_month: paymentRecord.billing_period_month,
        amount_due: paymentRecord.amount_due,
        amount_paid: paymentRecord.amount_paid,
        payment_status: paymentRecord.payment_status,
        payment_date: paymentRecord.payment_date,
        payment_method: paymentRecord.payment_method,
        received_by: paymentRecord.received_by,
        transaction_ref: paymentRecord.transaction_ref,
        notes: paymentRecord.notes,
      });
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white border border-slate-300 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                {payment ? 'Edit Payment Record' : 'Record Rent Payment'}
              </h2>
              <p className="text-[11px] text-slate-300">
                Log UPI, cash receipts & track dues
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
              <span>Payment transaction saved successfully!</span>
            </div>
          )}

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
          </div>

          {/* Billing Period & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" /> Billing Month *
              </label>
              <input
                type="text"
                required
                value={billingMonth}
                onChange={(e) => setBillingMonth(e.target.value)}
                placeholder="e.g. September 2026"
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:border-indigo-600"
              />
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none"
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
                className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none"
              >
                <option value="PAID">PAID</option>
                <option value="PARTIAL">PARTIAL</option>
                <option value="PENDING">PENDING</option>
                <option value="OVERDUE">OVERDUE</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Received By</label>
              <select
                value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value as PaymentReceiver)}
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none"
              >
                <option value="LANDLORD">Landlord (Direct)</option>
                <option value="MANAGER">Manager</option>
              </select>
            </div>
          </div>

          {/* Transaction Ref & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">UPI Ref / UTR # (Optional)</label>
              <input
                type="text"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                placeholder="e.g. 12-digit UPI reference"
                className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Paid on 1st, full settlement"
                className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none"
              />
            </div>
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
              {saving ? 'Saving...' : 'Save Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
