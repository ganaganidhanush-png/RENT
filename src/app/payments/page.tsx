'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, Plus, Edit3, Trash2, 
  CheckCircle2, AlertCircle, RefreshCw, CreditCard 
} from 'lucide-react';
import { Payment } from '@/types/database';
import { getLocalPayments, saveLocalPayment, deleteLocalPayment } from '@/lib/store/app-store';
import { createClient } from '@/lib/supabase/client';
import RecordPaymentModal from '@/components/payments/record-payment-modal';

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>(() => {
    if (typeof window !== 'undefined') return getLocalPayments();
    return [];
  });
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadPayments = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('payments')
        .select('*, room:rooms(*), tenant:tenants(*)')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const local = getLocalPayments();
        const merged = [...data];
        for (const lp of local) {
          if (!merged.some((m) => m.id === lp.id)) {
            merged.push(lp);
          }
        }
        setPayments(merged);
      } else {
        setPayments(getLocalPayments());
      }
    } catch {
      setPayments(getLocalPayments());
    }
  };

  useEffect(() => {
    async function syncRemote() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('payments')
          .select('*, room:rooms(*), tenant:tenants(*)')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          const local = getLocalPayments();
          const merged = [...data];
          for (const lp of local) {
            if (!merged.some((m) => m.id === lp.id)) {
              merged.push(lp);
            }
          }
          setPayments(merged);
        }
      } catch (err) {
        console.warn('Payments sync note:', err);
      }
    }

    syncRemote();

    const handleDataChange = () => {
      setPayments(getLocalPayments());
    };

    window.addEventListener('rentvault_data_updated', handleDataChange);
    return () => window.removeEventListener('rentvault_data_updated', handleDataChange);
  }, []);

  const handleEditClick = (payment: Payment) => {
    setEditingPayment(payment);
    setIsModalOpen(true);
  };

  const handleNewClick = () => {
    setEditingPayment(null);
    setIsModalOpen(true);
  };

  const handlePaymentSaved = (saved: Payment) => {
    setPayments((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = saved;
        return updated;
      }
      return [saved, ...prev];
    });
  };

  const handleDeleteClick = async (paymentId: string) => {
    if (confirm('Are you sure you want to remove this payment entry?')) {
      deleteLocalPayment(paymentId);
      setPayments((prev) => prev.filter((p) => p.id !== paymentId));
      try {
        const supabase = createClient();
        await supabase.from('payments').delete().eq('id', paymentId);
      } catch (err) {
        console.warn('Supabase delete note:', err);
      }
    }
  };

  const handleQuickMarkPaid = (p: Payment) => {
    const updated: Payment = {
      ...p,
      amount_paid: p.amount_due,
      amount_pending: 0,
      payment_status: 'PAID',
      payment_date: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    };
    saveLocalPayment(updated);
    handlePaymentSaved(updated);
  };

  const totalCollected = payments.reduce((acc, p) => acc + Number(p.amount_paid || 0), 0);
  const totalPending = payments.reduce((acc, p) => acc + Number(p.amount_pending || 0), 0);
  const totalDue = payments.reduce((acc, p) => acc + Number(p.amount_due || 0), 0);

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
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Rent Payment Ledger</h1>
            <p className="text-xs font-semibold text-slate-600 mt-0.5">
              Live rent receipts, dues, UPI / Cash transaction records, and editable ledger entries
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleNewClick}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Record Payment
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white border-2 border-slate-200 rounded-2xl shadow-xs">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Total Billed Due</span>
          <p className="text-2xl font-black text-slate-900 mt-1">₹{totalDue.toLocaleString('en-IN')}</p>
        </div>
        <div className="p-5 bg-white border-2 border-slate-200 rounded-2xl shadow-xs">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Total Collections Received</span>
          <p className="text-2xl font-black text-emerald-700 mt-1">₹{totalCollected.toLocaleString('en-IN')}</p>
        </div>
        <div className="p-5 bg-white border-2 border-slate-200 rounded-2xl shadow-xs">
          <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">Outstanding Dues</span>
          <p className="text-2xl font-black text-rose-700 mt-1">₹{totalPending.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Payment Transactions ({payments.length})
          </h2>
          <button
            type="button"
            onClick={loadPayments}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
              <tr>
                <th className="py-3 px-4">Room & Tenant</th>
                <th className="py-3 px-4">Billing Month</th>
                <th className="py-3 px-4">Amount Due</th>
                <th className="py-3 px-4">Amount Paid</th>
                <th className="py-3 px-4">Pending</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Receiver</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-slate-600 font-semibold">
                    <CreditCard className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-900">No payment transactions recorded yet</p>
                    <p className="text-xs text-slate-500 mt-1">Click below to record your first rent collection or receipt</p>
                    <button
                      type="button"
                      onClick={handleNewClick}
                      className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Record Rent Payment
                    </button>
                  </td>
                </tr>
              ) : (
                payments.map((p) => {
                  const isPaid = p.payment_status === 'PAID';
                  const isPending = p.payment_status === 'PENDING';

                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 block">
                          {p.room?.room_number ? `Room ${p.room.room_number}` : 'Room Unit'}
                        </span>
                        <span className="text-[11px] text-slate-600 font-semibold block">
                          {p.tenant?.full_name || 'Tenant'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-bold">{p.billing_period_month}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        ₹{Number(p.amount_due).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 font-black text-emerald-700">
                        ₹{Number(p.amount_paid).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-rose-600">
                        ₹{Number(p.amount_pending || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800">
                          {p.payment_method || 'UPI'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-semibold">
                        {p.received_by || 'LANDLORD'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isPaid
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : isPending
                              ? 'bg-rose-100 text-rose-900 border border-rose-300'
                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}
                        >
                          {isPaid ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <AlertCircle className="w-3 h-3 text-rose-600" />}
                          {p.payment_status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isPaid && (
                            <button
                              type="button"
                              onClick={() => handleQuickMarkPaid(p)}
                              className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold border border-emerald-200 transition-colors"
                              title="Mark full rent as paid"
                            >
                              Mark Paid
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleEditClick(p)}
                            className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 transition-colors cursor-pointer"
                            title="Edit payment entry"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(p.id)}
                            className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition-colors cursor-pointer"
                            title="Delete payment entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record / Edit Payment Modal */}
      {isModalOpen && (
        <RecordPaymentModal
          payment={editingPayment}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingPayment(null);
          }}
          onSaved={handlePaymentSaved}
        />
      )}
    </div>
  );
}
