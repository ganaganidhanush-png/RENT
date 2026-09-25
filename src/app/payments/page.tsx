import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Payment } from '@/types/database';

export const revalidate = 0;

export default async function PaymentsPage() {
  const supabase = await createClient();

  let payments: Payment[] = [];

  try {
    const { data } = await supabase
      .from('payments')
      .select('*, room:rooms(*), tenant:tenants(*)')
      .order('created_at', { ascending: false });

    if (data) {
      payments = data;
    }
  } catch (err) {
    console.error('Error fetching payments:', err);
  }

  const totalCollected = payments.reduce((acc, p) => acc + Number(p.amount_paid || 0), 0);
  const totalPending = payments.reduce((acc, p) => acc + Number(p.amount_pending || 0), 0);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Rent Payment Ledger</h1>
            <p className="text-xs text-slate-500 mt-0.5">Track rent receipts, dues, payment modes, and collectors</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 bg-white border border-slate-300 rounded-xl shadow-xs">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Total Recorded Collections</span>
          <p className="text-2xl font-black text-emerald-700 mt-1">₹{totalCollected.toLocaleString('en-IN')}</p>
        </div>
        <div className="p-5 bg-white border border-slate-300 rounded-xl shadow-xs">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Total Recorded Pending Dues</span>
          <p className="text-2xl font-black text-rose-700 mt-1">₹{totalPending.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-300 bg-slate-50">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">All Payment Transactions</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
              <tr>
                <th className="py-3 px-4">Room & Tenant</th>
                <th className="py-3 px-4">Billing Month</th>
                <th className="py-3 px-4">Amount Due</th>
                <th className="py-3 px-4">Amount Paid</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Receiver</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-600 font-semibold">
                    No payment transactions recorded yet.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 block">{p.room?.room_number || 'Room'}</span>
                      <span className="text-[11px] text-slate-500 block">{p.tenant?.full_name || 'Tenant'}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium">{p.billing_period_month}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">₹{Number(p.amount_due).toLocaleString('en-IN')}</td>
                    <td className="py-3.5 px-4 font-bold text-emerald-600">₹{Number(p.amount_paid).toLocaleString('en-IN')}</td>
                    <td className="py-3.5 px-4 text-slate-600">{p.payment_method || 'CASH'}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                        {p.received_by}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          p.payment_status === 'PAID'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {p.payment_status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
