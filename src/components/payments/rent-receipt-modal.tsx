'use client';

import React from 'react';
import { X, Printer, Share2, CheckCircle2, Building2, User, Calendar, IndianRupee, FileText } from 'lucide-react';
import { Payment, PaymentType, Tenant, Room } from '@/types/database';
import { getLandlordProfile } from '@/lib/store/app-store';

interface RentReceiptModalProps {
  payment: Payment | null;
  tenant?: Tenant | null;
  room?: Room | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function RentReceiptModal({ payment, tenant, room, isOpen, onClose }: RentReceiptModalProps) {
  if (!isOpen || !payment) return null;

  const profile = getLandlordProfile();
  const receiptNo = `RV-${payment.id.slice(-6).toUpperCase()}`;
  const amountPaidNum = Number(payment.amount_paid || 0);
  const amountDueNum = Number(payment.amount_due || 0);
  const isPaid = payment.payment_status === 'PAID';

  const effectiveTenant = payment.tenant || tenant;
  const effectiveRoom = payment.room || room || effectiveTenant?.room;

  const tenantName = effectiveTenant?.full_name || 'Tenant';
  const tenantPhone = effectiveTenant?.phone || '';
  const roomNumber = effectiveRoom?.room_number || 'Unit';
  const billingMonth = payment.billing_month || payment.billing_period_month || 'Current Month';

  const getCategoryLabel = (type?: PaymentType) => {
    switch (type) {
      case 'MAINTENANCE': return 'Maintenance';
      case 'SECURITY_DEPOSIT': return 'Security Deposit / Advance';
      case 'ELECTRICITY': return 'Electricity Bill';
      case 'OTHER': return 'Payment Particulars';
      case 'RENT':
      default: return 'Monthly Rent';
    }
  };

  const categoryLabel = getCategoryLabel(payment.payment_type);
  const sliceLabel = payment.installment_number ? ` (Slice #${payment.installment_number})` : '';

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    const text = `*PAYMENT RECEIPT - ${profile.propertyName || 'RentVault Property'}*
--------------------------------
*Receipt No:* ${receiptNo}
*Purpose / Type:* ${categoryLabel}${sliceLabel}
*Date:* ${payment.payment_date || new Date().toLocaleDateString('en-IN')}
*Tenant:* ${tenantName}
*Room:* Room ${roomNumber}
*Period:* ${billingMonth}
--------------------------------
*Amount Paid in this Slice:* ₹${amountPaidNum.toLocaleString('en-IN')}
${payment.total_target_amount ? `*Total Agreed Target:* ₹${Number(payment.total_target_amount).toLocaleString('en-IN')}\n` : ''}*Remaining Balance:* ₹${Number(payment.amount_pending || 0).toLocaleString('en-IN')}
*Status:* ${payment.payment_status}
*Payment Mode:* ${payment.payment_method || 'UPI'}
${payment.transaction_ref ? `*Ref / UTR:* ${payment.transaction_ref}\n` : ''}${payment.notes ? `*Notes:* ${payment.notes}\n` : ''}*Received By:* ${payment.received_by || profile.name || 'Landlord'}
--------------------------------
Thank you for your payment!`;

    const encoded = encodeURIComponent(text);
    const phone = tenantPhone ? tenantPhone.replace(/[^0-9]/g, '') : '';
    const url = phone ? `https://wa.me/91${phone}?text=${encoded}` : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs print:p-0 print:bg-white">
      <div className="bg-white border border-slate-300 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 print:border-none print:shadow-none">
        {/* Header Bar */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Official {categoryLabel} Receipt
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Receipt Body */}
        <div className="p-6 space-y-5 print:p-8">
          {/* Top Receipt Header */}
          <div className="flex items-start justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                {profile.propertyName || 'RentVault Property'}
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">{profile.address || 'Rental Units'}</p>
              {profile.phone && <p className="text-[11px] text-slate-500">Contact: {profile.phone}</p>}
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Receipt No</span>
              <span className="text-xs font-mono font-bold text-slate-900">{receiptNo}</span>
              <span className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {isPaid && <CheckCircle2 className="w-3 h-3" />}
                {payment.payment_status}
              </span>
            </div>
          </div>

          {/* Amount Paid Callout */}
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-center">
            <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider block">
              {categoryLabel} Received
            </span>
            <span className="text-3xl font-black text-emerald-700 block mt-1">
              ₹{amountPaidNum.toLocaleString('en-IN')}
            </span>
            <span className="text-[11px] text-emerald-800 font-medium block mt-0.5">
              Period / Month: {billingMonth}
            </span>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Tenant & Room</span>
              <p className="font-bold text-slate-900">{tenantName}</p>
              <p className="text-slate-600 font-medium">Room Unit: {roomNumber}</p>
              {payment.tenant?.phone && <p className="text-slate-500 text-[11px]">{payment.tenant.phone}</p>}
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Payment Particulars</span>
              <p className="font-bold text-slate-900">Type: {categoryLabel}</p>
              <p className="text-slate-600 font-medium">Mode: {payment.payment_method || 'UPI'}</p>
              <p className="text-slate-600 font-medium">
                Date: {payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('en-IN') : 'N/A'}
              </p>
              <p className="text-slate-500 text-[11px] truncate" title={payment.transaction_ref || 'Direct'}>
                Ref: {payment.transaction_ref || 'Direct / Confirmed'}
              </p>
            </div>
          </div>

          {/* Notes & Remarks (if provided) */}
          {payment.notes && (
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1">
                <FileText className="w-3 h-3 text-amber-700" /> Notes & Remarks
              </span>
              <p className="font-semibold text-slate-800 leading-relaxed">{payment.notes}</p>
            </div>
          )}

          {/* Financial Breakdown */}
          <div className="p-3 border border-slate-200 rounded-xl space-y-1.5 text-xs text-slate-700">
            {payment.total_target_amount && Number(payment.total_target_amount) > amountPaidNum && (
              <div className="flex justify-between text-indigo-900 font-bold bg-indigo-50/70 p-1.5 rounded-lg border border-indigo-100">
                <span>Total Agreed {categoryLabel}:</span>
                <span>₹{Number(payment.total_target_amount).toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>{payment.installment_number ? `Amount Paid (Slice #${payment.installment_number}):` : 'Amount Paid this transaction:'}</span>
              <span className="font-bold text-emerald-700">₹{amountPaidNum.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold">
              <span>Remaining Pending Balance:</span>
              <span className={Number(payment.amount_pending || 0) > 0 ? 'text-rose-600' : 'text-emerald-700'}>
                {Number(payment.amount_pending || 0) > 0 ? `₹${Number(payment.amount_pending || 0).toLocaleString('en-IN')}` : '₹0 (Fully Settled)'}
              </span>
            </div>
          </div>

          {/* Footer & Signature */}
          <div className="pt-3 border-t border-dashed border-slate-300 flex items-center justify-between text-[11px] text-slate-500">
            <div>
              <p>Generated electronically by RentVault</p>
              <p>Receiver: {payment.received_by || profile.name || 'Landlord'}</p>
            </div>
            <div className="text-right">
              <div className="w-24 border-b border-slate-400 pb-4 mb-1"></div>
              <span>Authorized Signature</span>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons (Hidden on Print) */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 print:hidden">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> Print Receipt
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" /> Share on WhatsApp
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
