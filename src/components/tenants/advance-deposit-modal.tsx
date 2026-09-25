'use client';

import React from 'react';
import { 
  X, ShieldCheck, CheckCircle2, AlertCircle, Clock, 
  IndianRupee, Calendar, CreditCard, Plus, ArrowRight, Check
} from 'lucide-react';
import { Tenant, Room } from '@/types/database';
import { AdvanceTrackingSummary } from '@/lib/store/app-store';

interface AdvanceDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: Tenant | null;
  room?: Room | null;
  summary: AdvanceTrackingSummary | null;
  onRecordAdvancePiece?: (tenant: Tenant, remaining: number) => void;
}

export default function AdvanceDepositModal({
  isOpen,
  onClose,
  tenant,
  room,
  summary,
  onRecordAdvancePiece,
}: AdvanceDepositModalProps) {
  if (!isOpen || !tenant || !summary) return null;

  const {
    agreedAdvance,
    totalPaid,
    remainingUnpaid,
    isFullyPaid,
    status,
    piecesCount,
    pieces,
  } = summary;

  const percentage = agreedAdvance > 0 
    ? Math.min(100, Math.round((totalPaid / agreedAdvance) * 100)) 
    : 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${
              isFullyPaid 
                ? 'bg-emerald-100 text-emerald-700' 
                : totalPaid > 0 
                  ? 'bg-amber-100 text-amber-700' 
                  : 'bg-rose-100 text-rose-700'
            }`}>
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  One-Time Advance Deposit
                </h2>
                {agreedAdvance === 0 ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Done (Zero Advance Agreed)
                  </span>
                ) : isFullyPaid ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Done (Fully Paid)
                  </span>
                ) : totalPaid > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    <Clock className="w-3.5 h-3.5 text-amber-600" /> Partial ({percentage}%)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Not Paid (0%)
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-slate-600 mt-0.5">
                {tenant.full_name} • {room?.room_number ? `Room ${room.room_number}` : 'Room Unit'} • Move-in: {tenant.move_in_date || 'N/A'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Progress Bar & KPI Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-700">Advance Collection Progress</span>
              <span className={isFullyPaid ? 'text-emerald-700' : 'text-slate-900'}>
                {agreedAdvance === 0
                  ? '100% (Zero Advance Required • Done ✓)'
                  : `${percentage}% (${isFullyPaid ? 'Fully Cleared • Done' : `₹${remainingUnpaid.toLocaleString('en-IN')} Remaining`})`}
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  isFullyPaid 
                    ? 'bg-emerald-500' 
                    : totalPaid > 0 
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500' 
                      : 'bg-rose-400'
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Agreed Total
                </span>
                <p className="text-lg font-black text-slate-900 mt-0.5">
                  {agreedAdvance === 0 ? '₹0 (Zero Advance)' : `₹${agreedAdvance.toLocaleString('en-IN')}`}
                </p>
              </div>

              <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-2xl text-center">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                  Total Paid
                </span>
                <p className="text-lg font-black text-emerald-700 mt-0.5">
                  ₹{totalPaid.toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] font-semibold text-emerald-600 block">
                  {piecesCount} piece{piecesCount !== 1 ? 's' : ''}
                </span>
              </div>

              <div className={`p-3.5 rounded-2xl text-center border ${
                remainingUnpaid === 0 
                  ? 'bg-slate-50 border-slate-200' 
                  : 'bg-rose-50/60 border-rose-200'
              }`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                  remainingUnpaid === 0 ? 'text-slate-500' : 'text-rose-800'
                }`}>
                  Remaining Due
                </span>
                <p className={`text-lg font-black mt-0.5 ${
                  remainingUnpaid === 0 ? 'text-slate-400 line-through' : 'text-rose-600'
                }`}>
                  ₹{remainingUnpaid.toLocaleString('en-IN')}
                </p>
                <span className={`text-[10px] font-semibold block ${
                  remainingUnpaid === 0 ? 'text-emerald-600 font-bold' : 'text-rose-600'
                }`}>
                  {remainingUnpaid === 0 ? 'Done ✓' : 'Unpaid'}
                </span>
              </div>
            </div>
          </div>

          {/* Slices / Pieces History */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                Payment Pieces & Dates ({pieces.length})
              </h3>
              {remainingUnpaid > 0 && onRecordAdvancePiece && (
                <button
                  type="button"
                  onClick={() => onRecordAdvancePiece(tenant, remainingUnpaid)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Collect Next Piece
                </button>
              )}
            </div>

            {pieces.length === 0 ? (
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                <p className="text-xs font-semibold text-slate-600">
                  No advance payments recorded yet for this tenant.
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Full agreed advance of ₹{agreedAdvance.toLocaleString('en-IN')} is pending.
                </p>
                {onRecordAdvancePiece && (
                  <button
                    type="button"
                    onClick={() => onRecordAdvancePiece(tenant, agreedAdvance)}
                    className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Collect Advance (₹{agreedAdvance.toLocaleString('en-IN')})
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {pieces.map((piece, idx) => (
                  <div
                    key={piece.id}
                    className="p-3.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-2xl flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xs font-black text-indigo-700 shrink-0">
                        #{piece.installment_number || idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            Piece #{piece.installment_number || idx + 1}: ₹{piece.amount.toLocaleString('en-IN')}
                          </span>
                          <span className="text-[10px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                            {piece.payment_method}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                          Paid on {new Date(piece.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {piece.notes ? ` • ${piece.notes}` : ''}
                        </span>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                      <Check className="w-3 h-3 text-emerald-600" /> Received
                    </span>
                  </div>
                ))}

                {/* Remaining uncollected piece card if partial */}
                {remainingUnpaid > 0 && (
                  <div className="p-3.5 bg-rose-50/60 border border-dashed border-rose-300 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-rose-100 border border-rose-300 flex items-center justify-center text-xs font-black text-rose-700 shrink-0">
                        #{pieces.length + 1}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-rose-900 block">
                          Unpaid Balance: ₹{remainingUnpaid.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[11px] text-rose-700 font-medium block mt-0.5">
                          Remaining advance to be collected
                        </span>
                      </div>
                    </div>

                    {onRecordAdvancePiece && (
                      <button
                        type="button"
                        onClick={() => onRecordAdvancePiece(tenant, remainingUnpaid)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer shrink-0"
                      >
                        <Plus className="w-3 h-3" /> Collect
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Policy Context Footer Note */}
          <div className="p-3.5 bg-indigo-50/80 border border-indigo-200/80 rounded-2xl text-[11px] text-indigo-950 font-medium flex items-start gap-2.5">
            <span className="text-base shrink-0">💡</span>
            <div>
              <strong>One-Time Advance Policy:</strong> Security deposit is collected once per tenancy.
              {agreedAdvance === 0
                ? ' This tenant was registered with a Zero Advance agreement (₹0 deposit required), so advance is fully settled and DONE.'
                : isFullyPaid 
                  ? ' This tenant has fully paid their agreed advance count, so advance is complete and DONE.'
                  : ' Once all installment pieces equal the agreed total, it will be marked DONE.'}
              {' '}Monthly Rent, Maintenance, and Electricity bills are independent and tracked separately.
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-xs font-semibold text-slate-600">
            {agreedAdvance === 0 ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Zero Advance Agreement • Done ✓
              </span>
            ) : isFullyPaid ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Advance Cleared & Done
              </span>
            ) : (
              <span>Balance Due: <strong className="text-rose-600">₹{remainingUnpaid.toLocaleString('en-IN')}</strong></span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {remainingUnpaid > 0 && onRecordAdvancePiece && (
              <button
                type="button"
                onClick={() => onRecordAdvancePiece(tenant, remainingUnpaid)}
                className="inline-flex items-center gap-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Record Next Advance Piece
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
