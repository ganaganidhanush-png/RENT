'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, Plus, Edit3, Trash2, 
  CheckCircle2, AlertCircle, RefreshCw, CreditCard, Receipt,
  Tag, FileText
} from 'lucide-react';
import { Payment, PaymentType, Tenant, Room } from '@/types/database';
import { 
  getLocalPayments, saveLocalPayment, deleteLocalPayment, 
  getLocalTenants, getLocalRooms, mergeTenants, mergeRooms 
} from '@/lib/store/app-store';
import { createClient } from '@/lib/supabase/client';
import RecordPaymentModal from '@/components/payments/record-payment-modal';
import RentReceiptModal from '@/components/payments/rent-receipt-modal';

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>(() => {
    if (typeof window !== 'undefined') return getLocalPayments();
    return [];
  });
  const [tenants, setTenants] = useState<Tenant[]>(() => {
    if (typeof window !== 'undefined') return getLocalTenants();
    return [];
  });
  const [rooms, setRooms] = useState<Room[]>(() => {
    if (typeof window !== 'undefined') return getLocalRooms();
    return [];
  });

  const [categoryFilter, setCategoryFilter] = useState<'ALL' | PaymentType>('ALL');
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  const deduplicate = (remoteList: Payment[], localList: Payment[]): Payment[] => {
    const merged = [...remoteList];
    for (const lp of localList) {
      const alreadyExists = merged.some((m) => {
        if (m.id === lp.id) return true;
        // If local had a temporary pay- timestamp id, check if remote already has the exact same transaction
        const sameTenant = m.tenant_id === lp.tenant_id;
        const sameAmount = Number(m.amount_paid) === Number(lp.amount_paid);
        const sameDate = (m.payment_date || '').slice(0, 10) === (lp.payment_date || '').slice(0, 10);
        const sameType = (m.payment_type || 'RENT') === (lp.payment_type || 'RENT');
        return sameTenant && sameAmount && sameDate && sameType && m.id !== lp.id && !m.id.startsWith('pay-');
      });
      if (!alreadyExists) {
        merged.push(lp);
      }
    }
    return merged;
  };

  const loadAllData = async () => {
    const localT = getLocalTenants();
    const localR = getLocalRooms();
    const localP = getLocalPayments();
    setTenants(localT);
    setRooms(localR);
    setPayments(localP);

    try {
      const supabase = createClient();
      const [payRes, tenRes, roomRes] = await Promise.allSettled([
        supabase.from('payments').select('*, room:rooms(*), tenant:tenants(*)').order('created_at', { ascending: false }),
        supabase.from('tenants').select('*, room:rooms(*)').order('created_at', { ascending: false }),
        supabase.from('rooms').select('*').order('room_number', { ascending: true }),
      ]);

      let mergedT = localT;
      if (tenRes.status === 'fulfilled' && !tenRes.value.error && tenRes.value.data) {
        mergedT = mergeTenants(localT, tenRes.value.data);
        setTenants(mergedT);
      }

      if (roomRes.status === 'fulfilled' && !roomRes.value.error && roomRes.value.data) {
        setRooms(mergeRooms(localR, roomRes.value.data, mergedT));
      }

      if (payRes.status === 'fulfilled' && !payRes.value.error && payRes.value.data && payRes.value.data.length > 0) {
        setPayments(deduplicate(payRes.value.data, localP));
      }
    } catch (err) {
      console.warn('Payments load data note:', err);
    }
  };

  useEffect(() => {
    loadAllData();

    const handleDataChange = () => {
      loadAllData();
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

  const handleQuickMarkPaid = async (p: Payment) => {
    const today = new Date().toISOString().split('T')[0];
    const updated: Payment = {
      ...p,
      amount_paid: p.amount_due,
      amount_pending: 0,
      payment_status: 'PAID',
      payment_date: today,
      updated_at: new Date().toISOString(),
    };
    saveLocalPayment(updated);
    handlePaymentSaved(updated);

    try {
      const supabase = createClient();
      if (p.id && !p.id.startsWith('pay-')) {
        await supabase
          .from('payments')
          .update({
            amount_paid: p.amount_due,
            amount_pending: 0,
            payment_status: 'PAID',
            payment_date: today,
            updated_at: new Date().toISOString(),
          })
          .eq('id', p.id);
      }
    } catch (err) {
      console.warn('Supabase mark paid sync note:', err);
    }
  };

  const rentCount = payments.filter((p) => (p.payment_type || 'RENT') === 'RENT').length;
  const maintCount = payments.filter((p) => p.payment_type === 'MAINTENANCE').length;
  const depositCount = payments.filter((p) => p.payment_type === 'SECURITY_DEPOSIT').length;
  const elecCount = payments.filter((p) => p.payment_type === 'ELECTRICITY').length;
  const otherCount = payments.filter((p) => p.payment_type === 'OTHER').length;

  const filteredPayments = categoryFilter === 'ALL'
    ? payments
    : payments.filter((p) => (p.payment_type || 'RENT') === categoryFilter);

  const totalCollected = filteredPayments.reduce((acc, p) => acc + Number(p.amount_paid || 0), 0);

  // Accurately compute outstanding dues without stacking historical slice snapshots
  const cyclePendingMap = new Map<string, number>();
  for (const p of filteredPayments) {
    const periodKey = (p.billing_period_month || p.billing_month || p.id).slice(0, 7);
    const key = `${p.tenant_id || ''}_${periodKey}_${p.payment_type || 'RENT'}`;
    const pending = Number(p.amount_pending || 0);

    if (p.payment_status === 'PAID' || pending === 0) {
      cyclePendingMap.set(key, 0);
    } else {
      const cur = cyclePendingMap.get(key);
      if (cur === undefined || (cur > 0 && pending < cur)) {
        cyclePendingMap.set(key, pending);
      }
    }
  }
  const totalPending = Array.from(cyclePendingMap.values()).reduce((sum, v) => sum + v, 0);
  const totalDue = totalCollected + totalPending;

  const getCategoryBadge = (type?: PaymentType) => {
    switch (type) {
      case 'MAINTENANCE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
            🛠️ Maintenance
          </span>
        );
      case 'SECURITY_DEPOSIT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-900 border border-purple-300">
            🔐 Advance / Deposit
          </span>
        );
      case 'ELECTRICITY':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-50 text-cyan-900 border border-cyan-300">
            ⚡ Electricity
          </span>
        );
      case 'OTHER':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
            📝 Other
          </span>
        );
      case 'RENT':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-900 border border-indigo-200">
            🏠 Rent
          </span>
        );
    }
  };

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
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Payment Ledger</h1>
            <p className="text-xs font-semibold text-slate-600 mt-0.5">
              Live rent receipts, maintenance, advance deposits, utility bills, and payment records
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
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            {categoryFilter === 'ALL' ? 'Total Billed Due' : `${categoryFilter} Due`}
          </span>
          <p className="text-2xl font-black text-slate-900 mt-1">₹{totalDue.toLocaleString('en-IN')}</p>
        </div>
        <div className="p-5 bg-white border-2 border-slate-200 rounded-2xl shadow-xs">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
            {categoryFilter === 'ALL' ? 'Total Collected Received' : `${categoryFilter} Collected`}
          </span>
          <p className="text-2xl font-black text-emerald-700 mt-1">₹{totalCollected.toLocaleString('en-IN')}</p>
        </div>
        <div className="p-5 bg-white border-2 border-slate-200 rounded-2xl shadow-xs">
          <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">
            {categoryFilter === 'ALL' ? 'Outstanding Dues' : `${categoryFilter} Pending`}
          </span>
          <p className="text-2xl font-black text-rose-700 mt-1">₹{totalPending.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: 'ALL', label: 'All Transactions', count: payments.length },
          { id: 'RENT', label: '🏠 Rent', count: rentCount },
          { id: 'MAINTENANCE', label: '🛠️ Maintenance', count: maintCount },
          { id: 'SECURITY_DEPOSIT', label: '🔐 Advance / Deposit', count: depositCount },
          { id: 'ELECTRICITY', label: '⚡ Electricity', count: elecCount },
          { id: 'OTHER', label: '📝 Other', count: otherCount },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setCategoryFilter(tab.id as 'ALL' | PaymentType)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              categoryFilter === tab.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span>{tab.label}</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              categoryFilter === tab.id ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Payment Transactions ({filteredPayments.length})
          </h2>
          <button
            type="button"
            onClick={loadAllData}
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
                <th className="py-3 px-4">Type / Purpose</th>
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
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-slate-600 font-semibold">
                    <CreditCard className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-900">
                      {categoryFilter === 'ALL'
                        ? 'No payment transactions recorded yet'
                        : `No ${categoryFilter} records logged yet`}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Click below to record a payment or receipt</p>
                    <button
                      type="button"
                      onClick={handleNewClick}
                      className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Record Payment
                    </button>
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => {
                  const isPaid = p.payment_status === 'PAID';
                  const isPending = p.payment_status === 'PENDING';
                  const tenantObj = p.tenant || tenants.find((t) => t.id === p.tenant_id);
                  const roomObj = p.room || rooms.find((r) => r.id === p.room_id) || tenantObj?.room;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 block">
                          {roomObj?.room_number ? `Room ${roomObj.room_number}` : 'Room Unit'}
                        </span>
                        <span className="text-[11px] text-slate-600 font-semibold block">
                          {tenantObj?.full_name || 'Tenant'}
                        </span>
                        {p.notes && (
                          <div className="mt-1 flex items-start gap-1 text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 max-w-xs">
                            <FileText className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                            <span className="truncate" title={p.notes}>{p.notes}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {getCategoryBadge(p.payment_type)}
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
                          <button
                            type="button"
                            onClick={() => {
                              setReceiptPayment(p);
                              setIsReceiptOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-[11px] font-bold border border-slate-300 transition-colors cursor-pointer"
                            title="Generate rent receipt and share on WhatsApp"
                          >
                            <Receipt className="w-3.5 h-3.5 text-indigo-600" /> Receipt
                          </button>

                          {!isPaid && (
                            <button
                              type="button"
                              onClick={() => handleQuickMarkPaid(p)}
                              className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold border border-emerald-200 transition-colors"
                              title="Mark full amount as paid"
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
          tenants={tenants}
          rooms={rooms}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingPayment(null);
          }}
          onSaved={handlePaymentSaved}
        />
      )}

      {/* Rent Receipt Modal */}
      {isReceiptOpen && receiptPayment && (
        <RentReceiptModal
          payment={receiptPayment}
          tenant={receiptPayment.tenant || tenants.find((t) => t.id === receiptPayment.tenant_id)}
          room={receiptPayment.room || rooms.find((r) => r.id === receiptPayment.room_id)}
          isOpen={isReceiptOpen}
          onClose={() => {
            setIsReceiptOpen(false);
            setReceiptPayment(null);
          }}
        />
      )}
    </div>
  );
}
